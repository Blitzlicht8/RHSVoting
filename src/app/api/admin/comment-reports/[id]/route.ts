export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const auth = await getAuthUser()
  if (!auth || !['master_admin', 'teacher_admin', 'admin'].includes(auth.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { action } = await req.json()
  const id = parseInt(params.id)
  if (action === 'delete_comment') {
    const r = await db.execute({ sql: `SELECT comment_id FROM comment_reports WHERE id=?`, args: [id] })
    if (r.rows[0]) await db.execute({ sql: `DELETE FROM post_comments WHERE id=?`, args: [(r.rows[0] as any).comment_id] })
    await db.execute({ sql: `UPDATE comment_reports SET status='resolved', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`, args: [auth.id, id] })
  } else {
    await db.execute({ sql: `UPDATE comment_reports SET status='dismissed', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`, args: [auth.id, id] })
  }
  return NextResponse.json({ message: 'Updated' })
}
