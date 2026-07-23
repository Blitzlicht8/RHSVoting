export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import type { InValue } from '@libsql/client'

function requireWrite(role: string) {
  return ['master_admin', 'admin'].includes(role)
}

export async function PUT(request: NextRequest, { params }: { params: { vid: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireWrite(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const vid = parseInt(params.vid)
  if (isNaN(vid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const body = await request.json()

  const sets: string[] = []
  const args: InValue[] = []
  if (body.name !== undefined) {
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    sets.push('name = ?')
    args.push(body.name.trim())
  }
  if (body.order_index !== undefined) {
    sets.push('order_index = ?')
    args.push(Number(body.order_index))
  }
  if (body.active !== undefined) {
    sets.push('active = ?')
    args.push(body.active ? 1 : 0)
  }
  if (body.parent_value_id !== undefined) {
    sets.push('parent_value_id = ?')
    args.push(body.parent_value_id ?? null)
  }
  if (!sets.length) return NextResponse.json({ error: 'No changes' }, { status: 400 })

  args.push(vid)
  const result = await db.execute({
    sql: `UPDATE group_values SET ${sets.join(', ')} WHERE id = ?
          RETURNING id, structure_id, parent_value_id, name, order_index, active`,
    args,
  })
  if (!result.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: result.rows[0] })
}

export async function DELETE(request: NextRequest, { params }: { params: { vid: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireWrite(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const vid = parseInt(params.vid)
  if (isNaN(vid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const userCountRes = await db.execute({
    sql: `SELECT COUNT(DISTINCT user_id) AS cnt FROM user_group_values WHERE value_id = ?`,
    args: [vid],
  })
  const userCount = Number(userCountRes.rows[0].cnt)

  const force = request.nextUrl.searchParams.get('force') === 'true'
  if (userCount > 0 && !force) {
    return NextResponse.json({ error: 'has_users', userCount }, { status: 409 })
  }

  if (force && userCount > 0) {
    await db.execute({
      sql: `UPDATE users SET needs_academic_update = 1, id_verified = 0
            WHERE id IN (SELECT user_id FROM user_group_values WHERE value_id = ?)`,
      args: [vid],
    })
    await db.execute({ sql: `DELETE FROM user_group_values WHERE value_id = ?`, args: [vid] })
  }

  await db.execute({ sql: `DELETE FROM group_values WHERE id = ?`, args: [vid] })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'group_value_deleted', `Deleted group value ${vid}`, ip)
  return NextResponse.json({ message: 'Deleted' })
}
