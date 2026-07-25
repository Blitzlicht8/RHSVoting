export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

function requireWrite(role: string) {
  return ['master_admin', 'admin'].includes(role)
}

interface AssignmentRow {
  structure_id: number
  structure_name: string
  value_id: number
  value_name: string
}

export async function GET(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const userId = searchParams.get('userId')

  // Search mode: moderator+ users with their existing verifier assignments
  if (search !== null) {
    const users = await db.execute({
      sql: `SELECT id, name, email, role
            FROM users
            WHERE role IN ('moderator', 'admin', 'master_admin')
              AND active = 1
              AND (name LIKE ? OR email LIKE ?)
            ORDER BY name
            LIMIT 20`,
      args: [`%${search}%`, `%${search}%`],
    })
    const data = []
    for (const u of users.rows) {
      const a = await db.execute({
        sql: `SELECT gvv.structure_id, s.name AS structure_name, gvv.value_id, v.name AS value_name
              FROM group_verifier_values gvv
              JOIN group_structures s ON s.id = gvv.structure_id
              JOIN group_values v ON v.id = gvv.value_id
              WHERE gvv.user_id = ?
              ORDER BY s.order_index, v.order_index`,
        args: [Number(u.id)],
      })
      data.push({
        id: Number(u.id),
        name: u.name,
        email: u.email,
        role: u.role,
        assignments: a.rows as unknown as AssignmentRow[],
      })
    }
    return NextResponse.json({ data })
  }

  // Per-user mode: all verifier assignments for a given user
  if (userId) {
    const result = await db.execute({
      sql: `SELECT gvv.id, gvv.structure_id, s.name AS structure_name, gvv.value_id, v.name AS value_name
            FROM group_verifier_values gvv
            JOIN group_structures s ON s.id = gvv.structure_id
            JOIN group_values v ON v.id = gvv.value_id
            WHERE gvv.user_id = ?
            ORDER BY s.order_index, v.order_index`,
      args: [parseInt(userId)],
    })
    return NextResponse.json({ data: result.rows })
  }

  // All-verifiers mode
  const result = await db.execute({
    sql: `SELECT gvv.id, gvv.user_id, gvv.structure_id, gvv.value_id,
                 u.name AS user_name, u.role AS user_role, u.avatar_url AS user_avatar_url,
                 s.name AS structure_name, v.name AS value_name
          FROM group_verifier_values gvv
          JOIN users u ON u.id = gvv.user_id
          JOIN group_structures s ON s.id = gvv.structure_id
          JOIN group_values v ON v.id = gvv.value_id
          ORDER BY u.name, s.order_index, v.order_index`,
    args: [],
  })
  return NextResponse.json({ data: result.rows })
}

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireWrite(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { user_id, structure_id, value_id } = body
  if (!user_id || !structure_id || !value_id)
    return NextResponse.json({ error: 'user_id, structure_id and value_id required' }, { status: 400 })

  const userCheck = await db.execute({
    sql: `SELECT id FROM users WHERE id = ? AND role IN ('moderator', 'admin', 'master_admin') AND active = 1`,
    args: [user_id],
  })
  if (!userCheck.rows.length)
    return NextResponse.json({ error: 'User must be moderator or above' }, { status: 400 })

  await db.execute({
    sql: `INSERT OR IGNORE INTO group_verifier_values (user_id, structure_id, value_id) VALUES (?, ?, ?)`,
    args: [user_id, structure_id, value_id],
  })
  const row = await db.execute({
    sql: `SELECT id FROM group_verifier_values WHERE user_id = ? AND structure_id = ? AND value_id = ?`,
    args: [user_id, structure_id, value_id],
  })
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  await logActivity(authUser.id, 'verifier_assigned', `Assigned user ${user_id} as verifier for value ${value_id} (structure ${structure_id})`, ip)
  return NextResponse.json({ data: { id: Number(row.rows[0]?.id) } }, { status: 201 })
}
