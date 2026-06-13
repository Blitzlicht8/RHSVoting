import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

function requireAdmin(role: string) {
  return ['master_admin', 'teacher_admin'].includes(role)
}

export async function GET(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireAdmin(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { searchParams } = request.nextUrl
  const gradeLevelId = searchParams.get('gradeLevelId')
  const subtypeId = searchParams.get('subtypeId')
  if (!gradeLevelId) return NextResponse.json({ error: 'gradeLevelId required' }, { status: 400 })
  const result = subtypeId
    ? await db.execute({
        sql: `SELECT * FROM sections WHERE grade_level_id = ? AND subtype_id = ? ORDER BY name`,
        args: [parseInt(gradeLevelId), parseInt(subtypeId)],
      })
    : await db.execute({
        sql: `SELECT * FROM sections WHERE grade_level_id = ? AND subtype_id IS NULL ORDER BY name`,
        args: [parseInt(gradeLevelId)],
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
    sql: `INSERT INTO sections (grade_level_id, subtype_id, name) VALUES (?,?,?) RETURNING *`,
    args: [body.grade_level_id, body.subtype_id ?? null, body.name.trim()],
  })
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const name = body.name.trim()
  await logActivity(authUser.id, 'section_created', `Created section: ${name}`, ip)
  return NextResponse.json({ data: result.rows[0] }, { status: 201 })
}
