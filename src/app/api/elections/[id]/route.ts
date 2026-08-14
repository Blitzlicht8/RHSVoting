export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { ElectionStatus, Position, Candidate } from '@/types'
import type { InValue } from '@/lib/db'
import { checkAutoTransition } from '@/lib/autoTransition'
import { logActivity } from '@/lib/logger'
import { buildEligibilitySql, EligibilityRule, getUserValueSet, evaluateEligibility } from '@/lib/groups'

interface EligibilityInput {
  structure_id?: number | null
  value_id?: number | null
  is_all_groups?: number | boolean
  is_exclude?: number | boolean
}

async function loadEligibilityRules(electionId: number): Promise<EligibilityRule[]> {
  const r = await db.execute({
    sql: `SELECT structure_id, value_id, is_all_groups, is_exclude
          FROM election_eligibility_rules WHERE election_id = ?`,
    args: [electionId],
  })
  return r.rows.map((row) => ({
    structure_id: row.structure_id === null ? null : Number(row.structure_id),
    value_id: row.value_id === null ? null : Number(row.value_id),
    is_all_groups: Number(row.is_all_groups),
    is_exclude: Number(row.is_exclude),
  }))
}

interface AchievementInput {
  title?: string
  description?: string
  year?: number
}

interface CandidateInput {
  name?: string
  bio?: string
  platform?: string | null
  qualifications?: string | null
  achievements?: AchievementInput[]
  grade_level?: string
  subtype?: string | null
  section?: string
  grade_level_id?: number | null
  subtype_id?: number | null
  section_id?: number | null
  student_user_id?: number | null
  photo_url?: string | null
}

interface PositionInput {
  name?: string
  max_votes?: number
  max_votes_mode?: string
  candidates?: CandidateInput[]
}

async function syncPositions(electionId: number, positions: PositionInput[]) {
  await db.execute({ sql: 'DELETE FROM positions WHERE election_id = ?', args: [electionId] })
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    const posName = (pos.name ?? '').trim()
    if (!posName) continue
    const posResult = await db.execute({
      sql: `INSERT INTO positions (election_id, name, max_votes, max_votes_mode, order_index) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      args: [electionId, posName, pos.max_votes ?? 1, pos.max_votes_mode ?? 'custom', i],
    })
    const posId = Number(posResult.lastInsertRowid)
    for (const cand of pos.candidates ?? []) {
      const candName = (cand.name ?? '').trim()
      if (!candName) continue
      const candResult = await db.execute({
        sql: `INSERT INTO candidates (election_id, position_id, name, bio, platform, qualifications, grade_level, subtype, section, grade_level_id, subtype_id, section_id, student_user_id, user_id, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [electionId, posId, candName, cand.bio ?? null, cand.platform ?? null, cand.qualifications ?? null, cand.grade_level ?? null, cand.subtype ?? null, cand.section ?? null, cand.grade_level_id ?? null, cand.subtype_id ?? null, cand.section_id ?? null, cand.student_user_id ?? null, cand.student_user_id ?? null, cand.photo_url ?? null],
      })
      const candId = Number(candResult.lastInsertRowid)
      if (Array.isArray(cand.achievements) && cand.achievements.length > 0) {
        for (const ach of cand.achievements) {
          const achTitle = (ach.title ?? '').trim()
          if (!achTitle) continue
          await db.execute({
            sql: `INSERT INTO candidate_achievements (candidate_id, title, description, year) VALUES (?, ?, ?, ?)`,
            args: [candId, achTitle, ach.description ?? null, ach.year ?? null],
          })
        }
      }
    }
  }
}

