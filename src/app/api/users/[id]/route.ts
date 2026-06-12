import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { Role } from '@/types'
import { InValue } from '@libsql/client'

const ALL_ROLES: Role[] = ['master_admin', 'teacher_admin', 'student_admin', 'teacher', 'student']

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
    sql: `SELECT id, email, name, role, email_verified, id_verified, id_image, active, created_at, updated_at
          FROM users WHERE id = ?`,
    args: [targetId],
  })
  const user = result.rows[0]

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ data: { user } })
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
    const adminOnlyRoles: Role[] = ['master_admin', 'teacher_admin', 'student_admin']
    if (authUser.role !== 'master_admin' && adminOnlyRoles.includes(body.role as Role)) {
      return NextResponse.json({ error: 'Only master_admin can assign admin roles' }, { status: 403 })
    }
    setClauses.push('role = ?')
    values.push(body.role)
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [targetId] })
  if (existing.rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  setClauses.push("updated_at = datetime('now')")
  values.push(targetId)

  await db.execute({
    sql: `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
    args: values,
  })

  const updated = await db.execute({
    sql: `SELECT id, email, name, role, email_verified, id_verified, id_image, active, created_at, updated_at
          FROM users WHERE id = ?`,
    args: [targetId],
  })

  return NextResponse.json({ data: { user: updated.rows[0] } })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (authUser.role !== 'master_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const targetId = parseInt(params.id, 10)
  if (isNaN(targetId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  if (authUser.id === targetId) {
    return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
  }

  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [targetId] })
  if (existing.rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await db.execute({
    sql: `UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ?`,
    args: [targetId],
  })

  return NextResponse.json({ message: 'User deactivated successfully' })
}
