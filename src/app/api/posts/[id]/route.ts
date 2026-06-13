export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { Role } from '@/types'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const postId = parseInt(params.id)
  const post = await db.execute({ sql: `SELECT author_id FROM posts WHERE id=?`, args: [postId] })
  if (!post.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (post.rows[0].author_id !== authUser.id && !isAdmin(authUser.role as Role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.execute({ sql: `DELETE FROM posts WHERE id=?`, args: [postId] })
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'post_deleted', `Deleted post ${postId}`, ip)
  return NextResponse.json({ message: 'Deleted' })
}
