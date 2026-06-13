import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'teacher_admin'].includes(authUser.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userId = parseInt(params.id)
  const docId = parseInt(params.docId)

  const check = await db.execute({
    sql: `SELECT vd.id FROM verification_documents vd
          JOIN verification_requests vr ON vr.id = vd.verification_request_id
          WHERE vd.id = ? AND vr.user_id = ?`,
    args: [docId, userId],
  })
  if (!check.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.execute({ sql: `DELETE FROM verification_documents WHERE id = ?`, args: [docId] })
  return NextResponse.json({ message: 'Deleted' })
}
