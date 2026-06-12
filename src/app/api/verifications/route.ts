import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { InValue } from '@libsql/client'

export async function GET(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)))
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: InValue[] = []

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    conditions.push('vr.status = ?')
    params.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM verification_requests vr ${where}`,
    args: params,
  })
  const total = Number(countResult.rows[0]?.count ?? 0)

  const requestsResult = await db.execute({
    sql: `SELECT vr.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
                 u.grade_level, u.section, vr.intended_role
          FROM verification_requests vr
          JOIN users u ON u.id = vr.user_id
          ${where}
          ORDER BY vr.created_at DESC
          LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  })

  return NextResponse.json({ data: { requests: requestsResult.rows, total, page, limit } })
}
