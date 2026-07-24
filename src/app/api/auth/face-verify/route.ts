export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

// Session 10 (experimental) — records the client-computed face-match result at
// login. The comparison itself happens in the browser (descriptor never leaves
// the device); this endpoint only trusts and logs the boolean outcome. It is an
// ADDITIVE factor layered on top of the existing password + OTP auth — it does
// not grant or deny the session on its own.
export async function POST(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { matched?: boolean; distance?: number; skipped?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const dist = typeof body.distance === 'number' ? body.distance.toFixed(3) : 'n/a'

  if (body.skipped) {
    await logActivity(authUser.id, 'face_verify_skipped', 'Face verification skipped at login (no camera or user choice)', ip)
  } else if (body.matched) {
    await logActivity(authUser.id, 'face_verified', `Face verified at login (distance ${dist})`, ip)
  } else {
    await logActivity(authUser.id, 'face_verify_failed', `Face did not match at login (distance ${dist})`, ip)
  }

  return NextResponse.json({ data: { recorded: true } })
}
