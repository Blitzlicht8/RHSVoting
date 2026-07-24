export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { invalidate, CACHE_KEYS } from '@/lib/cache'

async function checkAdmin() {
  const auth = await getAuthUser()
  if (!auth || auth.role !== 'master_admin') return null
  return auth
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const row = await db.execute({ sql: `SELECT is_system, name FROM roles WHERE id=?`, args: [id] })
  const roleName = (row.rows[0] as any)?.name
  const isSystem = (row.rows[0] as any)?.is_system === 1
  const { name, permissions } = await req.json()

  if (roleName === 'master_admin') return NextResponse.json({ error: 'Master Admin role cannot be edited' }, { status: 403 })
  if (isSystem && roleName !== 'member') return NextResponse.json({ error: 'System role cannot be edited' }, { status: 403 })
  if (roleName === 'member' && permissions !== undefined) return NextResponse.json({ error: 'Member role cannot have custom permissions' }, { status: 403 })

  const updates: string[] = []
  const args: (string | number | null)[] = []
  if (name !== undefined) { updates.push('name=?'); args.push(name) }
  if (permissions !== undefined) { updates.push('permissions=?'); args.push(JSON.stringify(permissions)) }
  if (updates.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  args.push(id)
  await db.execute({ sql: `UPDATE roles SET ${updates.join(',')} WHERE id=?`, args })
  invalidate(CACHE_KEYS.rolesList)
  return NextResponse.json({ message: 'Updated' })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const row = await db.execute({ sql: `SELECT is_system, name FROM roles WHERE id=?`, args: [id] })
  const roleName = (row.rows[0] as any)?.name
  if ((row.rows[0] as any)?.is_system === 1) return NextResponse.json({ error: 'System role cannot be deleted' }, { status: 403 })
  if (roleName === 'member') return NextResponse.json({ error: 'Member role cannot be deleted' }, { status: 403 })
  if (roleName === 'master_admin') return NextResponse.json({ error: 'Master Admin role cannot be deleted' }, { status: 403 })
  const users = await db.execute({ sql: `SELECT COUNT(*) as c FROM users WHERE role_id=?`, args: [id] })
  if (Number((users.rows[0] as any)?.c) > 0) return NextResponse.json({ error: 'Role has assigned members' }, { status: 400 })
  await db.execute({ sql: `DELETE FROM roles WHERE id=?`, args: [id] })
  invalidate(CACHE_KEYS.rolesList)
  return NextResponse.json({ message: 'Deleted' })
}
