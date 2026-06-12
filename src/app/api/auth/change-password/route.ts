import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { currentPassword, newPassword } = await request.json()
  if (!currentPassword || !newPassword) return NextResponse.json({ error: 'Both passwords required' }, { status: 400 })
  if (newPassword.length < 8) return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })

  const result = await db.execute({ sql: `SELECT password_hash FROM users WHERE id=?`, args: [authUser.id] })
  const user = result.rows[0]
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password_hash as string)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const hash = await bcrypt.hash(newPassword, 12)
  await db.execute({ sql: `UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`, args: [hash, authUser.id] })
  return NextResponse.json({ message: 'Password changed successfully' })
}
