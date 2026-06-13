import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const commentId = parseInt(params.commentId)
  const body = await request.json().catch(() => ({}))
  const reason = (body.reason as string | undefined)?.trim() ?? null

  await db.execute({
    sql: `INSERT OR IGNORE INTO comment_reports (comment_id, reporter_id, reason) VALUES (?,?,?)`,
    args: [commentId, authUser.id, reason],
  })
  return NextResponse.json({ message: 'Reported' })
}
