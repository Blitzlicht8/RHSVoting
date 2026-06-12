import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(_request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await db.execute({
    sql: 'SELECT id, email, name, role, email_verified, id_verified, id_image, active, created_at FROM users WHERE id = ?',
    args: [authUser.id],
  })
  const user = result.rows[0]

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ data: { user } })
}
