export const dynamic = 'force-dynamic'
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

  const existing = await db.execute({
    sql: 'SELECT id, email_verified FROM users WHERE email = ?',
    args: [email],
  })

  if (existing.rows.length > 0) {
    const existingUser = existing.rows[0]
    // If account exists but email is not yet verified, resend the OTP so they can continue
    if (!existingUser.email_verified) {
      const userId = Number(existingUser.id)
      await db.execute({
        sql: 'UPDATE otps SET used = 1 WHERE user_id = ? AND type = ? AND used = 0',
        args: [userId, 'email_verify'],
      })
      const code = randomInt(100000, 999999).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      await db.execute({
        sql: 'INSERT INTO otps (user_id, code, type, expires_at, used) VALUES (?, ?, ?, ?, ?)',
        args: [userId, code, 'email_verify', expiresAt, 0],
      })
      const devOtp = await sendOTPEmail(email, code, 'email_verify')
      return NextResponse.json(
        { data: { userId, email, ...(devOtp ? { devOtp } : {}) }, message: 'A new verification code has been sent to your email.' },
        { status: 200 }
      )
    }
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

  const devOtp = await sendOTPEmail(email, code, 'email_verify')

  return NextResponse.json(
    { data: { userId, email, ...(devOtp ? { devOtp } : {}) }, message: 'Account created. Please verify your email.' },
    { status: 201 }
  )
}
