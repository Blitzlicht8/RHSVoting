export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string; candidateId: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db.execute({
    sql: `SELECT c.id, c.name, c.bio, c.platform, c.qualifications, c.grade_level, c.subtype, c.section,
                 COALESCE(u.avatar_url, c.photo_url) AS photo_url,
                 COALESCE(c.student_user_id, c.user_id) AS user_id,
                 p.id as position_id, p.name as position_name, e.title as election_name
          FROM candidates c
          JOIN positions p ON p.id = c.position_id
          JOIN elections e ON e.id = p.election_id
          LEFT JOIN users u ON u.id = COALESCE(c.student_user_id, c.user_id)
          WHERE c.id = ? AND e.id = ?`,
    args: [parseInt(params.candidateId), parseInt(params.id)],
  })

  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const achievementsResult = await db.execute({
    sql: `SELECT id, title, description, year FROM candidate_achievements WHERE candidate_id = ? ORDER BY year DESC, id DESC`,
    args: [parseInt(params.candidateId)],
  })

  return NextResponse.json({ data: { ...result.rows[0], achievements: achievementsResult.rows } })
}
