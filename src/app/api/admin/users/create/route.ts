export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/logger'
import { setUserAssignments, type Assignment } from '@/lib/groups'

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'admin'].includes(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await hasPermission(authUser.role, 'manageUsers')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, email, password, role, assignments,
          email_verified, id_verified } = body

  if (!name?.trim() || !email?.trim() || !password || !role)
    return NextResponse.json({ error: 'name, email, password, role required' }, { status: 400 })

  // admin cannot create master_admin or admin
  if (authUser.role === 'admin' && ['master_admin', 'admin', 'moderator'].includes(role))
    return NextResponse.json({ error: 'Insufficient permissions to assign this role' }, { status: 403 })

  // unverified at creation unless admin explicitly verifies the account
  const effectiveRole = id_verified ? role : 'unverified'

  const existing = await db.execute({ sql: `SELECT id FROM users WHERE email = ?`, args: [email.trim()] })
  if (existing.rows.length > 0)
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

  const hashedPassword = await bcrypt.hash(password, 12)
  const result = await db.execute({
    sql: `INSERT INTO users (email, password_hash, name, role, email_verified, id_verified, active)
          VALUES (?, ?, ?, ?, ?, ?, 1) RETURNING id`,
    args: [
      email.trim(), hashedPassword, name.trim(), effectiveRole,
      email_verified ? 1 : 0,
      id_verified ? 1 : 0,
    ],
  })
  const userId = Number(result.rows[0].id)

  // NEW: optional group assignments via the configurable model.
  if (Array.isArray(assignments)) {
    const normalized: Assignment[] = assignments
      .map((a): Assignment => ({ structure_id: Number(a.structure_id), value_id: Number(a.value_id) }))
      .filter((a) => Number.isFinite(a.structure_id) && Number.isFinite(a.value_id))
    await setUserAssignments(userId, normalized)
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'user_created', `Admin created user ${email.trim()} with role ${effectiveRole}`, ip)

  return NextResponse.json({ data: { userId } }, { status: 201 })
}
