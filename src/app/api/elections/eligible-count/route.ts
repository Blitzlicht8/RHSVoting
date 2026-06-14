export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'

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

  const eligibilityResult = await db.execute({
    sql: `SELECT * FROM election_eligibility WHERE election_id = ? AND is_exclude = 0`,
    args: [electionId],
  })
  const rules = eligibilityResult.rows

  if (rules.length === 0) {
    return NextResponse.json({ data: { count: 0 } })
  }

  const conditions: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: any[] = []
  let allUsers = false

  for (const rule of rules) {
    if (rule.is_all_grade) {
      allUsers = true
      break
    }
    let cond = `grade_level_id = ?`
    args.push(rule.grade_level_id)
    if (!rule.is_all_subtype && rule.subtype_id) {
      cond += ` AND subtype_id = ?`
      args.push(rule.subtype_id)
    }
    if (!rule.is_all_section && rule.section_id) {
      cond += ` AND section_id = ?`
      args.push(rule.section_id)
    }
    conditions.push(`(${cond})`)
  }

  const whereExtra = allUsers ? '' : ` AND (${conditions.join(' OR ')})`
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM users WHERE id_verified = 1 AND active = 1${whereExtra}`,
    args: allUsers ? [] : args,
  })

  return NextResponse.json({ data: { count: Number(countResult.rows[0]?.count ?? 0) } })
}