const VALID_TRANSITIONS: Record<ElectionStatus, ElectionStatus | null> = {
  draft: 'active',
  active: 'ended',
  ended: null,
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const electionId = parseInt(params.id, 10)
  if (isNaN(electionId)) {
    return NextResponse.json({ error: 'Invalid election ID' }, { status: 400 })
  }

  // Run lazy auto-transition before reading election state
  await checkAutoTransition(electionId).catch(() => {})

  const electionResult = await db.execute({
    sql: 'SELECT * FROM elections WHERE id = ?',
    args: [electionId],
  })
  const election = electionResult.rows[0]

  if (!election) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  const admin = isAdmin(authUser.role)
  if (!admin && !['active', 'ended'].includes(election.status as string)) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  const positionsResult = await db.execute({
    sql: 'SELECT * FROM positions WHERE election_id = ? ORDER BY order_index ASC',
    args: [electionId],
  })
  const positions = positionsResult.rows as unknown as Position[]

  const candidatesResult = await db.execute({
    sql: `SELECT c.id, c.position_id, c.election_id, c.name, c.bio, c.platform, c.qualifications,
                 c.grade_level, c.subtype, c.section,
                 c.grade_level_id, c.subtype_id, c.section_id,
                 c.student_user_id, c.user_id,
                 COALESCE(u.avatar_url, c.photo_url) AS photo_url
          FROM candidates c
          LEFT JOIN users u ON u.id = COALESCE(c.student_user_id, c.user_id)
          WHERE c.election_id = ?`,
    args: [electionId],
  })
  const candidates = candidatesResult.rows as unknown as Candidate[]

  // Fetch achievements for all candidates in this election
  const achievementsMap: Record<number, object[]> = {}
  if (candidates.length > 0) {
    const achResult = await db.execute({
      sql: `SELECT * FROM candidate_achievements WHERE candidate_id IN (${candidates.map(() => '?').join(',')}) ORDER BY year DESC`,
      args: candidates.map((c) => c.id),
    })
    for (const row of achResult.rows) {
      const cid = Number(row.candidate_id)
      if (!achievementsMap[cid]) achievementsMap[cid] = []
      achievementsMap[cid].push(row)
    }
  }

  const positionsWithCandidates = positions.map((pos) => ({
    ...pos,
    candidates: candidates
      .filter((c) => c.position_id === pos.id)
      .map((c) => ({ ...c, achievements: achievementsMap[Number(c.id)] ?? [] })),
  }))

  const voteCountResult = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM votes WHERE election_id = ? AND voter_id = ?',
    args: [electionId, authUser.id],
  })
  const hasVoted = Number(voteCountResult.rows[0]?.count ?? 0) > 0

  const eligibility = await loadEligibilityRules(electionId)

  // Whether this user is eligible to vote: admins and global elections always
  // eligible; scoped elections evaluate the rules against the user's group values.
  let eligible: boolean
  if (admin || election.is_global) {
    eligible = true
  } else {
    const valueSet = await getUserValueSet(authUser.id as number)
    eligible = evaluateEligibility(eligibility, valueSet)
  }

  // Direct-by-ID access must honor the same hiding the list endpoint applies:
  // a non-eligible, non-visible-to-all viewer cannot fetch election detail.
  if (!admin && !eligible && !election.visible_to_all) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  return NextResponse.json({
    data: { election: { ...election, positions: positionsWithCandidates, hasVoted, eligibility: admin ? eligibility : [], eligible } },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!(await hasPermission(authUser.role, 'manageElections'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const electionId = parseInt(params.id, 10)
  if (isNaN(electionId)) {
    return NextResponse.json({ error: 'Invalid election ID' }, { status: 400 })
  }

  const existingResult = await db.execute({
    sql: 'SELECT * FROM elections WHERE id = ?',
    args: [electionId],
  })
  const existing = existingResult.rows[0]
  if (!existing) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  const body = await request.json()

  // Visibility/warning toggles are a separate granular capability.
  const touchesVisibility =
    (body.visible_to_all !== undefined && !!body.visible_to_all !== !!existing.visible_to_all) ||
    (body.warn_non_voters !== undefined && !!body.warn_non_voters !== !!existing.warn_non_voters)
  if (touchesVisibility && !(await hasPermission(authUser.role, 'manageElectionVisibility'))) {
    return NextResponse.json({ error: 'Forbidden — missing election visibility permission' }, { status: 403 })
  }

  const setClauses: string[] = []
  const values: InValue[] = []

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }
    setClauses.push('title = ?')
    values.push(body.title.trim())
  }

  if (body.description !== undefined) {
    setClauses.push('description = ?')
    values.push(body.description ?? null)
  }

  if (body.start_date !== undefined) {
    if (isNaN(new Date(body.start_date).getTime())) {
      return NextResponse.json({ error: 'Invalid start_date' }, { status: 400 })
    }
    setClauses.push('start_date = ?')
    values.push(body.start_date)
  }

  if (body.end_date !== undefined) {
    if (isNaN(new Date(body.end_date).getTime())) {
      return NextResponse.json({ error: 'Invalid end_date' }, { status: 400 })
    }
    setClauses.push('end_date = ?')
    values.push(body.end_date)
  }

  if (body.status !== undefined && body.status !== existing.status) {
    const currentStatus = existing.status as ElectionStatus
    const allowedNext = VALID_TRANSITIONS[currentStatus]
    if (body.status !== allowedNext) {
      return NextResponse.json(
        { error: `Invalid status transition: ${currentStatus} -> ${body.status}. Allowed: ${allowedNext ?? 'none'}` },
        { status: 400 }
      )
    }
    if (body.status === 'active') {
      const posCheck = await db.execute({ sql: `SELECT COUNT(*) AS cnt FROM positions WHERE election_id = ?`, args: [electionId] })
      if (Number((posCheck.rows[0] as unknown as { cnt: number }).cnt) === 0) {
        return NextResponse.json({ error: 'Cannot start — election has no positions.' }, { status: 400 })
      }
      const emptPositions = await db.execute({
        sql: `SELECT p.name FROM positions p
              LEFT JOIN candidates c ON c.position_id = p.id
              WHERE p.election_id = ?
              GROUP BY p.id, p.name
              HAVING COUNT(c.id) = 0`,
        args: [electionId],
      })
      if (emptPositions.rows.length > 0) {
        const names = emptPositions.rows.map((r: any) => `"${r.name}"`).join(', ')
        return NextResponse.json(
          { error: `Cannot start — the following positions have no candidates: ${names}` },
          { status: 400 }
        )
      }
      // Resolve eligible_auto positions: compute eligible voter count and set max_votes
      const autoPositions = await db.execute({
        sql: `SELECT id FROM positions WHERE election_id = ? AND max_votes_mode = 'eligible_auto'`,
        args: [electionId],
      })
      if (autoPositions.rows.length > 0) {
        const elecRow = await db.execute({ sql: `SELECT is_global FROM elections WHERE id = ?`, args: [electionId] })
        const isGlobal = !!(elecRow.rows[0] as unknown as { is_global: number })?.is_global
        let eligibleCount: number
        if (isGlobal) {
          const r = await db.execute({ sql: `SELECT COUNT(*) as cnt FROM users WHERE id_verified = 1 AND active = 1`, args: [] })
          eligibleCount = Number((r.rows[0] as unknown as { cnt: number }).cnt)
        } else {
          const rules = await loadEligibilityRules(electionId)
          const { sql: eligSql, args: eligArgs } = buildEligibilitySql(rules, 'u')
          const r = await db.execute({
            sql: `SELECT COUNT(*) as cnt FROM users u
                  WHERE u.id_verified = 1 AND u.active = 1 AND ${eligSql}`,
            args: eligArgs,
          })
          eligibleCount = Number((r.rows[0] as unknown as { cnt: number }).cnt)
        }
        for (const pos of autoPositions.rows) {
          await db.execute({
            sql: `UPDATE positions SET max_votes = ? WHERE id = ?`,
            args: [Math.max(1, eligibleCount), Number(pos.id)],
          })
        }
      }
    }
    setClauses.push('status = ?')
    values.push(body.status)
  }

  const nextIsGlobal = body.is_global !== undefined ? !!body.is_global : !!existing.is_global
  const flippedToGlobal = body.is_global !== undefined && nextIsGlobal && !existing.is_global

  if (body.is_global !== undefined) {
    setClauses.push('is_global = ?')
    values.push(nextIsGlobal ? 1 : 0)
  }

  if (body.allow_teacher_vote !== undefined) {
    setClauses.push('allow_teacher_vote = ?')
    values.push(body.allow_teacher_vote ? 1 : 0)
  }

  // Only scoped elections carry visible_to_all. Normalize it to 0 whenever the
  // election is (or becomes) global — even if the caller didn't send it — so a
  // stale visible_to_all=1 can't survive a scoped→global flip.
  if (body.visible_to_all !== undefined || (body.is_global !== undefined && nextIsGlobal)) {
    setClauses.push('visible_to_all = ?')
    values.push(!nextIsGlobal && body.visible_to_all ? 1 : 0)
  }

  if (body.thumbnail_url !== undefined) {
    setClauses.push('thumbnail_url = ?')
    values.push(typeof body.thumbnail_url === 'string' ? body.thumbnail_url : null)
  }

  if (body.warn_non_voters !== undefined) {
    setClauses.push('warn_non_voters = ?')
    values.push(body.warn_non_voters ? 1 : 0)
  }

  if (body.auto_start !== undefined) {
    setClauses.push('auto_start = ?')
    values.push(body.auto_start ? 1 : 0)
  }

  if (body.auto_end !== undefined) {
    setClauses.push('auto_end = ?')
    values.push(body.auto_end ? 1 : 0)
  }

  const hasPositions = Array.isArray(body.positions)
  const hasEligibility = Array.isArray(body.eligibility)

  if (setClauses.length === 0 && !hasPositions && !hasEligibility) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = datetime('now')")
    values.push(electionId)
    await db.execute({
      sql: `UPDATE elections SET ${setClauses.join(', ')} WHERE id = ?`,
      args: values,
    })
  }

  if (hasPositions) {
    const currentStatus = existing.status as string
    if (currentStatus !== 'draft') {
      return NextResponse.json({ error: 'Positions can only be modified on draft elections' }, { status: 400 })
    }
    await syncPositions(electionId, body.positions as PositionInput[])
  }

  // Flipping a scoped election to global drops its eligibility rules even when
  // the caller didn't resend eligibility — otherwise stale rules reappear if it
  // is later flipped back to scoped.
  if (flippedToGlobal && !hasEligibility) {
    await db.execute({
      sql: 'DELETE FROM election_eligibility_rules WHERE election_id = ?',
      args: [electionId],
    })
  }

  if (hasEligibility) {
    await db.execute({
      sql: 'DELETE FROM election_eligibility_rules WHERE election_id = ?',
      args: [electionId],
    })
    for (const rule of body.eligibility as EligibilityInput[]) {
      await db.execute({
        sql: `INSERT INTO election_eligibility_rules (election_id, structure_id, value_id, is_all_groups, is_exclude)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          electionId,
          rule.structure_id ?? null,
          rule.value_id ?? null,
          rule.is_all_groups ? 1 : 0,
          rule.is_exclude ? 1 : 0,
        ],
      })
    }
  }

  // Immediate auto-transition check — handles "start/end time already in the past" on save
  await checkAutoTransition(electionId).catch(() => {})

  // Log visibility / warning toggle changes (Session 8 activity logging).
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const changes: string[] = []
  if (body.visible_to_all !== undefined && !!body.visible_to_all !== !!existing.visible_to_all) {
    changes.push(`visible to non-eligible groups ${body.visible_to_all ? 'ON' : 'OFF'}`)
  }
  if (body.warn_non_voters !== undefined && !!body.warn_non_voters !== !!existing.warn_non_voters) {
    changes.push(`non-voter penalty warning ${body.warn_non_voters ? 'ON' : 'OFF'}`)
  }
  if (changes.length > 0) {
    await logActivity(authUser.id, 'election_visibility_changed', `Election ${electionId} "${existing.title as string}": ${changes.join(', ')}`, ip)
  }

  const updated = await db.execute({ sql: 'SELECT * FROM elections WHERE id = ?', args: [electionId] })
  return NextResponse.json({ data: { election: updated.rows[0] } })
}

const ROLE_LEVEL: Record<string, number> = {
  master_admin: 4, admin: 3, moderator: 2, staff: 1, member: 0,
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!(await hasPermission(authUser.role, 'manageElections'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const electionId = parseInt(params.id, 10)
  if (isNaN(electionId)) {
    return NextResponse.json({ error: 'Invalid election ID' }, { status: 400 })
  }

  const existingResult = await db.execute({
    sql: 'SELECT id, status, title FROM elections WHERE id = ?',
    args: [electionId],
  })
  const existing = existingResult.rows[0]
  if (!existing) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  const status = existing.status as string
  const userLevel = ROLE_LEVEL[authUser.role as string] ?? 0
  const confirmed = request.nextUrl.searchParams.get('confirm') === 'true'

  const deleteElection = async () => {
    // votes FK has no CASCADE — must delete manually before the election row
    await db.execute({ sql: 'DELETE FROM votes WHERE election_id = ?', args: [electionId] })
    await db.execute({ sql: 'DELETE FROM elections WHERE id = ?', args: [electionId] })
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
    await logActivity(authUser.id, 'election_deleted', `Deleted ${status} election ${electionId} "${existing.title as string}"`, ip)
  }

  if (status === 'draft') {
    await deleteElection()
    return NextResponse.json({ message: 'Election deleted successfully' })
  }

  if (status === 'active') {
    if (userLevel < 3) {
      return NextResponse.json({ error: 'Only admin or master_admin can delete active elections' }, { status: 403 })
    }
    if (!confirmed) {
      const voteResult = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM votes WHERE election_id = ?', args: [electionId] })
      const voteCount = Number(voteResult.rows[0]?.cnt ?? 0)
      return NextResponse.json({ requiresConfirm: true, voteCount }, { status: 409 })
    }
    await deleteElection()
    return NextResponse.json({ message: 'Election deleted successfully' })
  }

  if (status === 'ended') {
    if (authUser.role !== 'master_admin') {
      return NextResponse.json({ error: 'Only master_admin can delete ended elections' }, { status: 403 })
    }
    if (!confirmed) {
      const voteResult = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM votes WHERE election_id = ?', args: [electionId] })
      const voteCount = Number(voteResult.rows[0]?.cnt ?? 0)
      return NextResponse.json({ requiresConfirm: true, voteCount }, { status: 409 })
    }
    await deleteElection()
    return NextResponse.json({ message: 'Election deleted successfully' })
  }

  return NextResponse.json({ error: 'Unknown election status' }, { status: 400 })
}
