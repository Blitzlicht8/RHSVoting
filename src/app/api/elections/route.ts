export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { checkAutoTransition } from '@/lib/autoTransition'
import { evaluateEligibility, getUserValueSet, EligibilityRule } from '@/lib/groups'

interface EligibilityInput {
  structure_id?: number | null
  value_id?: number | null
  is_all_groups?: number | boolean
  is_exclude?: number | boolean
}

export async function GET(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = isAdmin(authUser.role)
  const voterIdArg = authUser.id as number

  // Pre-flight: trigger lazy auto-transitions before building the list so clients see fresh status
  const pendingTransitions = await db.execute({
    sql: `SELECT id FROM elections WHERE (status = 'draft' AND auto_start = 1) OR (status = 'active' AND auto_end = 1)`,
    args: [],
  })
  for (const row of pendingTransitions.rows) {
    await checkAutoTransition(Number(row.id)).catch(() => {})
  }

  const whereClause = admin ? '' : `WHERE e.status IN ('active', 'ended')`

  // Use a scalar subquery for hasVoted — LEFT JOIN caused N duplicate rows per election
  // when a voter had cast N votes (one per position). Subquery returns one row per election always.
  const result = await db.execute({
    sql: `SELECT
            e.*,
            (SELECT COUNT(*) FROM positions p WHERE p.election_id = e.id) AS position_count,
            (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id) AS candidate_count,
            (SELECT COUNT(*) FROM votes v WHERE v.election_id = e.id) AS vote_count,
            EXISTS(SELECT 1 FROM votes vhv WHERE vhv.election_id = e.id AND vhv.voter_id = ?) AS hasVoted
          FROM elections e
          ${whereClause}
          ORDER BY e.created_at DESC`,
    args: [voterIdArg],
  })

  let elections: Record<string, unknown>[] = result.rows as unknown as Record<string, unknown>[]

  // Load eligibility rules for all scoped (non-global) elections so we can both
  // compute per-user eligibility and expose which group structures each election
  // is scoped to (used by the elections-page group filter).
  const scopedIds = elections
    .filter((e) => !e.is_global)
    .map((e) => Number(e.id))

  const rulesByElection = new Map<number, EligibilityRule[]>()
  if (scopedIds.length > 0) {
    const rulesResult = await db.execute({
      sql: `SELECT election_id, structure_id, value_id, is_all_groups, is_exclude
            FROM election_eligibility_rules
            WHERE election_id IN (${scopedIds.map(() => '?').join(',')})`,
      args: scopedIds,
    })
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
  }

  // Distinct structure + value ids each election's include rules reference (for
  // the filter). structure_ids covers structure-wide scopes ("all of X");
  // value_ids covers specific values (e.g. a single Strand or Section).
  const scopeIdsFor = (eid: number): { structure_ids: number[]; value_ids: number[] } => {
    const rules = rulesByElection.get(eid) ?? []
    const structIds = new Set<number>()
    const valIds = new Set<number>()
    for (const r of rules) {
      if (Number(r.is_exclude)) continue
      if (r.structure_id != null) structIds.add(Number(r.structure_id))
      if (r.value_id != null) valIds.add(Number(r.value_id))
    }
    return { structure_ids: Array.from(structIds), value_ids: Array.from(valIds) }
  }

  const valueSet = admin ? null : await getUserValueSet(voterIdArg)

  elections = elections
    .map((e): Record<string, unknown> => {
      const eid = Number(e.id)
      const eligible = admin || !!e.is_global || evaluateEligibility(rulesByElection.get(eid) ?? [], valueSet!)
      return { ...e, eligible: eligible ? 1 : 0, ...scopeIdsFor(eid) }
    })
    // Non-admins only see an election if they are eligible OR it is marked
    // visible to non-eligible groups (read-only). Admins see everything.
    .filter((e) => admin || e.eligible || !!e.visible_to_all)

  return NextResponse.json({ data: { elections } })
}

interface CandidateInput {
  name?: string
  bio?: string
  grade_level?: string
  section?: string
  student_user_id?: number | null
  photo_url?: string | null
}

interface PositionInput {
  name?: string
  max_votes?: number
  candidates?: CandidateInput[]
}

async function syncPositions(electionId: number, positions: PositionInput[]) {
  await db.execute({ sql: 'DELETE FROM positions WHERE election_id = ?', args: [electionId] })
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    const posName = (pos.name ?? '').trim()
    if (!posName) continue
    const posResult = await db.execute({
      sql: `INSERT INTO positions (election_id, name, max_votes, order_index) VALUES (?, ?, ?, ?)`,
      args: [electionId, posName, pos.max_votes ?? 1, i],
    })
    const posId = Number(posResult.lastInsertRowid)
    for (const cand of pos.candidates ?? []) {
      const candName = (cand.name ?? '').trim()
      if (!candName) continue
      await db.execute({
        sql: `INSERT INTO candidates (election_id, position_id, name, bio, grade_level, section, student_user_id, user_id, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [electionId, posId, candName, cand.bio ?? null, cand.grade_level ?? null, cand.section ?? null, cand.student_user_id ?? null, cand.student_user_id ?? null, cand.photo_url ?? null],
      })
    }
  }
}

export async function POST(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, start_date, end_date } = body

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (!start_date || !end_date) {
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
  }

  const start = new Date(start_date)
  const end = new Date(end_date)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }
  if (end <= start) {
    return NextResponse.json({ error: 'end_date must be after start_date' }, { status: 400 })
  }

  const validStatuses = ['draft', 'active', 'ended']
  const status = validStatuses.includes(body.status) ? body.status : 'draft'

  const shareToken = crypto.randomUUID()
  const thumbnailUrl = typeof body.thumbnail_url === 'string' ? body.thumbnail_url : null

  const insertResult = await db.execute({
    sql: `INSERT INTO elections (title, description, start_date, end_date, status, created_by, share_token, thumbnail_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [title.trim(), description ?? null, start_date, end_date, status, authUser.id, shareToken, thumbnailUrl],
  })

  const electionId = Number(insertResult.lastInsertRowid)

  if (Array.isArray(body.positions) && body.positions.length > 0) {
    await syncPositions(electionId, body.positions)
  }

  // Save is_global, allow_teacher_vote, auto_start, auto_end
  const isGlobal = body.is_global ? 1 : 0
  const allowTeacherVote = body.allow_teacher_vote ? 1 : 0
  const autoStart = body.auto_start ? 1 : 0
  const autoEnd = body.auto_end ? 1 : 0
  // Global elections are inherently visible to everyone; only scoped elections
  // carry a meaningful visible_to_all flag.
  const visibleToAll = !isGlobal && body.visible_to_all ? 1 : 0
  const warnNonVoters = body.warn_non_voters ? 1 : 0
  await db.execute({
    sql: `UPDATE elections SET is_global = ?, allow_teacher_vote = ?, auto_start = ?, auto_end = ?, visible_to_all = ?, warn_non_voters = ? WHERE id = ?`,
    args: [isGlobal, allowTeacherVote, autoStart, autoEnd, visibleToAll, warnNonVoters, electionId],
  })

  // Save eligibility rules into the configurable-group model
  if (Array.isArray(body.eligibility) && body.eligibility.length > 0) {
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

  // Immediate auto-transition check — handles "start/end time already in the past" on create
  await checkAutoTransition(electionId).catch(() => {})

  const election = await db.execute({
    sql: 'SELECT * FROM elections WHERE id = ?',
    args: [electionId],
  })

  return NextResponse.json({ data: { election: election.rows[0] } }, { status: 201 })
}
