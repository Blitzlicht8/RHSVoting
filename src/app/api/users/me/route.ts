export const dynamic = 'force-dynamic'
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
                 u.avatar_url, u.bio, u.active, u.needs_academic_update
          FROM users u
          WHERE u.id = ?`,
    args: [authUser.id],
  })

  const achievements = await db.execute({
    sql: `SELECT * FROM user_achievements WHERE user_id = ? ORDER BY order_index, id`,
    args: [authUser.id],
  })

  const user = result.rows[0]
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Configurable group assignments (replaces grade/subtype/section names)
  const groups = await db.execute({
    sql: `SELECT gs.id as structure_id, gs.name as structure_name, gvv.id as value_id, gvv.name as value_name
          FROM user_group_values ugv
          JOIN group_structures gs ON gs.id = ugv.structure_id
          JOIN group_values gvv ON gvv.id = ugv.value_id
          WHERE ugv.user_id = ?
          ORDER BY gs.order_index, gs.id`,
    args: [authUser.id],
  })

  return NextResponse.json({ data: { user, groups: groups.rows, achievements: achievements.rows } })
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
    const currentRow = await db.execute({ sql: `SELECT name FROM users WHERE id = ?`, args: [authUser.id] })
    const oldName = String(currentRow.rows[0]?.name ?? '')
    const newName = body.name.trim()
    if (oldName && oldName !== newName) {
      await db.execute({
        sql: `INSERT INTO name_history (user_id, old_name, new_name) VALUES (?,?,?)`,
        args: [authUser.id, oldName, newName],
      })
    }
    sets.push('name = ?'); vals.push(newName)
  }
  if (body.avatar_url !== undefined) { sets.push('avatar_url = ?'); vals.push(body.avatar_url) }
  if (body.bio !== undefined) { sets.push('bio = ?'); vals.push(body.bio ?? null) }
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
