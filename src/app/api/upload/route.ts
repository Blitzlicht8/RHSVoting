import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const ID_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
}

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

  const purpose = (formData.get('purpose') as string | null) ?? 'id'

  // ── Avatar upload ──────────────────────────────────────────────────────────
  if (purpose === 'avatar') {
    const ext = IMAGE_TYPES[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: jpeg, png, webp, gif' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5 MB' }, { status: 400 })
    }
    const timestamp = Date.now()
    const avatarFilename = `avatars/${authUser.id}-${timestamp}.${ext}`
    const avatarBuffer = Buffer.from(await file.arrayBuffer())
    const avatarBlob = await put(avatarFilename, avatarBuffer, { access: 'public', contentType: file.type })
    await db.execute({
      sql: `UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [avatarBlob.url, authUser.id],
    })
    return NextResponse.json({ data: { url: avatarBlob.url } })
  }

  // ── Post media upload ──────────────────────────────────────────────────────
  if (purpose === 'post') {
    const isImage = !!IMAGE_TYPES[file.type]
    const isVideo = !!VIDEO_TYPES[file.type]
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: images and video files' }, { status: 400 })
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 25 MB' }, { status: 400 })
    }
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const postFilename = `post-media/${authUser.id}/${timestamp}-${safeName}`
    const postBuffer = Buffer.from(await file.arrayBuffer())
    const postBlob = await put(postFilename, postBuffer, { access: 'public', contentType: file.type })
    return NextResponse.json({ data: { url: postBlob.url } })
  }

  // ── School ID upload (default / purpose='id') ──────────────────────────────
  const ext = ID_TYPES[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'Invalid file type. Allowed: jpeg, png, webp' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size exceeds 5 MB limit' }, { status: 400 })
  }

  const intendedRole = (formData.get('intended_role') as string | null) ?? null
  const gradeLevel = (formData.get('grade_level') as string | null) ?? null
  const section = (formData.get('section') as string | null) ?? null

  const filename = `school-ids/${authUser.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const blob = await put(filename, buffer, { access: 'public', contentType: file.type })
  const imagePath = blob.url

  await db.execute({
    sql: `UPDATE users SET id_image = ?, intended_role = ?, grade_level = ?, section = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [imagePath, intendedRole, gradeLevel, section, authUser.id],
  })

  await db.execute({
    sql: `INSERT OR REPLACE INTO verification_requests (user_id, image_path, status, intended_role) VALUES (?, ?, 'pending', ?)`,
    args: [authUser.id, imagePath, intendedRole],
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
