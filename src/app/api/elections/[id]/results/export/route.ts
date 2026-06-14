export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authUser.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const electionId = parseInt(params.id, 10)
  if (isNaN(electionId)) return NextResponse.json({ error: 'Invalid election ID' }, { status: 400 })

  const electionResult = await db.execute({ sql: 'SELECT title FROM elections WHERE id = ?', args: [electionId] })
  const election = electionResult.rows[0]
  if (!election) return NextResponse.json({ error: 'Election not found' }, { status: 404 })

  const positionsResult = await db.execute({
    sql: 'SELECT * FROM positions WHERE election_id = ? ORDER BY order_index ASC',
    args: [electionId],
  })

  const candidatesResult = await db.execute({
    sql: `SELECT c.name, c.position_id, COUNT(v.id) AS vote_count
          FROM candidates c
          LEFT JOIN votes v ON v.candidate_id = c.id AND v.election_id = ?
          WHERE c.election_id = ?
          GROUP BY c.id
          ORDER BY c.position_id ASC, vote_count DESC`,
    args: [electionId, electionId],
  })

  const positionMap: Record<number, string> = {}
  for (const p of positionsResult.rows as Record<string, unknown>[]) {
    positionMap[Number(p.id)] = String(p.name)
  }

  const totalPerPosition: Record<number, number> = {}
  for (const c of candidatesResult.rows as Record<string, unknown>[]) {
    const posId = Number(c.position_id)
    totalPerPosition[posId] = (totalPerPosition[posId] ?? 0) + Number(c.vote_count)
  }

  const rows: string[] = ['Candidate,Position,Votes,Percentage']
  for (const c of candidatesResult.rows as Record<string, unknown>[]) {
    const posId = Number(c.position_id)
    const votes = Number(c.vote_count)
    const total = totalPerPosition[posId] || 0
    const pct = total > 0 ? (Math.round((votes / total) * 10000) / 100).toFixed(2) : '0.00'
    const candidateName = String(c.name).replace(/"/g, '""')
    const positionName = (positionMap[posId] ?? '').replace(/"/g, '""')
    rows.push(`"${candidateName}","${positionName}",${votes},${pct}%`)
  }

  const csv = rows.join('\r\n')
  const filename = `election-${electionId}-results.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
