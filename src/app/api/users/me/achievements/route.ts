export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  const result = await db.execute({
    sql: `INSERT INTO user_achievements (user_id, title, description, year, order_index) VALUES (?,?,?,?,0) RETURNING *`,
    args: [authUser.id, body.title.trim(), body.description ?? null, body.year ?? null],
  })
  return NextResponse.json({ data: result.rows[0] }, { status: 201 })
}
