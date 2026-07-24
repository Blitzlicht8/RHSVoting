export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

const ALLOWED_KEYS = [
  'auto_verify_id',
  'otp_required_login',
  'app_name',
  'group_label_l1',
  'group_label_l2',
  'group_label_l3',
  'doc_type_labels',
  'org_type',
  'require_post_approval',
  'auto_approve_posts',
] as const
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

  return NextResponse.json({ data: settings })
}

export async function PATCH(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canEdit = ['master_admin', 'admin'].includes(authUser.role as string)
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { key, value } = body

  if (!key || !ALLOWED_KEYS.includes(key as SettingKey)) {
    return NextResponse.json({ error: `Invalid key. Allowed keys: ${ALLOWED_KEYS.join(', ')}` }, { status: 400 })
  }
  if (value === undefined || value === null) {
    return NextResponse.json({ error: 'value is required' }, { status: 400 })
  }

  const MASTER_ONLY_KEYS: SettingKey[] = ['app_name', 'org_type', 'group_label_l1', 'group_label_l2', 'group_label_l3', 'doc_type_labels']
  if (MASTER_ONLY_KEYS.includes(key as SettingKey) && authUser.role !== 'master_admin') {
    return NextResponse.json({ error: 'Only master_admin can change structural settings' }, { status: 403 })
  }

  const prevRow = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] })
  const prevValue = prevRow.rows[0]?.value as string | undefined

  // require_post_approval and auto_approve_posts are mutually exclusive. Enforce
  // it server-side so the client's non-atomic sequential PATCHes can never leave
  // both 'true' in the DB: setting one to 'true' forces the other to 'false'.
  const POST_APPROVAL_PAIR: Partial<Record<SettingKey, SettingKey>> = {
    require_post_approval: 'auto_approve_posts',
    auto_approve_posts: 'require_post_approval',
  }
  const counterpart = POST_APPROVAL_PAIR[key as SettingKey]
  if (counterpart && String(value) === 'true') {
    await db.batch(
      [
        { sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', args: [key, 'true'] },
        { sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', args: [counterpart, 'false'] },
      ],
      'write'
    )
  } else {
    await db.execute({
      sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      args: [key, String(value)],
    })
  }

  if (prevValue !== String(value)) {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    await logActivity(authUser.id as number, 'settings_changed', `Changed "${key}" from "${prevValue ?? '(unset)'}" to "${String(value)}"`, ip)
  }

  return NextResponse.json({ message: 'Setting updated', data: { key, value: String(value) } })
}
