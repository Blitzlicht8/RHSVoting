import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { reason } = await req.json().catch(() => ({}))
  await db.execute({
    sql: `INSERT OR IGNORE INTO comment_reports (comment_id, reporter_id, reason) VALUES (?,?,?)`,
    args: [parseInt(params.id), auth.id, reason ?? null],
  })
  return NextResponse.json({ message: 'Reported' })
}
