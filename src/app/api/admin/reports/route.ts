export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'admin'].includes(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const postReports = await db.execute({
    sql: `SELECT pr.id, 'post' as type, pr.post_id as target_id,
                 SUBSTR(p.content,1,120) as target_content,
                 ru.name as reporter_name, au.name as author_name,
                 pr.reason, pr.status, pr.created_at
          FROM post_reports pr
          JOIN posts p ON p.id=pr.post_id
          JOIN users ru ON ru.id=pr.reporter_id
          JOIN users au ON au.id=p.author_id
          WHERE pr.status='pending' ORDER BY pr.created_at DESC LIMIT 50`,
    args: [],
  })
  const commentReports = await db.execute({
    sql: `SELECT cr.id, 'comment' as type, cr.comment_id as target_id,
                 SUBSTR(c.content,1,120) as target_content,
                 ru.name as reporter_name, au.name as author_name,
                 cr.reason, cr.status, cr.created_at
          FROM comment_reports cr
          JOIN post_comments c ON c.id=cr.comment_id
          JOIN users ru ON ru.id=cr.reporter_id
          JOIN users au ON au.id=c.author_id
          WHERE cr.status='pending' ORDER BY cr.created_at DESC LIMIT 50`,
    args: [],
  })
  const combined = [...postReports.rows, ...commentReports.rows]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return NextResponse.json({ data: combined })
}
