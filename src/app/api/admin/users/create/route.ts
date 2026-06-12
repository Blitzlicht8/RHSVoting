import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'teacher_admin'].includes(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, email, password, role, grade_level_id, subtype_id, section_id,
          email_verified, id_verified } = body

  if (!name?.trim() || !email?.trim() || !password || !role)
    return NextResponse.json({ error: 'name, email, password, role required' }, { status: 400 })

  // teacher_admin cannot create master_admin or teacher_admin
  if (authUser.role === 'teacher_admin' && ['master_admin', 'teacher_admin', 'student_admin'].includes(role))
    return NextResponse.json({ error: 'Insufficient permissions to assign this role' }, { status: 403 })

  const existing = await db.execute({ sql: `SELECT id FROM users WHERE email = ?`, args: [email.trim()] })
  if (existing.rows.length > 0)
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

  const hashedPassword = await bcrypt.hash(password, 12)
  const result = await db.execute({
    sql: `INSERT INTO users (email, password_hash, name, role, email_verified, id_verified, grade_level_id, subtype_id, section_id, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING id`,
    args: [
      email.trim(), hashedPassword, name.trim(), role,
      email_verified ? 1 : 0,
      id_verified ? 1 : 0,
      grade_level_id ?? null,
      subtype_id ?? null,
      section_id ?? null,
    ],
  })
  const userId = Number(result.rows[0].id)

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'user_created', `Admin created user ${email.trim()} with role ${role}`, ip)

  return NextResponse.json({ data: { userId } }, { status: 201 })
}
