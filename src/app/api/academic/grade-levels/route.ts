import { NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'

export async function GET() {
  await ensureInit()
  const result = await db.execute({
    sql: `SELECT id, name, order_index FROM grade_levels WHERE active = 1 ORDER BY order_index, name`,
    args: [],
  })
  return NextResponse.json({ data: result.rows })
}
