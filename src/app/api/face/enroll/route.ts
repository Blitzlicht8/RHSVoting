export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

// Session 10 — store a client-computed face descriptor for the logged-in user
// (registration prompt or admin-requested re-enroll). Clears the enroll/reverify/
// report flags. Server does no face compute — only validates + stores.
export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { descriptor?: unknown } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const d = body.descriptor
  if (!Array.isArray(d) || d.length !== 128 || !d.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return NextResponse.json({ error: 'A valid face descriptor (128 numbers) is required.' }, { status: 400 })
  }

  await db.execute({
    sql: `UPDATE users SET
            face_descriptor = ?,
            face_enroll_required = 0,
            face_reverify_required = 0,
            face_report_pending = 0,
            face_reported_at = NULL,
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [JSON.stringify(d), authUser.id],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'face_enrolled', 'Registered/updated face for verification', ip)
  return NextResponse.json({ data: { enrolled: true } })
}
