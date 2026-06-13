export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'

export async function GET(request: NextRequest) {
  await ensureInit()
  const gradeLevelId = request.nextUrl.searchParams.get('gradeLevelId')
  if (!gradeLevelId) return NextResponse.json({ error: 'gradeLevelId required' }, { status: 400 })
  const result = await db.execute({
    sql: `SELECT id, grade_level_id, name, order_index FROM grade_subtypes WHERE grade_level_id = ? AND active = 1 ORDER BY order_index, name`,
    args: [parseInt(gradeLevelId)],
  })
  return NextResponse.json({ data: result.rows })
}
