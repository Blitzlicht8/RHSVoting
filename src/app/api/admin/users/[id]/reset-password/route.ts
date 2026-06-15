export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !['master_admin', 'admin'].includes(authUser.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const targetId = parseInt(params.id, 10)
  if (isNaN(targetId))
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

  const existing = await db.execute({ sql: `SELECT id, email, role FROM users WHERE id = ?`, args: [targetId] })
  const target = existing.rows[0]
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // admin cannot reset master_admin password
  if (authUser.role === 'admin' && target.role === 'master_admin')
    return NextResponse.json({ error: 'Cannot reset master_admin password' }, { status: 403 })

  const newPassword = generatePassword()
  const hash = await bcrypt.hash(newPassword, 12)
  await db.execute({ sql: `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, args: [hash, targetId] })

  // Invalidate any existing OTPs
  await db.execute({ sql: `UPDATE otps SET used = 1 WHERE user_id = ? AND used = 0`, args: [targetId] })

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  await logActivity(authUser.id, 'password_reset_admin', `Admin reset password for user ${target.email as string}`, ip)

  return NextResponse.json({ data: { password: newPassword } })
}
