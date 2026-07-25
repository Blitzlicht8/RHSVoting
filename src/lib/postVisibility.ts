import { db } from '@/lib/db'
import { isAdmin } from '@/lib/auth'
import { evaluateEligibility, getUserValueSet, EligibilityRule } from '@/lib/groups'

// Election posts are visible only to users eligible to vote in that election
// or who are candidates in it. This returns the set of election ids a
// non-admin user may see posts for. Admins see all (returns null → no gate).
export async function getVisibleElectionIds(userId: number, role: string): Promise<number[] | null> {
  if (isAdmin(role)) return null

  const elections = await db.execute({ sql: `SELECT id, is_global, visible_to_all FROM elections`, args: [] })
  const ids = new Set<number>()

  const scopedIds: number[] = []
  for (const e of elections.rows) {
    // Global or visible-to-all elections are visible to everyone; their posts
    // follow the same rule (the election page itself is visible to them).
    if (Number(e.is_global) || Number(e.visible_to_all)) ids.add(Number(e.id))
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
