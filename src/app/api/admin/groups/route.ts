export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { getStructures, getStructureTree } from '@/lib/groups'

function requireWrite(role: string) {
  return ['master_admin', 'admin'].includes(role)
}

export async function GET(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tree = request.nextUrl.searchParams.get('tree')
  if (tree) {
    const structures = await getStructureTree(false)
    // user_count per value
    const counts = await db.execute({
      sql: `SELECT value_id, COUNT(*) AS cnt FROM user_group_values GROUP BY value_id`,
      args: [],
    })
    const countMap = new Map<number, number>()
    for (const row of counts.rows) countMap.set(Number(row.value_id), Number(row.cnt))
    const data = structures.map((s) => ({
      ...s,
      values: s.values.map((v) => ({ ...v, user_count: countMap.get(v.id) ?? 0 })),
    }))
    return NextResponse.json({ data })
  }

  const data = await getStructures(false)
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireWrite(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const name: string | undefined = body.name
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const parentStructureId = body.parent_structure_id ?? null
  const isRequired = body.is_required ? 1 : 0

  const maxOrder = await db.execute({
    sql: `SELECT COALESCE(MAX(order_index),0)+1 AS next FROM group_structures`,
    args: [],
  })
  const next = Number(maxOrder.rows[0].next)

  const result = await db.execute({
    sql: `INSERT INTO group_structures (name, parent_structure_id, is_required, order_index)
          VALUES (?, ?, ?, ?) RETURNING id, name, parent_structure_id, is_required, order_index, active`,
    args: [name.trim(), parentStructureId, isRequired, next],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'group_structure_created', `Created group structure: ${name.trim()}`, ip)
  return NextResponse.json({ data: result.rows[0] }, { status: 201 })
}
