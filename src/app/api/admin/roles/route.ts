export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  await ensureInit()
  const auth = await getAuthUser()
  if (!auth || auth.role !== 'master_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await db.execute({ sql: `SELECT * FROM roles ORDER BY is_system DESC, name ASC`, args: [] })
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
