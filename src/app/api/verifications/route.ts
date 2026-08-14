export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'
import { setUserAssignments, validateAssignments, type Assignment } from '@/lib/groups'
import type { InValue } from '@/lib/db'

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

  // NEW scoping: non-admin verifiers (staff/moderator) only see requests whose
  // user shares at least one (structure_id,value_id) with the verifier's own
  // group_verifier_values rows. Full admins see everything.
  const isFullAdmin = ['master_admin', 'admin'].includes(role)
  if (!isFullAdmin) {
    const scopeCondition = `EXISTS (
      SELECT 1
      FROM user_group_values ugv
      JOIN group_verifier_values gvv
        ON gvv.structure_id = ugv.structure_id
       AND gvv.value_id = ugv.value_id
      WHERE ugv.user_id = vr.user_id
        AND gvv.user_id = ${authUser.id}
    )`
    where = where ? `${where} AND ${scopeCondition}` : `WHERE ${scopeCondition}`
  }

  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM verification_requests vr ${where}`,
    args: params,
  })
  const total = Number(countResult.rows[0]?.count ?? 0)

  const requestsResult = await db.execute({
    sql: `SELECT vr.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
                 u.avatar_url AS user_avatar_url, u.grade_level, u.section,
                 vr.doc_type
          FROM verification_requests vr
          JOIN users u ON u.id = vr.user_id
          ${where}
          ORDER BY vr.created_at DESC
          LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  })

  const requests   = requestsResult.rows
  const requestIds = requests.map(r => Number(r.id))
  const userIds    = requests.map(r => Number(r.user_id))

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

  // NEW: build each request's group labels from the user's assignments,
  // ordered by the structure order_index.
  const groupsMap: Record<number, Array<{ structure_name: string; value_name: string }>> = {}
  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(',')
    const groupsResult = await db.execute({
      sql: `SELECT ugv.user_id AS user_id, gs.name AS structure_name, gv.name AS value_name
            FROM user_group_values ugv
            JOIN group_structures gs ON gs.id = ugv.structure_id
            JOIN group_values gv ON gv.id = ugv.value_id
            WHERE ugv.user_id IN (${placeholders})
            ORDER BY gs.order_index, gs.id`,
      args: userIds,
    })
    for (const g of groupsResult.rows) {
      const uid = Number(g.user_id)
      if (!groupsMap[uid]) groupsMap[uid] = []
      groupsMap[uid].push({
        structure_name: String(g.structure_name),
        value_name: String(g.value_name),
      })
    }
  }

  const enriched = requests.map(r => ({
    ...r,
    documents: documentsMap[Number(r.id)] ?? [],
    groups: groupsMap[Number(r.user_id)] ?? [],
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

  // Prior rejected request (for field-level reverification carry-forward).
  const priorRes = await db.execute({
    sql: `SELECT lrn, doc_type, profile_photo_url, denied_fields
          FROM verification_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    args: [authUser.id],
  })
  const prior = priorRes.rows[0] ?? null
  let deniedFields: string[] = []
  if (prior?.denied_fields) {
    try {
      const parsed = JSON.parse(String(prior.denied_fields))
      if (Array.isArray(parsed)) deniedFields = parsed.map(String)
    } catch {}
  }
  // A locked field (had a field-level denial, but this field wasn't flagged) keeps its prior value.
  const isLocked = (field: string) => deniedFields.length > 0 && !deniedFields.includes(field)

  let doc_type = (formData.get('doc_type') as string) || null
  if (isLocked('doc_type')) doc_type = (prior?.doc_type as string) ?? null

  // LRN — required, 12 digits (Philippine Learner's Reference Number).
  let lrn = ((formData.get('lrn') as string) || '').trim()
  if (isLocked('lrn')) {
    lrn = (prior?.lrn as string) ?? ''
  } else {
    if (!lrn) return NextResponse.json({ error: 'LRN is required.' }, { status: 400 })
    if (!/^\d{12}$/.test(lrn)) {
      return NextResponse.json({ error: 'LRN must be exactly 12 digits.' }, { status: 400 })
    }
  }

  // NEW: assignments come as a JSON array under `assignments`.
  let assignments: Assignment[] = []
  const rawAssignments = formData.get('assignments')
  if (rawAssignments != null) {
    try {
      const parsed = JSON.parse(String(rawAssignments))
      if (Array.isArray(parsed)) {
        assignments = parsed
          .map((a): Assignment => ({ structure_id: Number(a.structure_id), value_id: Number(a.value_id) }))
          .filter((a) => Number.isFinite(a.structure_id) && Number.isFinite(a.value_id))
      }
    } catch {
      return NextResponse.json({ error: 'Invalid assignments.' }, { status: 400 })
    }
  }

  // Locked group selection: keep the user's existing assignments untouched.
  const groupsLocked = isLocked('groups')
  if (!groupsLocked) {
    const validationError = await validateAssignments(assignments)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
  }

  // ── Profile photo (required; must be a real face photo) ──
  // NOTE: this is a lightweight heuristic, NOT true face detection. A full
  // face-detection library (e.g. face-api.js / a vision API) is out of scope
  // for this session — flagged here rather than faked.
  const profilePhoto = formData.get('profile_photo') as File | null
  let profilePhotoUrl = (prior?.profile_photo_url as string) ?? null
  const photoLocked = isLocked('profile_photo')
  const hasNewPhoto = !!profilePhoto && typeof (profilePhoto as File).arrayBuffer === 'function' && profilePhoto.size > 0
  if (!photoLocked) {
    if (hasNewPhoto) {
      const imgTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!imgTypes.includes(profilePhoto!.type)) {
        return NextResponse.json({ error: 'Profile photo must be a JPEG, PNG, or WebP image.' }, { status: 400 })
      }
      if (profilePhoto!.size < 3 * 1024) {
        return NextResponse.json({ error: 'Profile photo looks empty or too small — upload a clear photo of your face.' }, { status: 400 })
      }
      if (profilePhoto!.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Profile photo exceeds the 5 MB limit.' }, { status: 400 })
      }
      const pblob = await put(`avatars/${authUser.id}/${Date.now()}-${profilePhoto!.name}`, profilePhoto!, { access: 'public' })
      profilePhotoUrl = pblob.url
    } else {
      // No new upload — reuse the prior submission's photo or the user's existing avatar.
      if (!profilePhotoUrl) {
        const existing = await db.execute({ sql: `SELECT avatar_url FROM users WHERE id = ?`, args: [authUser.id] })
        profilePhotoUrl = (existing.rows[0]?.avatar_url as string) ?? null
      }
      if (!profilePhotoUrl) {
        return NextResponse.json({ error: 'A profile photo is required.' }, { status: 400 })
      }
    }
  }

  // ── Session 10 (experimental): client-computed face descriptor ──
  // 128-float embedding produced in the browser by face-api.js. The server does
  // NOT run face detection — it only stores what the client sent. Optional: only
  // present when the enable_face_verification setting is on. Carried forward when
  // the photo is locked (descriptor derives from the photo).
  let faceDescriptor: string | null = null
  if (!photoLocked) {
    const rawDesc = formData.get('face_descriptor')
    if (rawDesc != null) {
      try {
        const parsed = JSON.parse(String(rawDesc))
        if (Array.isArray(parsed) && parsed.length === 128 && parsed.every((n) => typeof n === 'number' && Number.isFinite(n))) {
          faceDescriptor = JSON.stringify(parsed)
        }
      } catch {}
    }
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

  // When doc_type (and its documents) are locked, carry forward prior document urls.
  let uploadedUrls: string[] = []
  if (isLocked('doc_type')) {
    const priorDocs = await db.execute({
      sql: `SELECT file_path FROM verification_documents vd
            JOIN verification_requests vr ON vr.id = vd.verification_request_id
            WHERE vr.user_id = ? ORDER BY vd.id`,
      args: [authUser.id],
    })
    uploadedUrls = priorDocs.rows.map(r => String(r.file_path)).filter(p => p && p !== 'none')
  } else {
    // Upload files to Vercel Blob if provided
    for (const file of rawFiles) {
      const blob = await put(`verifications/${authUser.id}/${Date.now()}-${file.name}`, file, {
        access: 'public',
      })
      uploadedUrls.push(blob.url)
    }
  }

  // 'none' placeholder when no files uploaded (image_path is NOT NULL)
  const primaryUrl = uploadedUrls[0] ?? 'none'

  // Delete any prior request (approved or rejected) — pending already blocked above
  await db.execute({
    sql: `DELETE FROM verification_requests WHERE user_id = ?`,
    args: [authUser.id],
  })

  const insertResult = await db.execute({
    sql: `INSERT INTO verification_requests
            (user_id, image_path, status, doc_type, lrn, profile_photo_url, face_descriptor, denied_fields, created_at, updated_at)
          VALUES (?, ?, 'pending', ?, ?, ?, ?, NULL, datetime('now'), datetime('now')) RETURNING id`,
    args: [authUser.id, primaryUrl, doc_type, lrn, profilePhotoUrl, faceDescriptor],
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

  // NEW: store the user's group assignments via the configurable model (skip when locked).
  if (!groupsLocked) {
    await setUserAssignments(Number(authUser.id), assignments)
  }

  // Persist LRN + profile photo on the user record, set pending status.
  await db.execute({
    sql: `UPDATE users SET
            lrn = ?,
            avatar_url = COALESCE(?, avatar_url),
            face_descriptor = COALESCE(?, face_descriptor),
            verification_status = 'pending',
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [lrn, profilePhotoUrl, faceDescriptor, authUser.id],
  })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const isReverification = deniedFields.length > 0
  const docLabel = rawFiles.length > 0
    ? `Submitted ${rawFiles.length} document(s) for verification`
    : 'Submitted verification request without documents'
  const reverifyLabel = isReverification
    ? `Resubmitted verification (fixed: ${deniedFields.join(', ')})`
    : docLabel
  await logActivity(authUser.id, isReverification ? 'verification_reverified' : 'verification_submitted', reverifyLabel, ip)

  return NextResponse.json({
    data: { id: verificationRequestId },
    message: 'Verification request submitted successfully.',
  })
}

export async function DELETE(_request: NextRequest) {
  await ensureInit()

  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check user's current verification_status — must be 'pending' to cancel
  const userRow = await db.execute({
    sql: `SELECT verification_status FROM users WHERE id = ?`,
    args: [authUser.id],
  })
  const currentStatus = userRow.rows[0]?.verification_status as string | null
  if (currentStatus !== 'pending') {
    return NextResponse.json({ error: 'No pending verification request to cancel.' }, { status: 409 })
  }

  // Delete any pending request row (may not exist if stuck from old code) + reset user status
  await db.batch(
    [
      {
        sql: `DELETE FROM verification_requests WHERE user_id = ? AND status = 'pending'`,
        args: [authUser.id],
      },
      {
        sql: `UPDATE users SET verification_status = NULL, updated_at = datetime('now') WHERE id = ?`,
        args: [authUser.id],
      },
    ],
    'write'
  )

  const ip = _request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'verification_cancelled', 'Cancelled pending verification request', ip)

  return NextResponse.json({ message: 'Verification request cancelled.' })
}
