export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { evaluateEligibility, getUserValueSet, type EligibilityRule } from '@/lib/groups'

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = params
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const electionResult = await db.execute({
    sql: `SELECT id, title, status, is_global, start_date, end_date FROM elections WHERE share_token = ?`,
    args: [token],
  })
  const election = electionResult.rows[0]
  if (!election) return NextResponse.json({ error: 'Election not found' }, { status: 404 })

  // Admins always eligible
  if (isAdmin(authUser.role)) {
    return NextResponse.json({ data: { electionId: election.id, title: election.title, eligible: true } })
  }

  // Non-admins: election must be active or ended
  if (!['active', 'ended'].includes(election.status as string)) {
    return NextResponse.json({
      data: { electionId: election.id, title: election.title, eligible: false, reason: 'This election is not currently active.' },
    })
  }

  const userResult = await db.execute({
    sql: `SELECT id_verified FROM users WHERE id = ?`,
    args: [authUser.id],
  })
  const u = userResult.rows[0]

  if (!u?.id_verified) {
    return NextResponse.json({
      data: { electionId: election.id, title: election.title, eligible: false, reason: 'Your identity must be verified to vote.' },
    })
  }

  // Global: all verified members eligible
  if (election.is_global) {
    return NextResponse.json({ data: { electionId: election.id, title: election.title, eligible: true } })
  }

  // Check eligibility rules (configurable group model)
  const eligibilityResult = await db.execute({
    sql: `SELECT structure_id, value_id, is_all_groups, is_exclude FROM election_eligibility_rules WHERE election_id = ?`,
    args: [election.id],
  })
  const rules = eligibilityResult.rows as unknown as EligibilityRule[]

  if (rules.length === 0) {
    return NextResponse.json({
      data: { electionId: election.id, title: election.title, eligible: false, reason: 'No eligibility rules configured for this election.' },
    })
  }

  const eligible = evaluateEligibility(rules, await getUserValueSet(Number(authUser.id)))

  if (!eligible) {
    return NextResponse.json({
      data: { electionId: election.id, title: election.title, eligible: false, reason: "You're not eligible for this election." },
    })
  }

  return NextResponse.json({ data: { electionId: election.id, title: election.title, eligible: true } })
}
