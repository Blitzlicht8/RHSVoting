export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

const ALLOWED = ['master_admin', 'admin']

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !ALLOWED.includes(authUser.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const sets: string[] = []
  const vals: (string | number | null)[] = []
  if (body.name !== undefined) { sets.push('name = ?'); vals.push(body.name.trim()) }
  if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description?.trim() ?? null) }
  if (body.required !== undefined) { sets.push('required = ?'); vals.push(body.required ? 1 : 0) }
  if (body.order_index !== undefined) { sets.push('order_index = ?'); vals.push(body.order_index) }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  vals.push(parseInt(params.id))
  await db.execute({ sql: `UPDATE verification_requirements SET ${sets.join(', ')} WHERE id = ?`, args: vals })
  return NextResponse.json({ message: 'Updated' })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !ALLOWED.includes(authUser.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await db.execute({ sql: `DELETE FROM verification_requirements WHERE id = ?`, args: [parseInt(params.id)] })
  return NextResponse.json({ message: 'Deleted' })
}
