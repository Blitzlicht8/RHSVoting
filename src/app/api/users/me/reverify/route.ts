export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

// User-initiated re-verification: drop back to unverified and clear ID verification
// so the /verify-id flow re-runs (re-select groups + resubmit document).
// master_admin keeps its role (mirrors PATCH /api/users/[id] id_verified=0 behavior)
// to avoid orphaning admin access, but still resets verification state.
export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.execute({
    sql: `UPDATE users SET
            id_verified = 0,
            verification_status = NULL,
            role = CASE WHEN role = 'master_admin' THEN role ELSE 'unverified' END,
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [authUser.id],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'reverification_started', 'User started re-verification from profile', ip)

  return NextResponse.json({ message: 'Re-verification started' })
}
