// Server-side helpers for the configurable group-structure model.
// Structures are levels (parent_structure_id set) or standalone (null).
// Values are the selectable options; their tree is defined by parent_value_id.
import { db } from './db'
import { invalidate, CACHE_KEYS } from './cache'

/** Call after any write to group_structures / group_values so /api/groups refreshes. */
export function invalidateGroupsCache(): void {
  invalidate(CACHE_KEYS.groupsTree)
}

export interface GroupStructure {
  id: number
  name: string
  parent_structure_id: number | null
  is_required: number
  order_index: number
  active: number
}

export interface GroupValue {
  id: number
  structure_id: number
  parent_value_id: number | null
  name: string
  order_index: number
  active: number
}

export interface StructureWithValues extends GroupStructure {
  values: GroupValue[]
}

export interface EligibilityRule {
  structure_id: number | null
  value_id: number | null
  is_all_groups: number | boolean
  is_exclude: number | boolean
}

export interface Assignment {
  structure_id: number
  value_id: number
}

export async function getStructures(activeOnly = true): Promise<GroupStructure[]> {
  const r = await db.execute({
    sql: `SELECT id, name, parent_structure_id, is_required, order_index, active
          FROM group_structures ${activeOnly ? 'WHERE active = 1' : ''}
          ORDER BY order_index, id`,
    args: [],
  })
  return r.rows as unknown as GroupStructure[]
}

export async function getValues(structureId: number, activeOnly = true): Promise<GroupValue[]> {
  const r = await db.execute({
    sql: `SELECT id, structure_id, parent_value_id, name, order_index, active
          FROM group_values WHERE structure_id = ? ${activeOnly ? 'AND active = 1' : ''}
          ORDER BY order_index, id`,
    args: [structureId],
  })
  return r.rows as unknown as GroupValue[]
}

export async function getStructureTree(activeOnly = true): Promise<StructureWithValues[]> {
  const structures = await getStructures(activeOnly)
  const vr = await db.execute({
    sql: `SELECT id, structure_id, parent_value_id, name, order_index, active
          FROM group_values ${activeOnly ? 'WHERE active = 1' : ''}
          ORDER BY order_index, id`,
    args: [],
  })
  const values = vr.rows as unknown as GroupValue[]
  return structures.map((s) => ({ ...s, values: values.filter((v) => v.structure_id === s.id) }))
}

export async function getUserAssignments(userId: number): Promise<Assignment[]> {
  const r = await db.execute({
    sql: `SELECT structure_id, value_id FROM user_group_values WHERE user_id = ?`,
    args: [userId],
  })
  return r.rows as unknown as Assignment[]
}

/** Replace all of a user's group-value assignments. */
export async function setUserAssignments(userId: number, assignments: Assignment[]): Promise<void> {
  await db.execute({ sql: `DELETE FROM user_group_values WHERE user_id = ?`, args: [userId] })
  for (const a of assignments) {
    if (a.structure_id == null || a.value_id == null) continue
    await db.execute({
      sql: `INSERT OR IGNORE INTO user_group_values (user_id, structure_id, value_id) VALUES (?,?,?)`,
      args: [userId, a.structure_id, a.value_id],
    })
  }
}

/**
 * Validate a set of assignments against required active structures.
 * Returns an error message if a required structure is missing a value, else null.
 * Also verifies each provided value actually belongs to its structure.
 */
export async function validateAssignments(assignments: Assignment[]): Promise<string | null> {
  const structures = await getStructures(true)
  const byStructure = new Map<number, number>()
  for (const a of assignments) {
    if (a.structure_id != null && a.value_id != null) byStructure.set(a.structure_id, a.value_id)
  }
  for (const s of structures) {
    if (s.is_required && !byStructure.has(s.id)) {
      return `${s.name} is required`
    }
  }
  for (const [structureId, valueId] of Array.from(byStructure.entries())) {
    const r = await db.execute({
      sql: `SELECT 1 FROM group_values WHERE id = ? AND structure_id = ?`,
      args: [valueId, structureId],
    })
    if (r.rows.length === 0) return `Invalid selection for structure ${structureId}`
  }
  return null
}

export interface MissingStructure {
  id: number
  name: string
}

/**
 * Active required structures the user has NO value for. A non-empty result means
 * the user is treated as unverified for voting until they refill their groups.
 * Derived from live structures — no stored flag — so deleting a value inside a
 * required structure (or adding a new required structure) auto-flags affected users,
 * while an admin simply *changing* a user's group (still filled) never flags them.
 */
