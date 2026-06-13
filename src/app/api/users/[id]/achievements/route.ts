export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await db.execute({
    sql: `SELECT id, title, description, year FROM user_achievements WHERE user_id=? ORDER BY order_index ASC`,
    args: [parseInt(params.id)],
  })
  return NextResponse.json({ data: result.rows })
}
