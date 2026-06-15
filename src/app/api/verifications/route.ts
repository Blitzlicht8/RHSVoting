export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { InValue } from '@libsql/client'

const MAX_FILES = 3

export async function GET(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowedRoles = ['master_admin', 'admin', 'moderator', 'staff']
  if (!allowedRoles.includes(authUser.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page   = Math.max(1, parseInt(searchParams.get('page')  || '1',  10))
  const limit  = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)))
  const offset = (page - 1) * limit

  const role = authUser.role as string

  const conditions: string[] = []
  const params: InValue[]    = []

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    conditions.push('vr.status = ?')
    params.push(status)
  }

  let where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  // Staff only see requests for their assigned grades/sections
  if (role === 'staff') {
    const teacherCondition = `(
      vr.grade_level_id IN (SELECT grade_level_id FROM teacher_assignments WHERE teacher_id = ${authUser.id} AND grade_level_id IS NOT NULL)
      OR vr.section_id IN (SELECT section_id FROM teacher_assignments WHERE teacher_id = ${authUser.id} AND section_id IS NOT NULL)
    )`
    where = where ? `${where} AND ${teacherCondition}` : `WHERE ${teacherCondition}`
  }

  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM verification_requests vr ${where}`,
    args: params,
  })
  const total = Number(countResult.rows[0]?.count ?? 0)

  const requestsResult = await db.execute({
    sql: `SELECT vr.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
                 u.avatar_url AS user_avatar_url, u.grade_level, u.section,
                 vr.grade_level_id, vr.subtype_id, vr.section_id, vr.doc_type,
                 gl.name AS grade_level_name, gs.name AS subtype_name, s.name AS section_name
          FROM verification_requests vr
          JOIN users u ON u.id = vr.user_id
          LEFT JOIN grade_levels gl ON gl.id = vr.grade_level_id
          LEFT JOIN grade_subtypes gs ON gs.id = vr.subtype_id
          LEFT JOIN sections s ON s.id = vr.section_id
          ${where}
          ORDER BY vr.created_at DESC
          LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  })

  const requests   = requestsResult.rows
  const requestIds = requests.map(r => Number(r.id))

  let documentsMap: Record<number, Array<{id: number, file_path: string}>> = {}
  if (requestIds.length > 0) {
    const placeholders = requestIds.map(() => '?').join(',')
    const docsResult = await db.execute({
      sql: `SELECT id, verification_request_id, file_path FROM verification_documents WHERE verification_request_id IN (${placeholders})`,
      args: requestIds,
    })
    for (const doc of docsResult.rows) {
      const rid = Number(doc.verification_request_id)
      if (!documentsMap[rid]) documentsMap[rid] = []
      documentsMap[rid].push({ id: Number(doc.id), file_path: String(doc.file_path) })
    }
  }

  const enriched = requests.map(r => ({
    ...r,
    documents: documentsMap[Number(r.id)] ?? [],
  }))

  return NextResponse.json({ data: { requests: enriched, total, page, limit } })
}

export async function POST(request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Block if already pending
  const existing = await db.execute({
    sql: `SELECT id FROM verification_requests WHERE user_id = ? AND status = 'pending' LIMIT 1`,
    args: [authUser.id],
  })
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { error: 'You already have a pending verification request.' },
      { status: 409 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const grade_level_id = formData.get('grade_level_id') ? Number(formData.get('grade_level_id')) : null
  const subtype_id     = formData.get('subtype_id')     ? Number(formData.get('subtype_id'))     : null
  const section_id     = formData.get('section_id')     ? Number(formData.get('section_id'))     : null
  const doc_type       = (formData.get('doc_type') as string) || null

  if (!grade_level_id) {
    return NextResponse.json({ error: 'Group is required.' }, { status: 400 })
  }

  const rawFiles = formData.getAll('file') as File[]

  if (rawFiles.length > MAX_FILES) {
    return NextResponse.json({ error: 'Maximum 3 files allowed.' }, { status: 400 })
  }
  for (const file of rawFiles) {
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: `File "${file.name}" exceeds 5 MB limit.` }, { status: 400 })
    }
    const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif','application/pdf']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: `File "${file.name}" has unsupported type.` }, { status: 400 })
    }
  }

  // Upload files to Vercel Blob if provided
  const uploadedUrls: string[] = []
  for (const file of rawFiles) {
    const blob = await put(`verifications/${authUser.id}/${Date.now()}-${file.name}`, file, {
      access: 'public',
    })
    uploadedUrls.push(blob.url)
  }

  // 'none' placeholder when no files uploaded (image_path is NOT NULL)
  const primaryUrl = uploadedUrls[0] ?? 'none'

  // Delete any previously rejected request before inserting new one
  await db.execute({
    sql: `DELETE FROM verification_requests WHERE user_id = ? AND status = 'rejected'`,
    args: [authUser.id],
  })

  const insertResult = await db.execute({
    sql: `INSERT INTO verification_requests
            (user_id, image_path, status, grade_level_id, subtype_id, section_id, doc_type, created_at, updated_at)
          VALUES (?, ?, 'pending', ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [authUser.id, primaryUrl, grade_level_id, subtype_id, section_id, doc_type],
  })

  const verificationRequestId = Number(insertResult.lastInsertRowid)

  // Insert documents if any files were uploaded
  for (const url of uploadedUrls) {
    await db.execute({
      sql: `INSERT INTO verification_documents (verification_request_id, file_path, created_at)
            VALUES (?, ?, datetime('now'))`,
      args: [verificationRequestId, url],
    })
  }

  // Update user with group/section info and set pending status
  await db.execute({
    sql: `UPDATE users SET
            grade_level_id = ?,
            subtype_id = ?,
            section_id = ?,
            verification_status = 'pending',
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [grade_level_id, subtype_id, section_id, authUser.id],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const docLabel = rawFiles.length > 0
    ? `Submitted ${rawFiles.length} document(s) for verification`
    : 'Submitted verification request without documents'
  await logActivity(authUser.id, 'verification_submitted', docLabel, ip)

  return NextResponse.json({
    data: { id: verificationRequestId },
    message: 'Verification request submitted successfully.',
  })
}
