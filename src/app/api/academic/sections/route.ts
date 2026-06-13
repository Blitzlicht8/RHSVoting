export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'

export async function GET(request: NextRequest) {
  await ensureInit()
  const { searchParams } = request.nextUrl
  const gradeLevelId = searchParams.get('gradeLevelId')
  const subtypeId = searchParams.get('subtypeId')
  if (!gradeLevelId) return NextResponse.json({ error: 'gradeLevelId required' }, { status: 400 })
  const result = subtypeId
    ? await db.execute({
        sql: `SELECT id, grade_level_id, subtype_id, name FROM sections WHERE grade_level_id = ? AND subtype_id = ? AND active = 1 ORDER BY name`,
        args: [parseInt(gradeLevelId), parseInt(subtypeId)],
      })
    : await db.execute({
        sql: `SELECT id, grade_level_id, subtype_id, name FROM sections WHERE grade_level_id = ? AND subtype_id IS NULL AND active = 1 ORDER BY name`,
        args: [parseInt(gradeLevelId)],
      })
  return NextResponse.json({ data: result.rows })
}
