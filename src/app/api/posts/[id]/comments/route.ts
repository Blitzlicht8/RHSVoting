export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await db.execute({
    sql: `SELECT c.id, c.author_id, c.content, c.created_at, u.name as author_name, u.avatar_url as author_avatar
          FROM post_comments c JOIN users u ON u.id = c.author_id
          WHERE c.post_id = ? ORDER BY c.created_at ASC`,
    args: [parseInt(params.id)],
  })
  return NextResponse.json({ data: result.rows })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const vRow = await db.execute({ sql: `SELECT id_verified FROM users WHERE id = ?`, args: [authUser.id] })
  if (!Number(vRow.rows[0]?.id_verified)) {
    return NextResponse.json({ error: 'Account not yet verified.' }, { status: 403 })
  }
  const body = await request.json()
  if (!body.content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })
  const result = await db.execute({
    sql: `INSERT INTO post_comments (post_id, author_id, content) VALUES (?,?,?) RETURNING id, content, created_at`,
    args: [parseInt(params.id), authUser.id, body.content.trim()],
  })
  const avatarRow = await db.execute({ sql: `SELECT avatar_url FROM users WHERE id = ?`, args: [authUser.id] })
  return NextResponse.json({
    data: { ...result.rows[0], author_id: authUser.id, author_name: authUser.name, author_avatar: avatarRow.rows[0]?.avatar_url ?? null }
  }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const commentId = parseInt(searchParams.get('commentId') ?? '')
  if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 })

  const postId = parseInt(params.id)
  const commentRow = await db.execute({
    sql: `SELECT c.author_id, p.author_id as post_author_id FROM post_comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ? AND c.post_id = ?`,
    args: [commentId, postId],
  })
  if (!commentRow.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const row = commentRow.rows[0]
  const isAdmin = ['master_admin', 'teacher_admin', 'student_admin'].includes(authUser.role as string)
  const isCommentOwner = Number(row.author_id) === authUser.id
  const isPostOwner = Number(row.post_author_id) === authUser.id
  if (!isAdmin && !isCommentOwner && !isPostOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.execute({ sql: `DELETE FROM post_comments WHERE id = ?`, args: [commentId] })
  return NextResponse.json({ message: 'Deleted' })
}
