export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/logger'
import { Role } from '@/types'
import type { InValue } from '@/lib/db'
import { setUserAssignments, validateAssignmentValues, Assignment } from '@/lib/groups'

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
                 grade_level_id, subtype_id, section_id, avatar_url, bio, timeout_until
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

  // Current configurable group assignments (for the admin group editor).
  const groups = await db.execute({
    sql: `SELECT gs.id as structure_id, gs.name as structure_name, gvv.id as value_id, gvv.name as value_name
          FROM user_group_values ugv
          JOIN group_structures gs ON gs.id = ugv.structure_id
          JOIN group_values gvv ON gvv.id = ugv.value_id
          WHERE ugv.user_id = ?
          ORDER BY gs.order_index, gs.id`,
    args: [targetId],
  })

  return NextResponse.json({ data: {
    user,
    documents: docs.rows.map(r => ({ id: Number(r.id), file_path: String(r.file_path) })),
    groups: groups.rows.map(r => ({ structure_id: Number(r.structure_id), value_id: Number(r.value_id) })),
  } })
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

  // Admin-only user-management fields require the manageUsers scope (self-edits
  // of name/bio are exempt; timeout additionally requires manageUserPenalties below).
  const ADMIN_FIELDS = ['role', 'active', 'email', 'email_verified', 'id_verified', 'grade_level_id', 'subtype_id', 'section_id', 'timeout_days', 'assignments']
  if (adminUser && ADMIN_FIELDS.some((f) => body[f] !== undefined)) {
    if (!(await hasPermission(authUser.role as Role, 'manageUsers'))) {
      return NextResponse.json({ error: 'Forbidden — missing user management permission' }, { status: 403 })
    }
  }

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
    if (body.role === 'unverified') {
      return NextResponse.json({ error: 'The unverified role is assigned automatically and cannot be set manually' }, { status: 403 })
    }
    if (body.role === 'master_admin' && authUser.role !== 'master_admin') {
      return NextResponse.json({ error: 'Only Master Admin can assign the Master Admin role' }, { status: 403 })
    }
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
    if (body.id_verified) {
      setClauses.push(`verification_status = 'approved'`)
    } else {
      // Revoking: revert role to unverified, mark status rejected so banner shows
      setClauses.push(`role = CASE WHEN role = 'master_admin' THEN role ELSE 'unverified' END`)
      setClauses.push(`verification_status = 'rejected'`)
    }
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

  // Timeout / penalty: admin sets timeout_days (>0 sets timeout_until N days out; 0/null clears)
  let timeoutLogMsg: string | null = null
  if (body.timeout_days !== undefined && adminUser) {
    if (!(await hasPermission(authUser.role as Role, 'manageUserPenalties'))) {
      return NextResponse.json({ error: 'Forbidden — missing user penalty permission' }, { status: 403 })
    }
    const days = Number(body.timeout_days)
    if (!Number.isFinite(days) || days < 0 || days > 3650) {
      return NextResponse.json({ error: 'timeout_days must be between 0 and 3650' }, { status: 400 })
    }
    if (days > 0) {
      const until = new Date(Date.now() + days * 86400000).toISOString()
      setClauses.push('timeout_until = ?')
      values.push(until)
      timeoutLogMsg = `Timed out ${existingUser.email as string} for ${days} day(s) (until ${until})`
    } else {
      setClauses.push('timeout_until = NULL')
      timeoutLogMsg = `Cleared timeout for ${existingUser.email as string}`
    }
  }

  // Admin edit of the user's configurable group values. Deliberately does NOT reset
  // id_verified: changing a user's groups must not force reverification. If the admin
  // leaves a required structure blank, the derived missing-required check flags them.
  const hasAssignments = adminUser && Array.isArray(body.assignments)
  if (hasAssignments) {
    const assignments: Assignment[] = (body.assignments as unknown[])
      .filter((a): a is Assignment =>
        !!a && typeof a === 'object' &&
        Number.isFinite(Number((a as Assignment).structure_id)) &&
        Number.isFinite(Number((a as Assignment).value_id)))
      .map(a => ({ structure_id: Number(a.structure_id), value_id: Number(a.value_id) }))
    const err = await validateAssignmentValues(assignments)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    await setUserAssignments(targetId, assignments)
  }

  if (setClauses.length === 0 && !hasAssignments) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = datetime('now')")
    values.push(targetId)

    await db.execute({
      sql: `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
      args: values,
    })
  }

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
      // Promote unverified → member on manual approve
      await db.execute({
        sql: `UPDATE users SET role = 'member', verification_status = 'approved' WHERE id = ? AND role = 'unverified'`,
        args: [targetId],
      })
    }
    await logActivity(authUser.id, 'id_verified_admin',
      `${body.id_verified ? 'Approved' : 'Revoked'} ID verification for ${targetEmail}`, ip)
  }

  if (timeoutLogMsg) {
    await logActivity(authUser.id, 'user_timeout', timeoutLogMsg, ip)
  }

  await logActivity(authUser.id, 'user_edited', `Admin edited user ${targetId}: ${Object.keys(body).join(', ')}`, ip)

  const updated = await db.execute({
    sql: `SELECT id, email, name, role, email_verified, id_verified, id_image, active, created_at, updated_at, avatar_url, bio, timeout_until
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
  if (!(await hasPermission(authUser.role as Role, 'manageUsers'))) {
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
