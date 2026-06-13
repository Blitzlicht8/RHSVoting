import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const postId = parseInt(params.id)
  const reason = body.reason ?? null
  await db.execute({
    sql: `INSERT OR IGNORE INTO post_reports (post_id, reporter_id, reason) VALUES (?,?,?)`,
    args: [postId, authUser.id, reason],
  })
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'post_reported', `Reported post ${postId}: ${reason}`, ip)
  return NextResponse.json({ message: 'Reported' })
}
