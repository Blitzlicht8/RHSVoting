export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/logger'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const auth = await getAuthUser()
  if (!auth || !['master_admin', 'admin'].includes(auth.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await hasPermission(auth.role, 'viewReports')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { action } = await req.json()
  const id = parseInt(params.id)
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (action === 'delete_comment') {
    const r = await db.execute({ sql: `SELECT comment_id FROM comment_reports WHERE id=?`, args: [id] })
    if (r.rows[0]) await db.execute({ sql: `DELETE FROM post_comments WHERE id=?`, args: [(r.rows[0] as any).comment_id] })
    await db.execute({ sql: `UPDATE comment_reports SET status='resolved', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`, args: [auth.id, id] })
    await logActivity(auth.id, 'report_resolved', `Resolved comment report ${id} (comment deleted)`, ip)
  } else {
    await db.execute({ sql: `UPDATE comment_reports SET status='dismissed', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`, args: [auth.id, id] })
    await logActivity(auth.id, 'report_dismissed', `Dismissed comment report ${id}`, ip)
  }
  return NextResponse.json({ message: 'Updated' })
}
