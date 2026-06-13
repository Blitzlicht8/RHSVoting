export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string; candidateId: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db.execute({
    sql: `SELECT c.id, c.name, c.bio, c.photo_url, c.user_id,
                 p.name as position_name, e.title as election_name
          FROM candidates c
          JOIN positions p ON p.id = c.position_id
          JOIN elections e ON e.id = p.election_id
          WHERE c.id = ? AND e.id = ?`,
    args: [parseInt(params.candidateId), parseInt(params.id)],
  })

  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: result.rows[0] })
}
