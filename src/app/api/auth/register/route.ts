import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { db, ensureInit } from '@/lib/db'
import { sendOTPEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  await ensureInit()

  let body: { email?: string; password?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, password, name } = body
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
  }

  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] })
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const result = await db.execute({
    sql: `INSERT INTO users (email, password_hash, name, role, email_verified, id_verified)
          VALUES (?, ?, ?, 'student', 0, 0)`,
    args: [email, hashedPassword, name],
  })
  const userId = Number(result.lastInsertRowid)

  const code = randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await db.execute({
    sql: 'INSERT INTO otps (user_id, code, type, expires_at, used) VALUES (?, ?, ?, ?, ?)',
    args: [userId, code, 'email_verify', expiresAt, 0],
  })

  let devOtp: string | null = null
  try {
    devOtp = await sendOTPEmail(email, code, 'email_verify')
  } catch (emailErr) {
    console.error('Failed to send verification email:', emailErr)
    return NextResponse.json(
      { error: 'Account created but we could not send the verification email. Please try logging in and request a new code.' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { data: { userId, email, ...(devOtp ? { devOtp } : {}) }, message: 'Account created. Please verify your email.' },
    { status: 201 }
  )
}
