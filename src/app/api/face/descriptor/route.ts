export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// Session 10 (experimental) — returns the caller's stored face descriptor for
// the client-side login comparison. Kept OFF the app-wide /api/auth/me endpoint
// so a missing column / large payload can never break normal auth. Tolerant:
// any error (e.g. column absent on an un-migrated DB) resolves to null.
export async function GET(_request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let descriptor: number[] | null = null
  try {
    const r = await db.execute({ sql: 'SELECT face_descriptor FROM users WHERE id = ?', args: [authUser.id] })
    const raw = r.rows[0]?.face_descriptor as string | null | undefined
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === 128) descriptor = parsed
    }
  } catch {
    descriptor = null
  }
  return NextResponse.json({ data: { descriptor } })
}
