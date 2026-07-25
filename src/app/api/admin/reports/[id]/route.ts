export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/logger'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'admin'].includes(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await hasPermission(authUser.role, 'viewReports')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const reportId = parseInt(params.id)
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'

  if (body.action === 'delete_post') {
    const report = await db.execute({ sql: `SELECT post_id FROM post_reports WHERE id=?`, args: [reportId] })
    if (report.rows[0]) {
      await db.execute({ sql: `DELETE FROM posts WHERE id=?`, args: [report.rows[0].post_id] })
    }
    await db.execute({
      sql: `UPDATE post_reports SET status='resolved', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`,
      args: [authUser.id, reportId],
    })
    await logActivity(authUser.id, 'report_resolved', `Resolved post report ${reportId} (post deleted)`, ip)
  } else {
    await db.execute({
      sql: `UPDATE post_reports SET status='dismissed', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`,
      args: [authUser.id, reportId],
    })
    await logActivity(authUser.id, 'report_dismissed', `Dismissed post report ${reportId}`, ip)
  }
  return NextResponse.json({ message: 'Updated' })
}