export async function getMissingRequiredStructures(userId: number): Promise<MissingStructure[]> {
  const structures = await getStructures(true)
  const required = structures.filter((s) => Number(s.is_required) === 1)
  if (required.length === 0) return []
  const assigned = await getUserAssignments(userId)
  const have = new Set(assigned.map((a) => Number(a.structure_id)))
  return required
    .filter((s) => !have.has(Number(s.id)))
    .map((s) => ({ id: Number(s.id), name: s.name }))
}

/**
 * Validate assignments as an admin edit (value-belongs-to-structure only, no
 * required-completeness check — admins may intentionally leave a required
 * structure blank, which flags the user for reverification).
 */
export async function validateAssignmentValues(assignments: Assignment[]): Promise<string | null> {
  for (const a of assignments) {
    if (a.structure_id == null || a.value_id == null) continue
    const r = await db.execute({
      sql: `SELECT 1 FROM group_values WHERE id = ? AND structure_id = ?`,
      args: [a.value_id, a.structure_id],
    })
    if (r.rows.length === 0) return `Invalid selection for structure ${a.structure_id}`
  }
  return null
}

/** In-memory view of a user's assignments for fast eligibility evaluation. */
export interface UserValueSet {
  valueIds: Set<number>
  structureIds: Set<number>
}

export async function getUserValueSet(userId: number): Promise<UserValueSet> {
  const rows = await getUserAssignments(userId)
  return {
    valueIds: new Set(rows.map((r) => Number(r.value_id))),
    structureIds: new Set(rows.map((r) => Number(r.structure_id))),
  }
}

function ruleMatches(rule: EligibilityRule, set: UserValueSet): boolean {
  if (Number(rule.is_all_groups) === 1) return true
  if (rule.value_id != null) return set.valueIds.has(Number(rule.value_id))
  if (rule.structure_id != null) return set.structureIds.has(Number(rule.structure_id))
  return false
}

/** Evaluate whether a user (by value set) is eligible under a set of rules. */
export function evaluateEligibility(rules: EligibilityRule[], set: UserValueSet): boolean {
  const includes = rules.filter((r) => !Number(r.is_exclude))
  const excludes = rules.filter((r) => Number(r.is_exclude))
  if (includes.length === 0) return false
  const included = includes.some((r) => ruleMatches(r, set))
  const excluded = excludes.some((r) => ruleMatches(r, set))
  return included && !excluded
}

/**
 * Build a SQL condition (on a users alias) that is true for eligible users.
 * Returns { sql, args } to splice into a WHERE clause. Assumes the alias has
 * column `id`. Args are ordered include-first then exclude to match the SQL.
 */
export function buildEligibilitySql(rules: EligibilityRule[], userAlias = 'u'): { sql: string; args: number[] } {
  const args: number[] = []

  const clauseFor = (subset: EligibilityRule[]): string => {
    // Emit real SQL booleans (TRUE/FALSE), not 0/1 — Postgres rejects
    // `NOT (0)` / `0 AND ...` with "argument of NOT must be type boolean".
    if (subset.some((r) => Number(r.is_all_groups) === 1)) return 'TRUE'
    const valIds = subset.filter((r) => r.value_id != null).map((r) => Number(r.value_id))
    const structIds = subset
      .filter((r) => r.value_id == null && r.structure_id != null)
      .map((r) => Number(r.structure_id))
    const conds: string[] = []
    if (valIds.length) {
      conds.push(`ugv.value_id IN (${valIds.map(() => '?').join(',')})`)
      args.push(...valIds)
    }
    if (structIds.length) {
      conds.push(`ugv.structure_id IN (${structIds.map(() => '?').join(',')})`)
      args.push(...structIds)
    }
    if (!conds.length) return 'FALSE'
    return `EXISTS (SELECT 1 FROM user_group_values ugv WHERE ugv.user_id = ${userAlias}.id AND (${conds.join(' OR ')}))`
  }

  const includes = rules.filter((r) => !Number(r.is_exclude))
  const excludes = rules.filter((r) => Number(r.is_exclude))
  const incSql = includes.length ? clauseFor(includes) : 'FALSE'
  const excSql = excludes.length ? clauseFor(excludes) : 'FALSE'
  return { sql: `(${incSql}) AND NOT (${excSql})`, args }
}
