export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const allowed = ['master_admin', 'teacher_admin']
  if (!allowed.includes(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 50
  const offset = (page - 1) * limit
  const search = searchParams.get('q') ?? ''

  let sql = `
    SELECT l.id, l.action, l.details, l.ip, l.created_at,
           u.email, u.name, u.role
    FROM user_logs l
    LEFT JOIN users u ON l.user_id = u.id
  `
  const args: (string | number)[] = []
  if (search) {
    sql += ` WHERE l.action LIKE ? OR u.email LIKE ? OR l.details LIKE ?`
    args.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  sql += ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`
  args.push(limit, offset)

  const result = await db.execute({ sql, args })

  // total count
  let countSql = `SELECT COUNT(*) as count FROM user_logs l LEFT JOIN users u ON l.user_id = u.id`
  const countArgs: (string | number)[] = []
  if (search) {
    countSql += ` WHERE l.action LIKE ? OR u.email LIKE ? OR l.details LIKE ?`
    countArgs.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  const countResult = await db.execute({ sql: countSql, args: countArgs })

  return NextResponse.json({
    data: {
      logs: result.rows,
      total: Number(countResult.rows[0]?.count ?? 0),
      page,
      totalPages: Math.ceil(Number(countResult.rows[0]?.count ?? 0) / limit),
    },
  })
}
