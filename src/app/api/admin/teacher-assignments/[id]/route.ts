import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'teacher_admin'].includes(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.execute({ sql: `DELETE FROM teacher_assignments WHERE id = ?`, args: [parseInt(params.id)] })
  return NextResponse.json({ message: 'Removed' })
}
