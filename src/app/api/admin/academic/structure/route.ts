export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'

export async function GET() {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !isAdmin(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [grades, subtypes, sections] = await Promise.all([
    db.execute({ sql: `SELECT id, name FROM grade_levels ORDER BY order_index, name`, args: [] }),
    db.execute({ sql: `SELECT id, grade_level_id, name FROM grade_subtypes ORDER BY order_index, name`, args: [] }),
    db.execute({ sql: `SELECT id, grade_level_id, subtype_id, name FROM sections ORDER BY order_index, name`, args: [] }),
  ])

  const structure = grades.rows.map(g => {
    const gId = Number(g.id)
    return {
      id: gId,
      name: String(g.name),
      subtypes: subtypes.rows
        .filter(st => Number(st.grade_level_id) === gId)
        .map(st => ({
          id: Number(st.id),
          name: String(st.name),
          sections: sections.rows
            .filter(sec => Number(sec.grade_level_id) === gId && sec.subtype_id != null && Number(sec.subtype_id) === Number(st.id))
            .map(sec => ({ id: Number(sec.id), name: String(sec.name) })),
        })),
      direct_sections: sections.rows
        .filter(sec => Number(sec.grade_level_id) === gId && sec.subtype_id == null)
        .map(sec => ({ id: Number(sec.id), name: String(sec.name) })),
    }
  })

  return NextResponse.json({ data: structure })
}
