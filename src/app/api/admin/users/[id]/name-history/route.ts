import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'teacher_admin', 'student_admin'].includes(authUser.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const result = await db.execute({
    sql: `SELECT id, old_name, new_name, changed_at FROM name_history WHERE user_id = ? ORDER BY changed_at DESC`,
    args: [parseInt(params.id)],
  })
  return NextResponse.json({ data: result.rows })
}
