export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requestId = parseInt(params.id, 10)
  if (isNaN(requestId)) {
    return NextResponse.json({ error: 'Invalid verification request ID' }, { status: 400 })
  }

  const body = await request.json()
  const { action, notes } = body

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
  }

  // Field-level denial: admin ticks which fields are wrong (reject only).
  const ALLOWED_DENIED = ['doc_type', 'profile_photo', 'lrn', 'groups']
  let deniedFields: string[] = []
  if (Array.isArray(body.denied_fields)) {
    deniedFields = body.denied_fields.map(String).filter((f: string) => ALLOWED_DENIED.includes(f))
  }
  if (action === 'reject' && deniedFields.length === 0) {
    return NextResponse.json({ error: 'Select at least one field to flag for resubmission.' }, { status: 400 })
  }

  const verReqResult = await db.execute({
    sql: 'SELECT id, user_id, status FROM verification_requests WHERE id = ?',
    args: [requestId],
  })
  const verReq = verReqResult.rows[0]

  if (!verReq) {
    return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  if (action === 'approve') {
    await db.batch(
      [
        {
          sql: `UPDATE verification_requests
                SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), notes = ?, denied_fields = NULL
                WHERE id = ?`,
          args: [newStatus, authUser.id, notes ?? null, requestId],
        },
        {
          sql: `UPDATE users SET id_verified = 1, verification_status = 'approved', updated_at = datetime('now') WHERE id = ?`,
          args: [Number(verReq.user_id)],
        },
        {
          // Promote unverified users to member on approval
          sql: `UPDATE users SET role = 'member' WHERE id = ? AND role = 'unverified'`,
          args: [Number(verReq.user_id)],
        },
      ],
      'write'
    )
  } else {
    await db.batch(
      [
        {
          sql: `UPDATE verification_requests
                SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), notes = ?, denied_fields = ?
                WHERE id = ?`,
          args: [newStatus, authUser.id, notes ?? null, JSON.stringify(deniedFields), requestId],
        },
        {
          sql: `UPDATE users SET id_verified = 0, verification_status = 'rejected', verification_notes = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [notes ?? null, Number(verReq.user_id)],
        },
      ],
      'write'
    )
  }

  const updated = await db.execute({
    sql: 'SELECT * FROM verification_requests WHERE id = ?',
    args: [requestId],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const userId = Number(verReq.user_id)
  const detail = action === 'reject'
    ? `rejected verification for user ${userId} (flagged: ${deniedFields.join(', ')})`
    : `${newStatus} verification for user ${userId}`
  await logActivity(authUser.id, `verification_${newStatus}`, detail, ip)

  return NextResponse.json({ data: { request: updated.rows[0] }, message: `Verification ${newStatus}` })
}
