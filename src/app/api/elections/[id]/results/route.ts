export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { Position, Candidate } from '@/types'

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

  const electionResult = await db.execute({
    sql: 'SELECT * FROM elections WHERE id = ?',
    args: [electionId],
  })
  const election = electionResult.rows[0]
  if (!election) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  const admin = isAdmin(authUser.role)
  const role = authUser.role as string
  const isStudentRole = role === 'student' || role === 'student_admin'

  if (!admin && election.status !== 'ended') {
    return NextResponse.json(
      { error: 'Results are only available after the election has ended' },
      { status: 403 }
    )
  }

  // Students never see individual voter identity — only aggregates are returned below.
  // teacher_admin/master_admin can see individual records if needed via separate endpoints.

  const positionsResult = await db.execute({
    sql: 'SELECT * FROM positions WHERE election_id = ? ORDER BY order_index ASC',
    args: [electionId],
  })
  const positions = positionsResult.rows as unknown as Position[]

  const candidatesResult = await db.execute({
    sql: `SELECT c.*, COUNT(v.id) AS vote_count
          FROM candidates c
          LEFT JOIN votes v ON v.candidate_id = c.id AND v.election_id = ?
          WHERE c.election_id = ?
          GROUP BY c.id
          ORDER BY vote_count DESC`,
    args: [electionId, electionId],
  })
  const candidateRows = candidatesResult.rows as unknown as (Candidate & { vote_count: number })[]

  const totalVotesPerPosition: Record<number, number> = {}
  for (const candidate of candidateRows) {
    totalVotesPerPosition[candidate.position_id] =
      (totalVotesPerPosition[candidate.position_id] ?? 0) + Number(candidate.vote_count)
  }

  const positionsWithResults = positions.map((pos) => {
    const candidates = candidateRows
      .filter((c) => c.position_id === pos.id)
      .map((c) => {
        const total = totalVotesPerPosition[pos.id] || 0
        const voteCount = Number(c.vote_count)
        return {
          ...c,
          vote_count: voteCount,
          percentage: total > 0 ? Math.round((voteCount / total) * 10000) / 100 : 0,
        }
      })
    return { ...pos, candidates }
  })

  // For students: strip any voter identity fields from candidate entries (aggregates only)
  const safePositions = isStudentRole
    ? positionsWithResults.map((pos) => ({
        ...pos,
        candidates: pos.candidates.map(({ ...c }) => {
          // Remove any field that would identify individual voters
          const { ...safe } = c as Record<string, unknown>
          delete safe.voter_id
          delete safe.voters
          return safe
        }),
      }))
    : positionsWithResults

  return NextResponse.json({ data: { election, positions: safePositions } })
}
