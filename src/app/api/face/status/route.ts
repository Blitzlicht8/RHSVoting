export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// Session 10 — the caller's own face-verification state, used by the login flow
// and the app-wide FaceGate. Error-tolerant: any DB issue degrades to a safe
// "no face requirement" state so it can never lock users out on an un-migrated DB.
export async function GET(_request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let enabled = false
  let skip = false, hasDescriptor = false, reverify = false, enroll = false, reportPending = false
  let descriptor: number[] | null = null
  try {
    const s = await db.execute({ sql: `SELECT value FROM settings WHERE key = 'enable_face_verification'`, args: [] })
    enabled = String(s.rows[0]?.value ?? 'false') === 'true'
    const r = await db.execute({
      sql: `SELECT face_descriptor, face_skip, face_reverify_required, face_enroll_required, face_report_pending
            FROM users WHERE id = ?`,
      args: [authUser.id],
    })
    const row = r.rows[0]
    if (row) {
      skip = Number(row.face_skip ?? 0) === 1
      reverify = Number(row.face_reverify_required ?? 0) === 1
      enroll = Number(row.face_enroll_required ?? 0) === 1
      reportPending = Number(row.face_report_pending ?? 0) === 1
      const raw = row.face_descriptor as string | null | undefined
      if (raw) { try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length === 128) { descriptor = p; hasDescriptor = true } } catch {} }
    }
  } catch {
    return NextResponse.json({ data: { enabled: false, skip: true, hasDescriptor: false, mustEnroll: false, reportPending: false, descriptor: null } })
  }

  const active = enabled && !skip
  const mustEnroll = active && (!hasDescriptor || reverify || enroll)
  return NextResponse.json({ data: { enabled, skip, hasDescriptor, mustEnroll, reportPending, descriptor: mustEnroll ? null : descriptor } })
}
