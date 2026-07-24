export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { Role } from '@/types'

// Admin post moderation: approve / reject a pending post.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(authUser.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const postId = parseInt(params.id)
  const body = await request.json()
  const status = String(body.status)
  if (!['approved', 'rejected'].includes(status))
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  const post = await db.execute({ sql: `SELECT id FROM posts WHERE id=?`, args: [postId] })
  if (!post.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await db.execute({ sql: `UPDATE posts SET status=?, updated_at=datetime('now') WHERE id=?`, args: [status, postId] })
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, status === 'approved' ? 'post_approved' : 'post_rejected', `${status === 'approved' ? 'Approved' : 'Rejected'} post ${postId}`, ip)
  return NextResponse.json({ message: status })
}

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
