export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

function requireAdmin(role: string) {
  return ['master_admin', 'admin'].includes(role)
}

export async function GET() {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireAdmin(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await db.execute({ sql: `SELECT * FROM grade_levels ORDER BY order_index, name`, args: [] })
  return NextResponse.json({ data: result.rows })
}

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireAdmin(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const maxOrder = await db.execute({ sql: `SELECT COALESCE(MAX(order_index),0)+1 as next FROM grade_levels`, args: [] })
  const next = Number(maxOrder.rows[0].next)
  const result = await db.execute({
    sql: `INSERT INTO grade_levels (name, order_index) VALUES (?, ?) RETURNING *`,
    args: [body.name.trim(), body.order_index ?? next],
  })
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const name = body.name.trim()
  await logActivity(authUser.id, 'grade_level_created', `Created grade level: ${name}`, ip)
  return NextResponse.json({ data: result.rows[0] }, { status: 201 })
}
