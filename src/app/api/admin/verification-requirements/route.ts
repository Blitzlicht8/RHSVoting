import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

const ALLOWED = ['master_admin', 'teacher_admin']

export async function GET() {
  await ensureInit()
  const result = await db.execute({
    sql: `SELECT vr.*, u.name as created_by_name FROM verification_requirements vr
          LEFT JOIN users u ON u.id = vr.created_by ORDER BY vr.order_index, vr.id`,
    args: [],
  })
  return NextResponse.json({ data: result.rows })
}

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !ALLOWED.includes(authUser.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const result = await db.execute({
    sql: `INSERT INTO verification_requirements (name, description, required, order_index, created_by)
          VALUES (?,?,?,?,?) RETURNING id`,
    args: [
      body.name.trim(),
      body.description?.trim() ?? null,
      body.required !== false ? 1 : 0,
      body.order_index ?? 0,
      authUser.id,
    ],
  })
  return NextResponse.json({ data: { id: Number(result.rows[0].id) } }, { status: 201 })
}
