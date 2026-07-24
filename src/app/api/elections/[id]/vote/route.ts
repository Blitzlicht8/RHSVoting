export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { InValue } from '@libsql/client'
import { getUserValueSet, evaluateEligibility, EligibilityRule } from '@/lib/groups'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const electionId = parseInt(params.id, 10)
  if (isNaN(electionId)) {
    return NextResponse.json({ error: 'Invalid election ID' }, { status: 400 })
  }

  const role = authUser.role as string
  const isStudentRole = role === 'member' || role === 'moderator'

  if (isStudentRole) {
    // Students only see their own vote selections — no aggregates
    const result = await db.execute({
      sql: 'SELECT v.candidate_id, v.position_id FROM votes v WHERE v.election_id = ? AND v.voter_id = ?',
      args: [electionId, authUser.id],
    })
    return NextResponse.json({
      data: {
        hasVoted: result.rows.length > 0,
        myVotes: result.rows.map((r) => r.candidate_id),
        votes: result.rows.length > 0 ? result.rows : undefined,
      },
    })
  }

  // Teachers and admins get full vote data
  const result = await db.execute({
    sql: 'SELECT * FROM votes WHERE election_id = ? AND voter_id = ?',
    args: [electionId, authUser.id],
  })

  return NextResponse.json({
    data: {
      hasVoted: result.rows.length > 0,
      myVotes: result.rows.map((r) => r.candidate_id),
      votes: result.rows.length > 0 ? result.rows : undefined,
    },
  })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const electionId = parseInt(params.id, 10)
  if (isNaN(electionId)) {
    return NextResponse.json({ error: 'Invalid election ID' }, { status: 400 })
  }

  const userResult = await db.execute({
    sql: 'SELECT email_verified, id_verified, active, timeout_until FROM users WHERE id = ?',
    args: [authUser.id],
  })
  const user = userResult.rows[0]

  if (!user || !user.active) {
    return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })
  }
  if (user.timeout_until && new Date(user.timeout_until as string).getTime() > Date.now()) {
    return NextResponse.json(
      { error: `You are timed out until ${new Date(user.timeout_until as string).toLocaleString()} and cannot vote.` },
      { status: 403 }
    )
  }
  if (!user.email_verified) {
    return NextResponse.json({ error: 'Email must be verified before voting' }, { status: 403 })
  }
  if (!user.id_verified) {
    return NextResponse.json({ error: 'ID must be verified before voting' }, { status: 403 })
  }

  const electionResult = await db.execute({
    sql: 'SELECT id, status, is_global FROM elections WHERE id = ?',
    args: [electionId],
  })
  const election = electionResult.rows[0]
  if (!election) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }
  if (election.status !== 'active') {
    return NextResponse.json({ error: 'Election is not currently active' }, { status: 400 })
  }

  // Eligibility gate: for scoped elections, only members in the eligible group(s)
  // may vote. A visible_to_all election is viewable by everyone but this check
  // still blocks non-eligible viewers from casting a vote.
  if (!election.is_global) {
    const rulesResult = await db.execute({
      sql: `SELECT structure_id, value_id, is_all_groups, is_exclude
            FROM election_eligibility_rules WHERE election_id = ?`,
      args: [electionId],
    })
    const rules: EligibilityRule[] = rulesResult.rows.map((r) => ({
      structure_id: r.structure_id === null ? null : Number(r.structure_id),
      value_id: r.value_id === null ? null : Number(r.value_id),
      is_all_groups: Number(r.is_all_groups),
      is_exclude: Number(r.is_exclude),
    }))
    const valueSet = await getUserValueSet(authUser.id as number)
    if (!evaluateEligibility(rules, valueSet)) {
      return NextResponse.json({ error: 'You are not eligible to vote in this election' }, { status: 403 })
    }
  }

  const body = await request.json()
  const { votes } = body

  if (!Array.isArray(votes) || votes.length === 0) {
    return NextResponse.json({ error: 'votes array is required and cannot be empty' }, { status: 400 })
  }

  for (const vote of votes) {
    if (!vote.position_id || !vote.candidate_id) {
      return NextResponse.json({ error: 'Each vote must have position_id and candidate_id' }, { status: 400 })
    }
  }

  // Reject duplicate (position_id, candidate_id) pairs — same candidate twice is invalid
  const voteKeys = votes.map((v: { position_id: number; candidate_id: number }) => `${v.position_id}_${v.candidate_id}`)
  if (new Set(voteKeys).size !== voteKeys.length) {
    return NextResponse.json({ error: 'Duplicate candidate selection' }, { status: 400 })
  }

  const uniquePositionIds = Array.from(new Set(votes.map((v: { position_id: number }) => v.position_id) as number[]))

  for (const vote of votes) {
    const candidateResult = await db.execute({
      sql: 'SELECT id FROM candidates WHERE id = ? AND position_id = ? AND election_id = ?',
      args: [vote.candidate_id, vote.position_id, electionId],
    })
    if (candidateResult.rows.length === 0) {
      return NextResponse.json(
        { error: `Candidate ${vote.candidate_id} not found for position ${vote.position_id} in this election` },
        { status: 400 }
      )
    }
  }

  // Validate votes per position do not exceed max_votes
  const posPlaceholders = uniquePositionIds.map(() => '?').join(', ')
  const positionResult = await db.execute({
    sql: `SELECT id, max_votes FROM positions WHERE election_id = ? AND id IN (${posPlaceholders})`,
    args: [electionId, ...uniquePositionIds] as InValue[],
  })
  const positionMaxVotes: Record<number, number> = {}
  for (const row of positionResult.rows) {
    positionMaxVotes[Number(row.id)] = Number(row.max_votes ?? 1)
  }
  const votesPerPosition: Record<number, number> = {}
  for (const vote of votes) {
    votesPerPosition[vote.position_id] = (votesPerPosition[vote.position_id] ?? 0) + 1
  }
  for (const [posIdStr, count] of Object.entries(votesPerPosition)) {
    const maxAllowed = positionMaxVotes[Number(posIdStr)] ?? 1
    if (count > maxAllowed) {
      return NextResponse.json(
        { error: `Too many candidates selected for a position. Maximum allowed: ${maxAllowed}` },
        { status: 400 }
      )
    }
  }

  // Reject if voter already submitted any vote for these positions
  const existingPlaceholders = uniquePositionIds.map(() => '?').join(', ')
  const existingResult = await db.execute({
    sql: `SELECT DISTINCT position_id FROM votes WHERE election_id = ? AND voter_id = ? AND position_id IN (${existingPlaceholders})`,
    args: [electionId, authUser.id, ...uniquePositionIds] as InValue[],
  })

  if (existingResult.rows.length > 0) {
    const alreadyVotedPositions = existingResult.rows.map((v) => v.position_id)
    return NextResponse.json(
      { error: `Already voted for position(s): ${alreadyVotedPositions.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    await db.batch(
      votes.map((vote: { position_id: number; candidate_id: number }) => ({
        sql: 'INSERT INTO votes (election_id, position_id, candidate_id, voter_id) VALUES (?, ?, ?, ?)',
        args: [electionId, vote.position_id, vote.candidate_id, authUser.id] as InValue[],
      })),
      'write'
    )
  } catch {
    return NextResponse.json({ error: 'Failed to submit votes. You may have already voted.' }, { status: 409 })
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'vote_cast', `Voted in election ${electionId}`, ip)
  return NextResponse.json({ message: 'Your votes have been submitted!' })
}
