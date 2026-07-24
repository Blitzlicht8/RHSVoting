export const dynamic = 'force-dynamic'
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

  // â”€â”€ Avatar upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Post media upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  if (purpose === 'candidate') {
    const ext = IMAGE_TYPES[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: jpeg, png, webp, gif' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5 MB' }, { status: 400 })
    }
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const candidateBlob = await put(
      `candidate-photos/${authUser.id}/${timestamp}-${safeName}`,
      Buffer.from(await file.arrayBuffer()),
      { access: 'public', contentType: file.type },
    )
    return NextResponse.json({ data: { url: candidateBlob.url } })
  }

  // Legacy default/`purpose=id` verification-upload branch removed in the v1.8.1
  // QA pass: it predated the reverification refactor, wrote legacy
  // users.grade_level/section, and did INSERT OR REPLACE INTO verification_requests
  // bypassing lrn/profile_photo_url/doc_type/denied_fields — reachable by any
  // authenticated request and able to 409-lock users out of the real flow.
  // All ID/verification uploads now go through POST /api/verifications.
  return NextResponse.json({ error: 'Unsupported upload purpose' }, { status: 400 })
}
