import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await db.execute({
    sql: `SELECT c.id, c.content, c.created_at, u.name as author_name, u.avatar_url as author_avatar
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
  const body = await request.json()
  if (!body.content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })
  const result = await db.execute({
    sql: `INSERT INTO post_comments (post_id, author_id, content) VALUES (?,?,?) RETURNING id, content, created_at`,
    args: [parseInt(params.id), authUser.id, body.content.trim()],
  })
  return NextResponse.json({ data: { ...result.rows[0], author_name: authUser.name } }, { status: 201 })
}
