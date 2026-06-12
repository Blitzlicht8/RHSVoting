import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = request.nextUrl
  const electionId = url.searchParams.get('electionId')
  const userId = url.searchParams.get('userId')
  const page = parseInt(url.searchParams.get('page') ?? '1')
  const limit = 20
  const offset = (page - 1) * limit

  let sql = `SELECT p.*, u.name as author_name, u.avatar_url as author_avatar,
             (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) as reaction_count,
             (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comment_count,
             (SELECT 1 FROM post_reactions pr2 WHERE pr2.post_id = p.id AND pr2.user_id = ?) as user_reacted
             FROM posts p JOIN users u ON u.id = p.author_id
             WHERE 1=1`
  const args: (string | number | null)[] = [authUser.id]

  if (electionId) { sql += ` AND p.election_id = ?`; args.push(parseInt(electionId)) }
  if (userId) { sql += ` AND p.author_id = ?`; args.push(parseInt(userId)) }
  if (!electionId && !userId) sql += ` AND p.is_public = 1`

  sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
  args.push(limit, offset)

  const result = await db.execute({ sql, args })
  return NextResponse.json({ data: { posts: result.rows, page } })
}

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const result = await db.execute({
    sql: `INSERT INTO posts (author_id, election_id, content, is_public) VALUES (?,?,?,?) RETURNING id`,
    args: [authUser.id, body.election_id ?? null, body.content, body.is_public ? 1 : 0],
  })
  const postId = Number(result.rows[0].id)
  return NextResponse.json({ data: { id: postId } }, { status: 201 })
}
