export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

// User-initiated re-verification: clear ID verification so the /verify-id flow
// re-runs (re-select groups + resubmit document). Only a plain `member` is demoted
// to `unverified`; privileged roles (staff/moderator/admin/master_admin) keep their
// role so re-verifying never strips admin permissions.
export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.execute({
    sql: `UPDATE users SET
            id_verified = 0,
            verification_status = NULL,
            role = CASE WHEN role = 'member' THEN 'unverified' ELSE role END,
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [authUser.id],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'reverification_started', 'User started re-verification from profile', ip)

  return NextResponse.json({ message: 'Re-verification started' })
}
