import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = authUser.role as string
  if (!['master_admin', 'teacher_admin', 'teacher'].includes(role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const targetId = parseInt(params.id)
  const level = body.level ?? 'section'

  if (role === 'teacher') {
    const student = await db.execute({ sql: `SELECT grade_level_id, subtype_id, section_id FROM users WHERE id=?`, args: [targetId] })
    const s = student.rows[0]
    const assigned = await db.execute({
      sql: `SELECT 1 FROM teacher_assignments WHERE teacher_id=? AND (grade_level_id=? OR section_id=?)`,
      args: [authUser.id, s?.grade_level_id, s?.section_id],
    })
    if (!assigned.rows.length) return NextResponse.json({ error: 'Not your assigned student' }, { status: 403 })
  }

  const updates: Record<string, string[]> = {
    section: ['section_id = NULL'],
    subtype: ['subtype_id = NULL', 'section_id = NULL'],
    grade_level: ['grade_level_id = NULL', 'subtype_id = NULL', 'section_id = NULL'],
  }
  const setClauses = [...(updates[level] ?? updates.section), 'needs_academic_update = 1', 'id_verified = 0']

  await db.execute({
    sql: `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
    args: [targetId],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'student_academic_removed', `Removed student ${targetId} from ${level}`, ip)

  return NextResponse.json({ message: 'Removed' })
}
