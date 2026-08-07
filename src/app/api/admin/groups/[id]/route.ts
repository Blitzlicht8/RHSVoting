export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { invalidateGroupsCache } from '@/lib/groups'
import type { InValue } from '@libsql/client'

function requireWrite(role: string) {
  return ['master_admin', 'admin'].includes(role)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireWrite(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const body = await request.json()

  const sets: string[] = []
  const args: InValue[] = []
  if (body.name !== undefined) {
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    sets.push('name = ?')
    args.push(body.name.trim())
  }
  if (body.is_required !== undefined) {
    sets.push('is_required = ?')
    args.push(body.is_required ? 1 : 0)
  }
  if (body.order_index !== undefined) {
    sets.push('order_index = ?')
    args.push(Number(body.order_index))
  }
  if (body.active !== undefined) {
    sets.push('active = ?')
    args.push(body.active ? 1 : 0)
  }
  if (body.parent_structure_id !== undefined) {
    sets.push('parent_structure_id = ?')
    args.push(body.parent_structure_id ?? null)
  }
  if (!sets.length) return NextResponse.json({ error: 'No changes' }, { status: 400 })

  args.push(id)
  const result = await db.execute({
    sql: `UPDATE group_structures SET ${sets.join(', ')} WHERE id = ?
          RETURNING id, name, parent_structure_id, is_required, order_index, active`,
    args,
  })
  if (!result.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  invalidateGroupsCache()
  return NextResponse.json({ data: result.rows[0] })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireWrite(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const total = await db.execute({ sql: `SELECT COUNT(*) AS cnt FROM group_structures`, args: [] })
  if (Number(total.rows[0].cnt) <= 1)
    return NextResponse.json({ error: 'last_structure' }, { status: 400 })

  const valueCountRes = await db.execute({
    sql: `SELECT COUNT(*) AS cnt FROM group_values WHERE structure_id = ?`,
    args: [id],
  })
  const userCountRes = await db.execute({
    sql: `SELECT COUNT(DISTINCT user_id) AS cnt FROM user_group_values WHERE structure_id = ?`,
    args: [id],
  })
  const valueCount = Number(valueCountRes.rows[0].cnt)
  const userCount = Number(userCountRes.rows[0].cnt)

  const force = request.nextUrl.searchParams.get('force') === 'true'
  if ((valueCount > 0 || userCount > 0) && !force) {
    return NextResponse.json({ error: 'has_dependencies', valueCount, userCount }, { status: 409 })
  }

  // Deleting the whole structure removes the requirement itself, so affected users
  // are not left "missing a required group" — no id_verified reset needed.
  // FK ON DELETE CASCADE removes group_values, user_group_values, etc.
  await db.execute({ sql: `DELETE FROM group_structures WHERE id = ?`, args: [id] })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'group_structure_deleted', `Deleted group structure ${id}`, ip)
  invalidateGroupsCache()
  return NextResponse.json({ message: 'Deleted' })
}
