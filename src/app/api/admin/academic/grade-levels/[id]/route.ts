export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

function requireAdmin(role: string) {
  return ['master_admin', 'teacher_admin'].includes(role)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireAdmin(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const id = parseInt(params.id)
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  await db.execute({
    sql: `UPDATE grade_levels SET name = ?, order_index = ?, active = ? WHERE id = ?`,
    args: [body.name.trim(), body.order_index ?? 0, body.active ?? 1, id],
  })
  return NextResponse.json({ message: 'Updated' })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireAdmin(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = parseInt(params.id)
  const count = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM users WHERE grade_level_id = ? AND active = 1`,
    args: [id],
  })
  const userCount = Number(count.rows[0].cnt)
  const force = request.nextUrl.searchParams.get('force') === 'true'
  if (userCount > 0 && !force) {
    return NextResponse.json({ error: 'has_users', userCount }, { status: 409 })
  }
  if (force) {
    await db.execute({
      sql: `UPDATE users SET grade_level_id = NULL, subtype_id = NULL, section_id = NULL, needs_academic_update = 1, id_verified = 0 WHERE grade_level_id = ?`,
      args: [id],
    })
  }
  await db.execute({ sql: `DELETE FROM grade_levels WHERE id = ?`, args: [id] })
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'grade_level_deleted', `Deleted grade level ${id}`, ip)
  return NextResponse.json({ message: 'Deleted' })
}
