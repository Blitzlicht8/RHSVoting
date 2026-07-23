export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { buildEligibilitySql, EligibilityRule } from '@/lib/groups'

export async function GET(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const electionId = parseInt(request.nextUrl.searchParams.get('electionId') ?? '', 10)
  if (isNaN(electionId)) return NextResponse.json({ error: 'electionId required' }, { status: 400 })

  const electionResult = await db.execute({
    sql: `SELECT is_global FROM elections WHERE id = ?`,
    args: [electionId],
  })
  const election = electionResult.rows[0]
  if (!election) return NextResponse.json({ error: 'Election not found' }, { status: 404 })

  if (election.is_global) {
    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM users WHERE id_verified = 1 AND active = 1`,
      args: [],
    })
    return NextResponse.json({ data: { count: Number(countResult.rows[0]?.count ?? 0) } })
  }

  const rulesResult = await db.execute({
    sql: `SELECT structure_id, value_id, is_all_groups, is_exclude
          FROM election_eligibility_rules WHERE election_id = ?`,
    args: [electionId],
  })
  const rules: EligibilityRule[] = rulesResult.rows.map((row) => ({
    structure_id: row.structure_id === null ? null : Number(row.structure_id),
    value_id: row.value_id === null ? null : Number(row.value_id),
    is_all_groups: Number(row.is_all_groups),
    is_exclude: Number(row.is_exclude),
  }))

  if (rules.length === 0) {
    return NextResponse.json({ data: { count: 0 } })
  }

  const { sql: eligSql, args: eligArgs } = buildEligibilitySql(rules, 'u')
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM users u WHERE u.id_verified = 1 AND u.active = 1 AND ${eligSql}`,
    args: eligArgs,
  })

  return NextResponse.json({ data: { count: Number(countResult.rows[0]?.count ?? 0) } })
}
