export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(_request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await db.execute({
    sql: 'SELECT id, email, name, role, email_verified, id_verified, id_image, active, created_at, avatar_url, verification_status, verification_notes, needs_academic_update, bio, lrn FROM users WHERE id = ?',
    args: [authUser.id],
  })
  const user = result.rows[0]

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Latest verification request — carries field-level denial + submitted values for reverification.
  const vr = await db.execute({
    sql: `SELECT status, notes, doc_type, lrn, profile_photo_url, denied_fields, image_path
          FROM verification_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    args: [authUser.id],
  })
  const req = vr.rows[0] ?? null
  let denied_fields: string[] = []
  if (req?.denied_fields) {
    try {
      const p = JSON.parse(String(req.denied_fields))
      if (Array.isArray(p)) denied_fields = p.map(String)
    } catch {}
  }

  return NextResponse.json({
    data: {
      ...user,
      id_photo_url: req?.image_path ?? null,
      verification_notes: req?.notes ?? user.verification_notes ?? null,
      submitted_doc_type: req?.doc_type ?? null,
      submitted_lrn: req?.lrn ?? null,
      submitted_profile_photo_url: req?.profile_photo_url ?? null,
      denied_fields,
    },
  })
}
