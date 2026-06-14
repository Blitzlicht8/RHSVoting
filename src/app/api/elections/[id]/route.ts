export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { ElectionStatus, Position, Candidate } from '@/types'
import { InValue } from '@libsql/client'

interface CandidateInput {
  name?: string
  bio?: string
  platform?: string | null
  qualifications?: string | null
  grade_level?: string
  subtype?: string | null
  section?: string
  student_user_id?: number | null
  photo_url?: string | null
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
        sql: `INSERT INTO candidates (election_id, position_id, name, bio, platform, qualifications, grade_level, subtype, section, student_user_id, user_id, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [electionId, posId, candName, cand.bio ?? null, cand.platform ?? null, cand.qualifications ?? null, cand.grade_level ?? null, cand.subtype ?? null, cand.section ?? null, cand.student_user_id ?? null, cand.student_user_id ?? null, cand.photo_url ?? null],
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
    sql: `SELECT c.id, c.position_id, c.election_id, c.name, c.bio, c.platform, c.qualifications,
                 c.grade_level, c.subtype, c.section, c.student_user_id, c.user_id,
                 COALESCE(u.avatar_url, c.photo_url) AS photo_url
          FROM candidates c
          LEFT JOIN users u ON u.id = COALESCE(c.student_user_id, c.user_id)
          WHERE c.election_id = ?`,
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

  const eligibilityResult = await db.execute({
    sql: 'SELECT * FROM election_eligibility WHERE election_id = ?',
    args: [electionId],
  })
  const eligibility = eligibilityResult.rows

  return NextResponse.json({
    data: { election: { ...election, positions: positionsWithCandidates, hasVoted, eligibility } },
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
    if (body.status === 'active') {
      const posCheck = await db.execute({ sql: `SELECT COUNT(*) AS cnt FROM positions WHERE election_id = ?`, args: [electionId] })
      if (Number((posCheck.rows[0] as unknown as { cnt: number }).cnt) === 0) {
        return NextResponse.json({ error: 'Cannot start — election has no positions.' }, { status: 400 })
      }
      const candCheck = await db.execute({ sql: `SELECT COUNT(*) AS cnt FROM candidates WHERE election_id = ?`, args: [electionId] })
      if (Number((candCheck.rows[0] as unknown as { cnt: number }).cnt) === 0) {
        return NextResponse.json({ error: 'Cannot start — no candidates have been added.' }, { status: 400 })
      }
    }
    setClauses.push('status = ?')
    values.push(body.status)
  }

  if (body.is_global !== undefined) {
    setClauses.push('is_global = ?')
    values.push(body.is_global ? 1 : 0)
  }

  if (body.allow_teacher_vote !== undefined) {
    setClauses.push('allow_teacher_vote = ?')
    values.push(body.allow_teacher_vote ? 1 : 0)
  }

  if (body.thumbnail_url !== undefined) {
    setClauses.push('thumbnail_url = ?')
    values.push(typeof body.thumbnail_url === 'string' ? body.thumbnail_url : null)
  }

  const hasPositions = Array.isArray(body.positions)
  const hasEligibility = Array.isArray(body.eligibility)

  if (setClauses.length === 0 && !hasPositions && !hasEligibility) {
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

  if (hasEligibility) {
    await db.execute({
      sql: 'DELETE FROM election_eligibility WHERE election_id = ?',
      args: [electionId],
    })
    for (const rule of body.eligibility) {
      await db.execute({
        sql: `INSERT INTO election_eligibility (election_id, grade_level_id, subtype_id, section_id, is_all_grade, is_all_subtype, is_all_section, is_exclude)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          electionId,
          rule.grade_level_id ?? null,
          rule.subtype_id ?? null,
          rule.section_id ?? null,
          rule.is_all_grade ? 1 : 0,
          rule.is_all_subtype ? 1 : 0,
          rule.is_all_section ? 1 : 0,
          rule.is_exclude ? 1 : 0,
        ],
      })
    }
  }

  const updated = await db.execute({ sql: 'SELECT * FROM elections WHERE id = ?', args: [electionId] })
  return NextResponse.json({ data: { election: updated.rows[0] } })
}

const ROLE_LEVEL: Record<string, number> = {
  master_admin: 4, admin: 3, moderator: 2, staff: 1, member: 0,
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

  const existingResult = await db.execute({
    sql: 'SELECT id, status FROM elections WHERE id = ?',
    args: [electionId],
  })
  const existing = existingResult.rows[0]
  if (!existing) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  const status = existing.status as string
  const userLevel = ROLE_LEVEL[authUser.role as string] ?? 0
  const confirmed = request.nextUrl.searchParams.get('confirm') === 'true'

  const deleteElection = async () => {
    // votes FK has no CASCADE — must delete manually before the election row
    await db.execute({ sql: 'DELETE FROM votes WHERE election_id = ?', args: [electionId] })
    await db.execute({ sql: 'DELETE FROM elections WHERE id = ?', args: [electionId] })
  }

  if (status === 'draft') {
    await deleteElection()
    return NextResponse.json({ message: 'Election deleted successfully' })
  }

  if (status === 'active') {
    if (userLevel < 3) {
      return NextResponse.json({ error: 'Only admin or master_admin can delete active elections' }, { status: 403 })
    }
    if (!confirmed) {
      const voteResult = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM votes WHERE election_id = ?', args: [electionId] })
      const voteCount = Number(voteResult.rows[0]?.cnt ?? 0)
      return NextResponse.json({ requiresConfirm: true, voteCount }, { status: 409 })
    }
    await deleteElection()
    return NextResponse.json({ message: 'Election deleted successfully' })
  }

  if (status === 'ended') {
    if (authUser.role !== 'master_admin') {
      return NextResponse.json({ error: 'Only master_admin can delete ended elections' }, { status: 403 })
    }
    if (!confirmed) {
      const voteResult = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM votes WHERE election_id = ?', args: [electionId] })
      const voteCount = Number(voteResult.rows[0]?.cnt ?? 0)
      return NextResponse.json({ requiresConfirm: true, voteCount }, { status: 409 })
    }
    await deleteElection()
    return NextResponse.json({ message: 'Election deleted successfully' })
  }

  return NextResponse.json({ error: 'Unknown election status' }, { status: 400 })
}
