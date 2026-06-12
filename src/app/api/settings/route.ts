import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

const ALLOWED_KEYS = ['auto_verify_id', 'otp_required_login'] as const
type SettingKey = (typeof ALLOWED_KEYS)[number]

export async function GET(_request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await db.execute({ sql: 'SELECT key, value FROM settings', args: [] })
  const settings: Record<string, string> = {}
  for (const row of result.rows) {
    settings[row.key as string] = row.value as string
  }

  return NextResponse.json({ data: { settings } })
}

export async function PATCH(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (authUser.role !== 'master_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { key, value } = body

  if (!key || !ALLOWED_KEYS.includes(key as SettingKey)) {
    return NextResponse.json(
      { error: `Invalid key. Allowed keys: ${ALLOWED_KEYS.join(', ')}` },
      { status: 400 }
    )
  }
  if (value === undefined || value === null) {
    return NextResponse.json({ error: 'value is required' }, { status: 400 })
  }

  await db.execute({
    sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    args: [key, String(value)],
  })

  return NextResponse.json({ message: 'Setting updated', data: { key, value: String(value) } })
}
