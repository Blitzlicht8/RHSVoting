export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { getVisibleElectionIds } from '@/lib/postVisibility'

export async function GET(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = request.nextUrl
  const statusFilter = url.searchParams.get('status') // admin moderation: 'pending' | 'approved' | 'rejected'
  const electionId = url.searchParams.get('electionId')
  // Accept both `userId` and legacy `author_id` (profile page) for the author filter.
  const userId = url.searchParams.get('userId') ?? url.searchParams.get('author_id')
  const page = parseInt(url.searchParams.get('page') ?? '1')
  const limit = 20
  const offset = (page - 1) * limit

  const visibleElectionIds = await getVisibleElectionIds(authUser.id, authUser.role)

  // electionId filter: gate non-eligible users out of an election's posts.
  if (electionId) {
    const eid = parseInt(electionId)
    if (visibleElectionIds !== null && !visibleElectionIds.includes(eid)) {
      return NextResponse.json({ data: { posts: [], page } })
    }
  }

  let sql = `SELECT p.*, u.name as author_name, u.avatar_url as author_avatar,
             e.title as election_title,
             (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) as reaction_count,
             (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comment_count,
             (SELECT 1 FROM post_reactions pr2 WHERE pr2.post_id = p.id AND pr2.user_id = ?) as user_reacted
             FROM posts p JOIN users u ON u.id = p.author_id
             LEFT JOIN elections e ON e.id = p.election_id
             WHERE 1=1`
  const args: (string | number | null)[] = [authUser.id]

  // Visibility clause for non-admins: a post is visible if it is public, or it
  // is tied to an election the user may see. Admins (null) bypass this.
  const electionVisibility = () => {
    if (visibleElectionIds === null) return '' // admin
    if (visibleElectionIds.length === 0) return ` AND p.is_public = 1`
    return ` AND (p.is_public = 1 OR p.election_id IN (${visibleElectionIds.map(() => '?').join(',')}))`
  }

  if (electionId) {
    sql += ` AND p.election_id = ?`; args.push(parseInt(electionId))
  } else if (userId) {
    sql += ` AND p.author_id = ?`; args.push(parseInt(userId))
    const clause = electionVisibility()
    sql += clause
    if (clause.includes('IN (')) args.push(...visibleElectionIds!)
  } else {
    if (visibleElectionIds === null) {
      // admin main feed: public + all election posts
    } else if (visibleElectionIds.length === 0) {
      sql += ` AND p.is_public = 1`
    } else {
      sql += ` AND (p.is_public = 1 OR p.election_id IN (${visibleElectionIds.map(() => '?').join(',')}))`
      args.push(...visibleElectionIds)
    }
  }

  // Approval gate: non-admins never see others' pending/rejected posts; authors
  // still see their own (so they know it's awaiting approval). Admins see all,
  // and can filter by status for the moderation page.
  if (visibleElectionIds !== null) {
    sql += ` AND (p.status = 'approved' OR p.author_id = ?)`
    args.push(authUser.id)
  } else if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
    sql += ` AND p.status = ?`
    args.push(statusFilter)
  }

  sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
  args.push(limit, offset)

  const result = await db.execute({ sql, args })

  // Admin moderation views (?status=…) need an unpaginated total so badges/counts
  // don't cap at the page limit.
  let total: number | undefined
  if (visibleElectionIds === null && statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
    const c = await db.execute({ sql: `SELECT COUNT(*) AS cnt FROM posts WHERE status = ?`, args: [statusFilter] })
    total = Number(c.rows[0]?.cnt ?? 0)
  }

  return NextResponse.json({ data: { posts: result.rows, page, total } })
}

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vRow = await db.execute({ sql: `SELECT id_verified, timeout_until FROM users WHERE id = ?`, args: [authUser.id] })
  if (!Number(vRow.rows[0]?.id_verified)) {
    return NextResponse.json({ error: 'Account not yet verified. Verify your identity to post.' }, { status: 403 })
  }
  const timeoutUntil = vRow.rows[0]?.timeout_until as string | null
  if (timeoutUntil && new Date(timeoutUntil).getTime() > Date.now()) {
    return NextResponse.json(
      { error: `You are timed out until ${new Date(timeoutUntil).toLocaleString()} and cannot create posts.` },
      { status: 403 }
    )
  }

  const body = await request.json()
  if (!body.content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  // Election-scoped post: verify the author may post to that election, and force
  // it non-public so it is only served to eligible voters/candidates.
  const electionId = body.election_id ? parseInt(String(body.election_id)) : null
  let isPublic = body.is_public ? 1 : 0
  if (electionId) {
    const visible = await getVisibleElectionIds(authUser.id, authUser.role)
    if (visible !== null && !visible.includes(electionId)) {
      return NextResponse.json({ error: 'You are not eligible to post to this election.' }, { status: 403 })
    }
    isPublic = 0
  }

  // Approval workflow: non-admin posts start pending (hidden from feed until an
  // admin approves) only when approval is required AND not auto-approving. The
  // two settings are mutually exclusive but read both defensively. Admins always
  // auto-approve.
  const sRow = await db.execute({
    sql: `SELECT key, value FROM settings WHERE key IN ('require_post_approval', 'auto_approve_posts')`,
    args: [],
  })
  const sMap: Record<string, string> = {}
  for (const r of sRow.rows) sMap[r.key as string] = String(r.value)
  const requireApproval = sMap.require_post_approval === 'true'
  const autoApprove = sMap.auto_approve_posts === 'true'
  const needsApproval = requireApproval && !autoApprove && !isAdmin(authUser.role)
  const status = needsApproval ? 'pending' : 'approved'

  const result = await db.execute({
    sql: `INSERT INTO posts (author_id, election_id, content, is_public, status) VALUES (?,?,?,?,?) RETURNING id`,
    args: [authUser.id, electionId, body.content, isPublic, status],
  })
  const postId = Number(result.rows[0].id)
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'post_created', `Created ${isPublic ? 'public' : 'election'} post${status === 'pending' ? ' (pending approval)' : ''}`, ip)
  return NextResponse.json({ data: { id: postId, status } }, { status: 201 })
}
