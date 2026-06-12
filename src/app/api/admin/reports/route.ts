import { NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'teacher_admin'].includes(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await db.execute({
    sql: `SELECT pr.id, pr.reason, pr.status, pr.created_at,
                 p.id as post_id, p.content as post_content,
                 u.name as reporter_name, ua.name as author_name
          FROM post_reports pr
          JOIN posts p ON p.id = pr.post_id
          JOIN users u ON u.id = pr.reporter_id
          JOIN users ua ON ua.id = p.author_id
          WHERE pr.status = 'pending'
          ORDER BY pr.created_at DESC LIMIT 50`,
    args: [],
  })
  return NextResponse.json({ data: result.rows })
}
