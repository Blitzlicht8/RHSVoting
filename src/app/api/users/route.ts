export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import type { InValue } from '@/lib/db'

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
  const role = searchParams.get('role')
  const search = searchParams.get('search')
  const verificationStatus = searchParams.get('verification_status')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)))
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: InValue[] = []

  if (role) {
    conditions.push('role = ?')
    params.push(role)
  }
  if (verificationStatus) {
    conditions.push('verification_status = ?')
    params.push(verificationStatus)
  }
  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM users ${where}`,
    args: params,
  })
  const total = Number(countResult.rows[0]?.count ?? 0)

  const usersResult = await db.execute({
    sql: `SELECT id, email, name, role, email_verified, id_verified, id_image, active, created_at, updated_at, avatar_url, bio, grade_level_id, subtype_id, section_id, verification_status, timeout_until
          FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  })

  return NextResponse.json({ data: { users: usersResult.rows, total, page, limit } })
}
