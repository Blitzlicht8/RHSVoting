export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'

interface EligibilityRule {
  grade_level_id: number | null
  subtype_id: number | null
  section_id: number | null
  is_all_grade: boolean
  is_all_subtype: boolean
  is_all_section: boolean
  is_exclude: boolean
}

export async function GET(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const isGlobal = searchParams.get('is_global') === 'true'

  let eligibilityRules: EligibilityRule[] = []
  const filterParam = searchParams.get('filter')
  if (filterParam) {
    try { eligibilityRules = JSON.parse(filterParam) } catch {}
  }

  if (!q) return NextResponse.json({ data: { members: [] } })

  const conditions: string[] = ['u.id_verified = 1', 'u.active = 1']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: any[] = []

  conditions.push('(u.name LIKE ? OR u.email LIKE ?)')
  args.push(`%${q}%`, `%${q}%`)

  if (!isGlobal && eligibilityRules.length > 0) {
    const includedRules = eligibilityRules.filter((r) => !r.is_exclude)
    const hasAllGrade = includedRules.some((r) => r.is_all_grade)

    if (!hasAllGrade && includedRules.length > 0) {
      const orClauses: string[] = []
      for (const r of includedRules) {
        if (r.section_id) {
          orClauses.push('(u.grade_level_id = ? AND u.section_id = ?)')
          args.push(r.grade_level_id, r.section_id)
        } else if (r.subtype_id) {
          orClauses.push('(u.grade_level_id = ? AND u.subtype_id = ?)')
          args.push(r.grade_level_id, r.subtype_id)
        } else if (r.grade_level_id) {
          orClauses.push('u.grade_level_id = ?')
          args.push(r.grade_level_id)
        }
      }
      if (orClauses.length > 0) {
        conditions.push(`(${orClauses.join(' OR ')})`)
      }
    }
  }

  const where = conditions.join(' AND ')

  const result = await db.execute({
    sql: `SELECT u.id, u.name, u.email, u.avatar_url,
                 gl.name as grade_name, s.name as section_name,
                 u.grade_level_id, u.subtype_id, u.section_id
          FROM users u
          LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
          LEFT JOIN sections s ON s.id = u.section_id
          WHERE ${where}
          ORDER BY u.name ASC
          LIMIT 20`,
    args,
  })

  return NextResponse.json({ data: { members: result.rows } })
}
