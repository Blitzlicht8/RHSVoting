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

  const verReqResult = await db.execute({
    sql: 'SELECT id, user_id, status FROM verification_requests WHERE id = ?',
    args: [requestId],
  })
  const verReq = verReqResult.rows[0]

  if (!verReq) {
    return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  const idVerified = action === 'approve' ? 1 : 0

  if (action === 'approve') {
    await db.batch(
      [
        {
          sql: `UPDATE verification_requests
                SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), notes = ?
                WHERE id = ?`,
          args: [newStatus, authUser.id, notes ?? null, requestId],
        },
        {
          sql: `UPDATE users SET id_verified = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [idVerified, Number(verReq.user_id)],
        },
        {
          // Sync grade_level_id, subtype_id, section_id from the verification request to the user
          sql: `UPDATE users
                SET grade_level_id = (SELECT grade_level_id FROM verification_requests WHERE id = ?),
                    subtype_id     = (SELECT subtype_id     FROM verification_requests WHERE id = ?),
                    section_id     = (SELECT section_id     FROM verification_requests WHERE id = ?)
                WHERE id = (SELECT user_id FROM verification_requests WHERE id = ?)`,
          args: [requestId, requestId, requestId, requestId],
        },
      ],
      'write'
    )
  } else {
    await db.batch(
      [
        {
          sql: `UPDATE verification_requests
                SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), notes = ?
                WHERE id = ?`,
          args: [newStatus, authUser.id, notes ?? null, requestId],
        },
        {
          sql: `UPDATE users SET id_verified = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [idVerified, Number(verReq.user_id)],
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
  await logActivity(authUser.id, `verification_${newStatus}`, `${newStatus} verification for user ${userId}`, ip)

  return NextResponse.json({ data: { request: updated.rows[0] }, message: `Verification ${newStatus}` })
}
