import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { InValue } from '@libsql/client'

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
  const isStudentRole = role === 'student' || role === 'student_admin'

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
    sql: 'SELECT email_verified, id_verified, active FROM users WHERE id = ?',
    args: [authUser.id],
  })
  const user = userResult.rows[0]

  if (!user || !user.active) {
    return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })
  }
  if (!user.email_verified) {
    return NextResponse.json({ error: 'Email must be verified before voting' }, { status: 403 })
  }
  if (!user.id_verified) {
    return NextResponse.json({ error: 'ID must be verified before voting' }, { status: 403 })
  }

  const electionResult = await db.execute({
    sql: 'SELECT id, status FROM elections WHERE id = ?',
    args: [electionId],
  })
  const election = electionResult.rows[0]
  if (!election) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }
  if (election.status !== 'active') {
    return NextResponse.json({ error: 'Election is not currently active' }, { status: 400 })
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

  const positionIds: number[] = votes.map((v: { position_id: number }) => v.position_id)
  if (new Set(positionIds).size !== positionIds.length) {
    return NextResponse.json({ error: 'Duplicate position_id in votes' }, { status: 400 })
  }

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

  const placeholders = positionIds.map(() => '?').join(', ')
  const existingResult = await db.execute({
    sql: `SELECT position_id FROM votes WHERE election_id = ? AND voter_id = ? AND position_id IN (${placeholders})`,
    args: [electionId, authUser.id, ...positionIds] as InValue[],
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
