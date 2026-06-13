import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

export async function GET() {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db.execute({
    sql: `SELECT u.id, u.email, u.name, u.role, u.email_verified, u.id_verified,
                 u.avatar_url, u.grade_level_id, u.subtype_id, u.section_id, u.active,
                 u.needs_academic_update,
                 gl.name as grade_level_name,
                 gs.name as subtype_name,
                 s.name as section_name
          FROM users u
          LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
          LEFT JOIN grade_subtypes gs ON gs.id = u.subtype_id
          LEFT JOIN sections s ON s.id = u.section_id
          WHERE u.id = ?`,
    args: [authUser.id],
  })

  const achievements = await db.execute({
    sql: `SELECT * FROM user_achievements WHERE user_id = ? ORDER BY order_index, id`,
    args: [authUser.id],
  })

  const user = result.rows[0]
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: { user, achievements: achievements.rows } })
}

export async function PATCH(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const sets: string[] = []
  const vals: (string | number | null)[] = []

  if (body.name !== undefined) {
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    sets.push('name = ?'); vals.push(body.name.trim())
  }
  if (body.avatar_url !== undefined) { sets.push('avatar_url = ?'); vals.push(body.avatar_url) }
  if (body.grade_level_id !== undefined) {
    sets.push('grade_level_id = ?'); vals.push(body.grade_level_id)
    sets.push('subtype_id = ?'); vals.push(body.subtype_id ?? null)
    sets.push('section_id = ?'); vals.push(body.section_id ?? null)
    // Changing academic info resets verification and clears the update flag
    sets.push('id_verified = ?'); vals.push(0)
    sets.push('needs_academic_update = ?'); vals.push(0)
  }

  if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  sets.push("updated_at = datetime('now')")
  vals.push(authUser.id)

  await db.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args: vals })
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const changed = Object.keys(body).join(', ')
  await logActivity(authUser.id, 'profile_updated', `Updated profile fields: ${changed}`, ip)
  return NextResponse.json({ message: 'Updated' })
}
