export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

// Session 10 — user reports being unable to pass face verification at login
// (after 3 failed attempts). Flags the account so login is blocked until an
// admin acts (Re-Verify / clear report / skip), and notifies admins via the log.
export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.execute({
    sql: `UPDATE users SET face_report_pending = 1, face_reported_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    args: [authUser.id],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'face_verify_reported', 'Reported a face verification problem at login — awaiting admin review', ip)
  return NextResponse.json({ data: { reported: true } })
}
