export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'

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
    sql: 'SELECT id, status FROM elections WHERE id = ?',
    args: [electionId],
  })
  if (electionResult.rows.length === 0) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  const candidatesResult = await db.execute({
    sql: `SELECT c.*,
            (SELECT COUNT(*) FROM votes v WHERE v.candidate_id = c.id AND v.election_id = ?) AS vote_count
          FROM candidates c
          WHERE c.election_id = ?
          ORDER BY c.position_id ASC, c.name ASC`,
    args: [electionId, electionId],
  })

  return NextResponse.json({ data: { candidates: candidatesResult.rows } })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const electionId = parseInt(params.id, 10)
  if (isNaN(electionId)) {
    return NextResponse.json({ error: 'Invalid election ID' }, { status: 400 })
  }

  const electionResult = await db.execute({
    sql: 'SELECT id, status FROM elections WHERE id = ?',
    args: [electionId],
  })
  const election = electionResult.rows[0]
  if (!election) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }
  if (election.status !== 'draft') {
    return NextResponse.json({ error: 'Candidates can only be added to draft elections' }, { status: 400 })
  }

  const body = await request.json()
  const { position_id, name, bio, photo_url, platform, qualifications } = body

  if (!position_id || isNaN(parseInt(position_id, 10))) {
    return NextResponse.json({ error: 'position_id is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const positionResult = await db.execute({
    sql: 'SELECT id FROM positions WHERE id = ? AND election_id = ?',
    args: [parseInt(position_id, 10), electionId],
  })
  if (positionResult.rows.length === 0) {
    return NextResponse.json({ error: 'Position not found in this election' }, { status: 404 })
  }

  const insertResult = await db.execute({
    sql: `INSERT INTO candidates (election_id, position_id, name, bio, photo_url, platform, qualifications) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [electionId, parseInt(position_id, 10), name.trim(), bio ?? null, photo_url ?? null, platform ?? null, qualifications ?? null],
  })

  const candidate = await db.execute({
    sql: 'SELECT * FROM candidates WHERE id = ?',
    args: [Number(insertResult.lastInsertRowid)],
  })

  return NextResponse.json({ data: { candidate: candidate.rows[0] } }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const electionId = parseInt(params.id, 10)
  if (isNaN(electionId)) {
    return NextResponse.json({ error: 'Invalid election ID' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const candidateId = parseInt(searchParams.get('candidateId') || '', 10)
  if (isNaN(candidateId)) {
    return NextResponse.json({ error: 'candidateId query param is required' }, { status: 400 })
  }

  const electionResult = await db.execute({
    sql: 'SELECT id, status FROM elections WHERE id = ?',
    args: [electionId],
  })
  const election = electionResult.rows[0]
  if (!election) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }
  if (election.status !== 'draft') {
    return NextResponse.json({ error: 'Candidates can only be removed from draft elections' }, { status: 400 })
  }

  const candidateResult = await db.execute({
    sql: 'SELECT id FROM candidates WHERE id = ? AND election_id = ?',
    args: [candidateId, electionId],
  })
  if (candidateResult.rows.length === 0) {
    return NextResponse.json({ error: 'Candidate not found in this election' }, { status: 404 })
  }

  await db.execute({ sql: 'DELETE FROM candidates WHERE id = ?', args: [candidateId] })
  return NextResponse.json({ message: 'Candidate removed successfully' })
}
