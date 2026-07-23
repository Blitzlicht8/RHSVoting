export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth'
import { buildEligibilitySql, type EligibilityRule } from '@/lib/groups'

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
    const { sql, args: eligArgs } = buildEligibilitySql(eligibilityRules, 'u')
    conditions.push(sql)
    args.push(...eligArgs)
  }

  const where = conditions.join(' AND ')

  const result = await db.execute({
    sql: `SELECT u.id, u.name, u.email, u.avatar_url
          FROM users u
          WHERE ${where}
          ORDER BY u.name ASC
          LIMIT 20`,
    args,
  })

  return NextResponse.json({ data: { members: result.rows } })
}
