import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { ElectionStatus, Position, Candidate } from '@/types'
import { InValue } from '@libsql/client'

interface CandidateInput {
  name?: string
  bio?: string
  grade_level?: string
  section?: string
  student_user_id?: number | null
}

interface PositionInput {
  name?: string
  max_votes?: number
  candidates?: CandidateInput[]
}

async function syncPositions(electionId: number, positions: PositionInput[]) {
  await db.execute({ sql: 'DELETE FROM positions WHERE election_id = ?', args: [electionId] })
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    const posName = (pos.name ?? '').trim()
    if (!posName) continue
    const posResult = await db.execute({
      sql: `INSERT INTO positions (election_id, name, max_votes, order_index) VALUES (?, ?, ?, ?)`,
      args: [electionId, posName, pos.max_votes ?? 1, i],
    })
    const posId = Number(posResult.lastInsertRowid)
    for (const cand of pos.candidates ?? []) {
      const candName = (cand.name ?? '').trim()
      if (!candName) continue
      await db.execute({
        sql: `INSERT INTO candidates (election_id, position_id, name, bio, grade_level, section, student_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [electionId, posId, candName, cand.bio ?? null, cand.grade_level ?? null, cand.section ?? null, cand.student_user_id ?? null],
      })
    }
  }
}

const VALID_TRANSITIONS: Record<ElectionStatus, ElectionStatus | null> = {
  draft: 'active',
  active: 'ended',
  ended: null,
}

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
  if (!admin && !['active', 'ended'].includes(election.status as string)) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  const positionsResult = await db.execute({
    sql: 'SELECT * FROM positions WHERE election_id = ? ORDER BY order_index ASC',
    args: [electionId],
  })
  const positions = positionsResult.rows as unknown as Position[]

  const candidatesResult = await db.execute({
    sql: 'SELECT * FROM candidates WHERE election_id = ?',
    args: [electionId],
  })
  const candidates = candidatesResult.rows as unknown as Candidate[]

  const positionsWithCandidates = positions.map((pos) => ({
    ...pos,
    candidates: candidates.filter((c) => c.position_id === pos.id),
  }))

  const voteCountResult = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM votes WHERE election_id = ? AND voter_id = ?',
    args: [electionId, authUser.id],
  })
  const hasVoted = Number(voteCountResult.rows[0]?.count ?? 0) > 0

  return NextResponse.json({
    data: { election: { ...election, positions: positionsWithCandidates, hasVoted } },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

  const existingResult = await db.execute({
    sql: 'SELECT * FROM elections WHERE id = ?',
    args: [electionId],
  })
  const existing = existingResult.rows[0]
  if (!existing) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  const body = await request.json()
  const setClauses: string[] = []
  const values: InValue[] = []

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }
    setClauses.push('title = ?')
    values.push(body.title.trim())
  }

  if (body.description !== undefined) {
    setClauses.push('description = ?')
    values.push(body.description ?? null)
  }

  if (body.start_date !== undefined) {
    if (isNaN(new Date(body.start_date).getTime())) {
      return NextResponse.json({ error: 'Invalid start_date' }, { status: 400 })
    }
    setClauses.push('start_date = ?')
    values.push(body.start_date)
  }

  if (body.end_date !== undefined) {
    if (isNaN(new Date(body.end_date).getTime())) {
      return NextResponse.json({ error: 'Invalid end_date' }, { status: 400 })
    }
    setClauses.push('end_date = ?')
    values.push(body.end_date)
  }

  if (body.status !== undefined) {
    const currentStatus = existing.status as ElectionStatus
    const allowedNext = VALID_TRANSITIONS[currentStatus]
    if (body.status !== allowedNext) {
      return NextResponse.json(
        { error: `Invalid status transition: ${currentStatus} -> ${body.status}. Allowed: ${allowedNext ?? 'none'}` },
        { status: 400 }
      )
    }
    setClauses.push('status = ?')
    values.push(body.status)
  }

  const hasPositions = Array.isArray(body.positions)

  if (setClauses.length === 0 && !hasPositions) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = datetime('now')")
    values.push(electionId)
    await db.execute({
      sql: `UPDATE elections SET ${setClauses.join(', ')} WHERE id = ?`,
      args: values,
    })
  }

  if (hasPositions) {
    const currentStatus = existing.status as string
    if (currentStatus !== 'draft') {
      return NextResponse.json({ error: 'Positions can only be modified on draft elections' }, { status: 400 })
    }
    await syncPositions(electionId, body.positions as PositionInput[])
  }

  const updated = await db.execute({ sql: 'SELECT * FROM elections WHERE id = ?', args: [electionId] })
  return NextResponse.json({ data: { election: updated.rows[0] } })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (authUser.role !== 'master_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const electionId = parseInt(params.id, 10)
  if (isNaN(electionId)) {
    return NextResponse.json({ error: 'Invalid election ID' }, { status: 400 })
  }

  const existingResult = await db.execute({
    sql: 'SELECT id, status FROM elections WHERE id = ?',
    args: [electionId],
  })
  const existing = existingResult.rows[0]
  if (!existing) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft elections can be deleted' }, { status: 400 })
  }

  await db.execute({ sql: 'DELETE FROM elections WHERE id = ?', args: [electionId] })
  return NextResponse.json({ message: 'Election deleted successfully' })
}
