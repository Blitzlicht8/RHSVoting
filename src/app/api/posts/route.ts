export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { evaluateEligibility, getUserValueSet, EligibilityRule } from '@/lib/groups'

// Election posts are visible only to users eligible to vote in that election
// or who are candidates in it. This returns the set of election ids a
// non-admin user may see posts for. Admins see all (returns null → no gate).
async function getVisibleElectionIds(userId: number, role: string): Promise<number[] | null> {
  if (isAdmin(role)) return null

  const elections = await db.execute({ sql: `SELECT id, is_global FROM elections`, args: [] })
  const ids = new Set<number>()

  const scopedIds: number[] = []
  for (const e of elections.rows) {
    if (Number(e.is_global)) ids.add(Number(e.id))
    else scopedIds.push(Number(e.id))
  }

  if (scopedIds.length > 0) {
    const rulesResult = await db.execute({
      sql: `SELECT election_id, structure_id, value_id, is_all_groups, is_exclude
            FROM election_eligibility_rules
            WHERE election_id IN (${scopedIds.map(() => '?').join(',')})`,
      args: scopedIds,
    })
    const rulesByElection = new Map<number, EligibilityRule[]>()
    for (const r of rulesResult.rows) {
      const eid = Number(r.election_id)
      const list = rulesByElection.get(eid) ?? []
      list.push({
        structure_id: r.structure_id === null ? null : Number(r.structure_id),
        value_id: r.value_id === null ? null : Number(r.value_id),
        is_all_groups: Number(r.is_all_groups),
        is_exclude: Number(r.is_exclude),
      })
      rulesByElection.set(eid, list)
    }
    const valueSet = await getUserValueSet(userId)
    for (const eid of scopedIds) {
      if (evaluateEligibility(rulesByElection.get(eid) ?? [], valueSet)) ids.add(eid)
    }
  }

  // Candidates can always see posts for elections they run in.
  const cand = await db.execute({
    sql: `SELECT DISTINCT election_id FROM candidates WHERE user_id = ? OR student_user_id = ?`,
    args: [userId, userId],
  })
  for (const c of cand.rows) ids.add(Number(c.election_id))

  return Array.from(ids)
}

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
  return NextResponse.json({ data: { posts: result.rows, page } })
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

  // Approval workflow: when require_post_approval is on, non-admin posts start
  // pending (hidden from feed until an admin approves). Admins auto-approve.
  const sRow = await db.execute({
    sql: `SELECT value FROM settings WHERE key = 'require_post_approval'`,
    args: [],
  })
  const requireApproval = String(sRow.rows[0]?.value) === 'true'
  const status = requireApproval && !isAdmin(authUser.role) ? 'pending' : 'approved'

  const result = await db.execute({
    sql: `INSERT INTO posts (author_id, election_id, content, is_public, status) VALUES (?,?,?,?,?) RETURNING id`,
    args: [authUser.id, electionId, body.content, isPublic, status],
  })
  const postId = Number(result.rows[0].id)
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'post_created', `Created ${isPublic ? 'public' : 'election'} post${status === 'pending' ? ' (pending approval)' : ''}`, ip)
  return NextResponse.json({ data: { id: postId, status } }, { status: 201 })
}
