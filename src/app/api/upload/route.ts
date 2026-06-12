import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const mimeType = file.type
  const ext = ALLOWED_TYPES[mimeType]
  if (!ext) {
    return NextResponse.json({ error: 'Invalid file type. Allowed: jpeg, png, webp' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 })
  }

  const filename = `school-ids/${authUser.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const blob = await put(filename, buffer, { access: 'public', contentType: mimeType })
  const imagePath = blob.url

  await db.execute({
    sql: `UPDATE users SET id_image = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [imagePath, authUser.id],
  })

  await db.execute({
    sql: `INSERT OR REPLACE INTO verification_requests (user_id, image_path, status) VALUES (?, ?, 'pending')`,
    args: [authUser.id, imagePath],
  })

  const settingResult = await db.execute({
    sql: `SELECT value FROM settings WHERE key = 'auto_verify_id'`,
    args: [],
  })
  const autoVerify = settingResult.rows[0]?.value === 'true'

  let finalStatus = 'pending'
  if (autoVerify) {
    await db.batch(
      [
        {
          sql: `UPDATE verification_requests SET status = 'approved', reviewed_at = datetime('now') WHERE user_id = ?`,
          args: [authUser.id],
        },
        {
          sql: `UPDATE users SET id_verified = 1, updated_at = datetime('now') WHERE id = ?`,
          args: [authUser.id],
        },
      ],
      'write'
    )
    finalStatus = 'approved'
  }

  return NextResponse.json({ data: { imagePath, status: finalStatus } })
}
