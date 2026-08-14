export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { invalidateGroupsCache } from '@/lib/groups'
import type { InValue } from '@/lib/db'

function requireWrite(role: string) {
  return ['master_admin', 'admin'].includes(role)
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const structureId = parseInt(params.id)
  if (isNaN(structureId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const parentValueId = request.nextUrl.searchParams.get('parentValueId')
  const args: InValue[] = [structureId]
  let parentClause = ''
  if (parentValueId !== null && parentValueId !== '') {
    parentClause = 'AND gv.parent_value_id = ?'
    args.push(parseInt(parentValueId))
  }

  const result = await db.execute({
    sql: `SELECT gv.id, gv.structure_id, gv.parent_value_id, gv.name, gv.order_index, gv.active,
                 (SELECT COUNT(*) FROM user_group_values ugv WHERE ugv.value_id = gv.id) AS user_count
          FROM group_values gv
          WHERE gv.structure_id = ? ${parentClause}
          ORDER BY gv.order_index, gv.id`,
    args,
  })
  return NextResponse.json({ data: result.rows })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireWrite(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const structureId = parseInt(params.id)
  if (isNaN(structureId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  const name: string | undefined = body.name
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const parentValueId = body.parent_value_id ?? null

  const maxOrder = await db.execute({
    sql: `SELECT COALESCE(MAX(order_index),0)+1 AS next FROM group_values WHERE structure_id = ?`,
    args: [structureId],
  })
  const next = Number(maxOrder.rows[0].next)

  const result = await db.execute({
    sql: `INSERT INTO group_values (structure_id, parent_value_id, name, order_index)
          VALUES (?, ?, ?, ?)
          RETURNING id, structure_id, parent_value_id, name, order_index, active`,
    args: [structureId, parentValueId, name.trim(), next],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'group_value_created', `Created group value: ${name.trim()}`, ip)
  invalidateGroupsCache()
  return NextResponse.json({ data: result.rows[0] }, { status: 201 })
}
