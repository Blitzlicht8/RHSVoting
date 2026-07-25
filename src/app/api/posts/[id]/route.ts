export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logActivity } from '@/lib/logger'
import { getVisibleElectionIds } from '@/lib/postVisibility'
import { Role } from '@/types'

// Single post fetch — backs the canonical permalink /posts/[id]. Applies the
// same election-visibility + approval gate as the feed list so a direct link
// can't leak a post the viewer isn't allowed to see.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postId = parseInt(params.id)
  if (!Number.isFinite(postId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visibleElectionIds = await getVisibleElectionIds(authUser.id, authUser.role)

  let sql = `SELECT p.*, u.name as author_name, u.avatar_url as author_avatar,
             e.title as election_title,
             (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) as reaction_count,
             (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comment_count,
             (SELECT 1 FROM post_reactions pr2 WHERE pr2.post_id = p.id AND pr2.user_id = ?) as user_reacted
             FROM posts p JOIN users u ON u.id = p.author_id
             LEFT JOIN elections e ON e.id = p.election_id
             WHERE p.id = ?`
  const args: (string | number | null)[] = [authUser.id, postId]

  // Non-admins: post must be public or tied to a visible election, and either
  // approved or authored by the viewer.
  if (visibleElectionIds !== null) {
    if (visibleElectionIds.length === 0) {
      sql += ` AND p.is_public = 1`
    } else {
      sql += ` AND (p.is_public = 1 OR p.election_id IN (${visibleElectionIds.map(() => '?').join(',')}))`
      args.push(...visibleElectionIds)
    }
    sql += ` AND (p.status = 'approved' OR p.author_id = ?)`
    args.push(authUser.id)
  }

  const result = await db.execute({ sql, args })
  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: { post: result.rows[0] } })
}

// Admin post moderation: approve / reject a pending post.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(authUser.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await hasPermission(authUser.role as Role, 'managePostApproval'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
