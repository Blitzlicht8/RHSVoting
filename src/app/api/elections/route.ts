export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = isAdmin(authUser.role)
  const role = authUser.role as string
  const isStudentRole = role === 'student' || role === 'student_admin'

  let whereClause = admin ? '' : `WHERE e.status IN ('active', 'ended')`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryArgs: any[] = []
  let voterIdArg: number | null = null

  if (isStudentRole) {
    const userResult = await db.execute({
      sql: `SELECT email_verified, id_verified, grade_level_id, subtype_id, section_id FROM users WHERE id = ?`,
      args: [authUser.id],
    })
    const u = userResult.rows[0]
    voterIdArg = authUser.id as number

    if (!u?.id_verified) {
      // Unverified students: only global elections that are active or ended
      whereClause = `WHERE e.status IN ('active', 'ended') AND e.is_global = 1`
    } else {
      // Verified students: global elections OR elections they're eligible for,
      // minus any elections with an exclusion rule matching this user
      whereClause = `WHERE e.status IN ('active', 'ended') AND (
        e.is_global = 1
        OR EXISTS (
          SELECT 1 FROM election_eligibility ee
          WHERE ee.election_id = e.id AND ee.is_exclude = 0 AND (
            ee.is_all_grade = 1
            OR ee.grade_level_id = ?
          )
        )
      ) AND NOT EXISTS (
        SELECT 1 FROM election_eligibility ee2
        WHERE ee2.election_id = e.id AND ee2.is_exclude = 1 AND (
          ee2.grade_level_id = ?
          OR (ee2.section_id IS NOT NULL AND ee2.section_id = ?)
        )
      )`
      queryArgs.push(
        u.grade_level_id ?? null,
        u.grade_level_id ?? null,
        u.section_id ?? null,
      )
    }
  }

  // For student roles, LEFT JOIN votes to return hasVoted in one query (eliminates N+1).
  // The JOIN ? must be the first arg since it appears before the WHERE ? args in SQL.
  const hasVotedJoin = voterIdArg !== null
    ? `LEFT JOIN votes vhv ON vhv.election_id = e.id AND vhv.voter_id = ?`
    : ''
  const hasVotedSelect = voterIdArg !== null
    ? `, CASE WHEN vhv.id IS NOT NULL THEN 1 ELSE 0 END AS hasVoted`
    : ''
  // Prepend voterIdArg so it lines up with the JOIN placeholder that precedes WHERE placeholders
  const finalArgs = voterIdArg !== null ? [voterIdArg, ...queryArgs] : queryArgs

  const result = await db.execute({
    sql: `SELECT
            e.*,
            (SELECT COUNT(*) FROM positions p WHERE p.election_id = e.id) AS position_count,
            (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id) AS candidate_count,
            (SELECT COUNT(*) FROM votes v WHERE v.election_id = e.id) AS vote_count
            ${hasVotedSelect}
          FROM elections e
          ${hasVotedJoin}
          ${whereClause}
          ORDER BY e.created_at DESC`,
    args: finalArgs,
  })

  return NextResponse.json({ data: { elections: result.rows } })
}

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

export async function POST(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, start_date, end_date } = body

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (!start_date || !end_date) {
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
  }

  const start = new Date(start_date)
  const end = new Date(end_date)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }
  if (end <= start) {
    return NextResponse.json({ error: 'end_date must be after start_date' }, { status: 400 })
  }

  const insertResult = await db.execute({
    sql: `INSERT INTO elections (title, description, start_date, end_date, status, created_by)
          VALUES (?, ?, ?, ?, 'draft', ?)`,
    args: [title.trim(), description ?? null, start_date, end_date, authUser.id],
  })

  const electionId = Number(insertResult.lastInsertRowid)

  if (Array.isArray(body.positions) && body.positions.length > 0) {
    await syncPositions(electionId, body.positions)
  }

  // Save is_global and allow_teacher_vote
  const isGlobal = body.is_global ? 1 : 0
  const allowTeacherVote = body.allow_teacher_vote ? 1 : 0
  await db.execute({
    sql: `UPDATE elections SET is_global = ?, allow_teacher_vote = ? WHERE id = ?`,
    args: [isGlobal, allowTeacherVote, electionId],
  })

  // Save eligibility rules
  if (Array.isArray(body.eligibility) && body.eligibility.length > 0) {
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

  const election = await db.execute({
    sql: 'SELECT * FROM elections WHERE id = ?',
    args: [electionId],
  })

  return NextResponse.json({ data: { election: election.rows[0] } }, { status: 201 })
}
