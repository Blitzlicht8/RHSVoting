import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { put } from '@vercel/blob'
import { logActivity } from '@/lib/logger'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'teacher_admin'].includes(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const targetId = parseInt(params.id)
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

  const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif','application/pdf']
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: `${file.name} exceeds 5MB` }, { status: 400 })
    if (!allowed.includes(file.type)) return NextResponse.json({ error: `${file.name} unsupported type` }, { status: 400 })
  }

  // Create approved verification request
  const now = new Date().toISOString()
  const vrRes = await db.execute({
    sql: `INSERT INTO verification_requests (user_id, status, reviewed_by, reviewed_at, created_at) VALUES (?,?,?,?,?)`,
    args: [targetId, 'approved', authUser.id, now, now]
  })
  const vrId = vrRes.lastInsertRowid

  // Upload files and insert documents
  for (const file of files) {
    const ext = file.name.split('.').pop() ?? 'bin'
    const blob = await put(`verifications/${targetId}/${Date.now()}.${ext}`, await file.arrayBuffer(), {
      access: 'public',
      contentType: file.type,
    })
    await db.execute({
      sql: `INSERT INTO verification_documents (verification_request_id, file_path, doc_type, created_at) VALUES (?,?,?,?)`,
      args: [vrId, blob.url, 'school_id', now]
    })
  }

  // Mark user as verified
  const grade_level_id = formData.get('grade_level_id') ? parseInt(formData.get('grade_level_id') as string) : null
  const subtype_id = formData.get('subtype_id') ? parseInt(formData.get('subtype_id') as string) : null
  const section_id = formData.get('section_id') ? parseInt(formData.get('section_id') as string) : null

  let updateSql = 'UPDATE users SET id_verified=1, email_verified=1'
  const updateArgs: (string | number | null)[] = []
  if (grade_level_id) { updateSql += ', grade_level_id=?'; updateArgs.push(grade_level_id) }
  if (subtype_id) { updateSql += ', subtype_id=?'; updateArgs.push(subtype_id) }
  if (section_id) { updateSql += ', section_id=?'; updateArgs.push(section_id) }
  updateSql += ' WHERE id=?'
  updateArgs.push(targetId)
  await db.execute({ sql: updateSql, args: updateArgs })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id as number, 'admin_verified_user', `Admin uploaded doc and verified user ${targetId}`, ip)

  return NextResponse.json({ message: 'User verified' })
}
