export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  await ensureInit()
  const auth = await getAuthUser()
  if (!auth || auth.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await db.execute({
    sql: `SELECT * FROM roles ORDER BY
      CASE name
        WHEN 'master_admin' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'moderator' THEN 2
        WHEN 'staff' THEN 3
        WHEN 'member' THEN 4
        WHEN 'unverified' THEN 5
        ELSE 6
      END, name ASC`,
    args: [],
  })
  return NextResponse.json({ data: result.rows })
}

export async function POST(req: NextRequest) {
  await ensureInit()
  const auth = await getAuthUser()
  if (!auth || auth.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { name, permissions } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  await db.execute({
    sql: `INSERT INTO roles (name, permissions) VALUES (?,?)`,
    args: [name.trim().toLowerCase().replace(/\s+/g, '_'), JSON.stringify(permissions ?? {})],
  })
  return NextResponse.json({ message: 'Created' })
}
