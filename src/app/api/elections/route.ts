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
  const statusFilter = admin ? '' : `WHERE e.status IN ('active', 'ended')`

  const result = await db.execute({
    sql: `SELECT
            e.*,
            (SELECT COUNT(*) FROM positions p WHERE p.election_id = e.id) AS position_count,
            (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id) AS candidate_count,
            (SELECT COUNT(*) FROM votes v WHERE v.election_id = e.id) AS vote_count
          FROM elections e
          ${statusFilter}
          ORDER BY e.created_at DESC`,
    args: [],
  })

  return NextResponse.json({ data: { elections: result.rows } })
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

  const election = await db.execute({
    sql: 'SELECT * FROM elections WHERE id = ?',
    args: [Number(insertResult.lastInsertRowid)],
  })

  return NextResponse.json({ data: { election: election.rows[0] } }, { status: 201 })
}
