export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

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
  const row = await db.execute({ sql: `SELECT is_system FROM roles WHERE id=?`, args: [id] })
  if ((row.rows[0] as any)?.is_system === 1) return NextResponse.json({ error: 'System role cannot be edited' }, { status: 403 })
  const { name, permissions } = await req.json()
  await db.execute({ sql: `UPDATE roles SET name=?, permissions=? WHERE id=?`, args: [name, JSON.stringify(permissions), id] })
  return NextResponse.json({ message: 'Updated' })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const row = await db.execute({ sql: `SELECT is_system FROM roles WHERE id=?`, args: [id] })
  if ((row.rows[0] as any)?.is_system === 1) return NextResponse.json({ error: 'System role cannot be deleted' }, { status: 403 })
  const users = await db.execute({ sql: `SELECT COUNT(*) as c FROM users WHERE role_id=?`, args: [id] })
  if (Number((users.rows[0] as any)?.c) > 0) return NextResponse.json({ error: 'Role has assigned members' }, { status: 400 })
  await db.execute({ sql: `DELETE FROM roles WHERE id=?`, args: [id] })
  return NextResponse.json({ message: 'Deleted' })
}
