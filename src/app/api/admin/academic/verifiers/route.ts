export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { InValue } from '@libsql/client'

export async function GET(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const userId = searchParams.get('userId')

  // User search mode: eligible users (moderator+) with their own group fields for pre-selection
  if (search !== null) {
    const result = await db.execute({
      sql: `SELECT id, name, role, avatar_url, grade_level_id, subtype_id, section_id
            FROM users
            WHERE role IN ('moderator', 'admin', 'master_admin')
              AND active = 1
              AND (name LIKE ? OR email LIKE ?)
            ORDER BY name
            LIMIT 20`,
      args: [`%${search}%`, `%${search}%`],
    })
    return NextResponse.json({ data: result.rows })
  }

  // Per-user mode: all verifier assignments for a given user
  if (userId) {
    const result = await db.execute({
      sql: `SELECT gv.id, gv.user_id, gv.grade_level_id, gv.subtype_id, gv.section_id, gv.created_at,
                   u.name AS user_name, u.role AS user_role, u.avatar_url AS user_avatar_url
            FROM group_verifiers gv
            JOIN users u ON u.id = gv.user_id
            WHERE gv.user_id = ?
            ORDER BY gv.grade_level_id, gv.subtype_id, gv.section_id`,
      args: [parseInt(userId)],
    })
    return NextResponse.json({ data: result.rows })
  }

  // All-verifiers mode: return every assignment with grade/subtype/section names
  const result = await db.execute({
    sql: `SELECT gv.id, gv.user_id, gv.grade_level_id, gv.subtype_id, gv.section_id,
                 u.name AS user_name, u.role AS user_role, u.avatar_url AS user_avatar_url,
                 gl.name AS grade_name, st.name AS subtype_name, sec.name AS section_name
          FROM group_verifiers gv
          JOIN users u ON u.id = gv.user_id
          LEFT JOIN grade_levels gl ON gl.id = gv.grade_level_id
          LEFT JOIN grade_subtypes st ON st.id = gv.subtype_id
          LEFT JOIN sections sec ON sec.id = gv.section_id
          ORDER BY u.name, gl.name, st.name, sec.name`,
    args: [],
  })

  return NextResponse.json({ data: result.rows })
}

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { user_id, grade_level_id, subtype_id, section_id } = body

  if (!user_id || !grade_level_id)
    return NextResponse.json({ error: 'user_id and grade_level_id required' }, { status: 400 })

  const userCheck = await db.execute({
    sql: `SELECT id FROM users WHERE id = ? AND role IN ('moderator', 'admin', 'master_admin') AND active = 1`,
    args: [user_id],
  })
  if (!userCheck.rows.length)
    return NextResponse.json({ error: 'User must be moderator or above' }, { status: 400 })

  // Duplicate check (SQLite UNIQUE treats NULLs as distinct, so check manually)
  const dupResult = await db.execute({
    sql: `SELECT id FROM group_verifiers
          WHERE user_id = ?
            AND grade_level_id = ?
            AND ${subtype_id != null ? 'subtype_id = ?' : 'subtype_id IS NULL'}
            AND ${section_id != null ? 'section_id = ?' : 'section_id IS NULL'}`,
    args: [
      user_id,
      grade_level_id,
      ...(subtype_id != null ? [subtype_id] : []),
      ...(section_id != null ? [section_id] : []),
    ],
  })
  if (dupResult.rows.length)
    return NextResponse.json({ error: 'Already a verifier for this group' }, { status: 409 })

  const result = await db.execute({
    sql: `INSERT INTO group_verifiers (user_id, grade_level_id, subtype_id, section_id)
          VALUES (?, ?, ?, ?) RETURNING *`,
    args: [user_id, grade_level_id, subtype_id ?? null, section_id ?? null],
  })

  return NextResponse.json({ data: result.rows[0] }, { status: 201 })
}
