export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

// Session 10 — admin controls for face verification (see /admin/face-verification).
export async function GET(_request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const r = await db.execute({
    sql: `SELECT id, name, email, role, avatar_url,
                 (face_descriptor IS NOT NULL) AS has_face,
                 face_skip, face_reverify_required, face_enroll_required,
                 face_report_pending, face_reported_at
          FROM users ORDER BY face_report_pending DESC, name ASC`,
    args: [],
  })
  const users = r.rows.map((u) => ({
    id: Number(u.id),
    name: String(u.name ?? ''),
    email: String(u.email ?? ''),
    role: String(u.role ?? ''),
    avatar_url: (u.avatar_url as string) ?? null,
    has_face: Number(u.has_face ?? 0) === 1,
    skip: Number(u.face_skip ?? 0) === 1,
    reverify_required: Number(u.face_reverify_required ?? 0) === 1,
    enroll_required: Number(u.face_enroll_required ?? 0) === 1,
    report_pending: Number(u.face_report_pending ?? 0) === 1,
    reported_at: (u.face_reported_at as string) ?? null,
  }))
  return NextResponse.json({ data: { users } })
}

const ACTIONS = ['prompt', 'reverify', 'skip_on', 'skip_off', 'clear_report', 'clear_face'] as const
type Action = (typeof ACTIONS)[number]

export async function PATCH(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: { userId?: number; action?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const userId = Number(body.userId)
  const action = body.action as Action
  if (!Number.isFinite(userId) || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid userId or action.' }, { status: 400 })
  }

  const SQL: Record<Action, string> = {
    // Force enroll on next login even if a descriptor exists (prompt to register).
    prompt: `UPDATE users SET face_enroll_required = 1 WHERE id = ?`,
    // Require re-registration (keeps existing descriptor until replaced).
    reverify: `UPDATE users SET face_reverify_required = 1, face_report_pending = 0, face_reported_at = NULL WHERE id = ?`,
    skip_on: `UPDATE users SET face_skip = 1 WHERE id = ?`,
    skip_off: `UPDATE users SET face_skip = 0 WHERE id = ?`,
    clear_report: `UPDATE users SET face_report_pending = 0, face_reported_at = NULL WHERE id = ?`,
    // Wipe the enrolled face entirely (they'll be prompted to enroll again).
    clear_face: `UPDATE users SET face_descriptor = NULL, face_enroll_required = 1, face_report_pending = 0, face_reported_at = NULL WHERE id = ?`,
  }
  await db.execute({ sql: SQL[action], args: [userId] })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'face_admin_action', `Face verification: '${action}' on user #${userId}`, ip)
  return NextResponse.json({ data: { ok: true } })
}
