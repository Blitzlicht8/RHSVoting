export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

function requireAdmin(role: string) {
  return ['master_admin', 'admin'].includes(role)
}

export async function GET(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireAdmin(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const gradeLevelId = request.nextUrl.searchParams.get('gradeLevelId')
  const result = await db.execute({
    sql: `SELECT * FROM grade_subtypes WHERE grade_level_id = ? ORDER BY order_index, name`,
    args: [gradeLevelId ? parseInt(gradeLevelId) : 0],
  })
  return NextResponse.json({ data: result.rows })
}

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireAdmin(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  if (!body.name?.trim() || !body.grade_level_id)
    return NextResponse.json({ error: 'name and grade_level_id required' }, { status: 400 })
  const result = await db.execute({
    sql: `INSERT INTO grade_subtypes (grade_level_id, name, order_index) VALUES (?,?,?) RETURNING *`,
    args: [body.grade_level_id, body.name.trim(), body.order_index ?? 0],
  })
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const name = body.name.trim()
  await logActivity(authUser.id, 'subtype_created', `Created subtype: ${name}`, ip)
  return NextResponse.json({ data: result.rows[0] }, { status: 201 })
}
