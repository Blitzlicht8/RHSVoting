import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()

  let sql = `SELECT id, name, email, grade_level, section FROM users WHERE id_verified = 1 AND active = 1`
  const args: (string | number)[] = []

  if (q) {
    sql += ` AND (name LIKE ? OR email LIKE ?)`
    args.push(`%${q}%`, `%${q}%`)
  }

  sql += ` ORDER BY name ASC LIMIT 20`

  const result = await db.execute({ sql, args })
  return NextResponse.json({ data: { students: result.rows } })
}
