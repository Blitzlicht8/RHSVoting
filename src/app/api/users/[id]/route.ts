export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { Role } from '@/types'
import { InValue } from '@libsql/client'

const ALL_ROLES: Role[] = ['master_admin', 'admin', 'moderator', 'staff', 'member', 'unverified']

const ROLE_LEVEL: Record<string, number> = {
  unverified: -1,
  member: 0,
  staff: 1,
  moderator: 2,
  admin: 3,
  master_admin: 4,
}

function canDelete(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'master_admin') return true
  if (actorRole === 'admin') return (ROLE_LEVEL[targetRole] ?? -1) < ROLE_LEVEL['admin']
  return false
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetId = parseInt(params.id, 10)
  if (isNaN(targetId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  if (!isAdmin(authUser.role) && authUser.id !== targetId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await db.execute({
    sql: `SELECT id, email, name, role, email_verified, id_verified, id_image, active, created_at, updated_at,
                 grade_level_id, subtype_id, section_id, avatar_url, bio
          FROM users WHERE id = ?`,
    args: [targetId],
  })
  const user = result.rows[0]

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const docs = await db.execute({
    sql: `SELECT vd.id, vd.file_path FROM verification_documents vd
          JOIN verification_requests vr ON vr.id = vd.verification_request_id
          WHERE vr.user_id = ? ORDER BY vd.created_at DESC`,
    args: [targetId]
  })

  return NextResponse.json({ data: { user, documents: docs.rows.map(r => ({ id: Number(r.id), file_path: String(r.file_path) })) } })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetId = parseInt(params.id, 10)
  if (isNaN(targetId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  const isSelf = authUser.id === targetId
  const adminUser = isAdmin(authUser.role)

  if (!adminUser && !isSelf) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await db.execute({
    sql: `SELECT id, email, role, name FROM users WHERE id = ?`,
    args: [targetId],
  })
  if (existing.rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const existingUser = existing.rows[0]

  // Role hierarchy check: admin cannot edit users of equal or higher role
  const actorLevel = ROLE_LEVEL[authUser.role as string] ?? -1
  const targetLevel = ROLE_LEVEL[existingUser.role as string] ?? -1
  if (authUser.role === 'admin' && targetLevel >= ROLE_LEVEL['admin']) {
    return NextResponse.json({ error: 'Cannot edit users of equal or higher role' }, { status: 403 })
  }

  const body = await request.json()
  const setClauses: string[] = []
  const values: InValue[] = []

  if (body.name !== undefined && (isSelf || adminUser)) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    setClauses.push('name = ?')
    values.push(body.name.trim())
  }

  if (body.active !== undefined && adminUser) {
    setClauses.push('active = ?')
    values.push(body.active ? 1 : 0)
  }

  if (body.role !== undefined && adminUser) {
    if (!ALL_ROLES.includes(body.role as Role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    const adminOnlyRoles: Role[] = ['master_admin', 'admin']
    if (authUser.role !== 'master_admin' && adminOnlyRoles.includes(body.role as Role)) {
      return NextResponse.json({ error: 'Only master_admin can assign admin roles' }, { status: 403 })
    }
    setClauses.push('role = ?')
    values.push(body.role)
  }

  const canVerify = ['master_admin', 'admin'].includes(authUser.role as string)

  if (body.email_verified !== undefined && canVerify) {
    setClauses.push('email_verified = ?')
    values.push(body.email_verified ? 1 : 0)
  }

  if (body.id_verified !== undefined && canVerify) {
    setClauses.push('id_verified = ?')
    values.push(body.id_verified ? 1 : 0)
  }

  if (body.grade_level_id !== undefined && adminUser) {
    setClauses.push('grade_level_id = ?')
    values.push(body.grade_level_id ?? null)
  }

  if (body.subtype_id !== undefined && adminUser) {
    setClauses.push('subtype_id = ?')
    values.push(body.subtype_id ?? null)
  }

  if (body.section_id !== undefined && adminUser) {
    setClauses.push('section_id = ?')
    values.push(body.section_id ?? null)
  }

  if (body.email !== undefined && adminUser) {
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    setClauses.push('email = ?')
    values.push(body.email.trim())
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  setClauses.push("updated_at = datetime('now')")
  values.push(targetId)

  await db.execute({
    sql: `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
    args: values,
  })

  if (body.name !== undefined && (isSelf || adminUser)) {
    const oldName = existingUser.name as string
    const newName = body.name.trim()
    if (oldName !== newName) {
      await db.execute({
        sql: `INSERT INTO name_history (user_id, old_name, new_name) VALUES (?, ?, ?)`,
        args: [targetId, oldName, newName],
      })
    }
  }

  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  const targetEmail = existingUser.email as string

  if (body.role !== undefined && adminUser) {
    await logActivity(authUser.id, 'user_role_changed',
      `Changed ${targetEmail} role from ${existingUser.role as string} to ${body.role}`, ip)
  }
  if (body.active !== undefined && adminUser) {
    await logActivity(authUser.id, body.active ? 'user_activated' : 'user_deactivated',
      `${body.active ? 'Activated' : 'Deactivated'} user ${targetEmail}`, ip)
  }
  if (body.email_verified !== undefined && canVerify) {
    await logActivity(authUser.id, 'email_verified_admin',
      `${body.email_verified ? 'Approved' : 'Revoked'} email verification for ${targetEmail}`, ip)
  }
  if (body.id_verified !== undefined && canVerify) {
    if (body.id_verified) {
      // Approve any pending verification request for this user
      await db.execute({
        sql: `UPDATE verification_requests SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now') WHERE user_id = ? AND status = 'pending'`,
        args: [authUser.id, targetId],
      })
    }
    await logActivity(authUser.id, 'id_verified_admin',
      `${body.id_verified ? 'Approved' : 'Revoked'} ID verification for ${targetEmail}`, ip)
  }

  await logActivity(authUser.id, 'user_edited', `Admin edited user ${targetId}: ${Object.keys(body).join(', ')}`, ip)

  const updated = await db.execute({
    sql: `SELECT id, email, name, role, email_verified, id_verified, id_image, active, created_at, updated_at, avatar_url, bio
          FROM users WHERE id = ?`,
    args: [targetId],
  })

  return NextResponse.json({ data: { user: updated.rows[0] } })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const actorRole = authUser.role as string
  if (!['master_admin', 'admin'].includes(actorRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const targetId = parseInt(params.id, 10)
  if (isNaN(targetId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  if (authUser.id === targetId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const existing = await db.execute({
    sql: `SELECT id, email, name, role FROM users WHERE id = ?`,
    args: [targetId],
  })
  const target = existing.rows[0]
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const targetRole = target.role as string
  if (!canDelete(actorRole, targetRole)) {
    return NextResponse.json({ error: 'You can only delete users with a lower role' }, { status: 403 })
  }

  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'

  // Clean up dependent records before deleting
  await db.execute({ sql: `DELETE FROM otps WHERE user_id = ?`, args: [targetId] })
  await db.execute({ sql: `DELETE FROM verification_requests WHERE user_id = ?`, args: [targetId] })
  // Nullify user_id in logs to preserve audit history without the FK reference
  await db.execute({ sql: `UPDATE user_logs SET user_id = NULL WHERE user_id = ?`, args: [targetId] })
  await db.execute({ sql: `DELETE FROM post_reactions WHERE user_id = ?`, args: [targetId] })
  await db.execute({ sql: `DELETE FROM post_comments WHERE author_id = ?`, args: [targetId] })
  await db.execute({ sql: `UPDATE post_reports SET reporter_id = NULL WHERE reporter_id = ?`, args: [targetId] })
  await db.execute({ sql: `UPDATE comment_reports SET reporter_id = NULL WHERE reporter_id = ?`, args: [targetId] })
  await db.execute({ sql: `DELETE FROM votes WHERE voter_id = ?`, args: [targetId] })
  await db.execute({ sql: `DELETE FROM posts WHERE author_id = ?`, args: [targetId] })
  await db.execute({ sql: `UPDATE elections SET created_by = NULL WHERE created_by = ?`, args: [targetId] })
  await db.execute({ sql: `UPDATE verification_requests SET reviewed_by = NULL WHERE reviewed_by = ?`, args: [targetId] })
  await db.execute({ sql: `DELETE FROM users WHERE id = ?`, args: [targetId] })

  await logActivity(authUser.id, 'user_deleted',
    `Deleted user ${target.email as string} (role: ${targetRole})`, ip)

  return NextResponse.json({ message: 'User deleted successfully' })
}
