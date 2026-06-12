import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  await db.execute({
    sql: `INSERT OR IGNORE INTO post_reports (post_id, reporter_id, reason) VALUES (?,?,?)`,
    args: [parseInt(params.id), authUser.id, body.reason ?? null],
  })
  return NextResponse.json({ message: 'Reported' })
}
