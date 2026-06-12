import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

function isAdmin(role: string) { return ['master_admin', 'teacher_admin'].includes(role) }

export async function GET(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role as string)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const teacherId = request.nextUrl.searchParams.get('teacherId')
  const sql = teacherId
    ? `SELECT ta.*, gl.name as gl_name, gs.name as sub_name, s.name as sec_name
       FROM teacher_assignments ta
       LEFT JOIN grade_levels gl ON gl.id = ta.grade_level_id
       LEFT JOIN grade_subtypes gs ON gs.id = ta.subtype_id
       LEFT JOIN sections s ON s.id = ta.section_id
       WHERE ta.teacher_id = ?`
    : `SELECT ta.*, u.name as teacher_name, gl.name as gl_name, gs.name as sub_name, s.name as sec_name
       FROM teacher_assignments ta
       JOIN users u ON u.id = ta.teacher_id
       LEFT JOIN grade_levels gl ON gl.id = ta.grade_level_id
       LEFT JOIN grade_subtypes gs ON gs.id = ta.subtype_id
       LEFT JOIN sections s ON s.id = ta.section_id`
  const result = await db.execute({ sql, args: teacherId ? [parseInt(teacherId)] : [] })
  return NextResponse.json({ data: result.rows })
}

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role as string)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  if (!body.teacher_id) return NextResponse.json({ error: 'teacher_id required' }, { status: 400 })
  await db.execute({
    sql: `INSERT OR IGNORE INTO teacher_assignments (teacher_id, grade_level_id, subtype_id, section_id) VALUES (?,?,?,?)`,
    args: [body.teacher_id, body.grade_level_id ?? null, body.subtype_id ?? null, body.section_id ?? null],
  })
  return NextResponse.json({ message: 'Assigned' }, { status: 201 })
}
