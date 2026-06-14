export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'

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
    sql: `SELECT id_verified, grade_level_id, subtype_id, section_id FROM users WHERE id = ?`,
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

  // Check eligibility rules
  const eligibilityResult = await db.execute({
    sql: `SELECT * FROM election_eligibility WHERE election_id = ? AND is_exclude = 0`,
    args: [election.id],
  })
  const rules = eligibilityResult.rows

  if (rules.length === 0) {
    return NextResponse.json({
      data: { electionId: election.id, title: election.title, eligible: false, reason: 'No eligibility rules configured for this election.' },
    })
  }

  const eligible = rules.some((rule) => {
    if (rule.is_all_grade) return true
    if (rule.grade_level_id !== u.grade_level_id) return false
    if (rule.is_all_subtype) return true
    if (rule.subtype_id && rule.subtype_id !== u.subtype_id) return false
    if (rule.is_all_section) return true
    if (rule.section_id && rule.section_id !== u.section_id) return false
    return true
  })

  if (!eligible) {
    return NextResponse.json({
      data: { electionId: election.id, title: election.title, eligible: false, reason: "You're not eligible for this election." },
    })
  }

  return NextResponse.json({ data: { electionId: election.id, title: election.title, eligible: true } })
}
