import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { db, ensureInit } from '@/lib/db'
import { sendOTPEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  await ensureInit()

  let body: { email?: string; type?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, type } = body
  if (!email || !type) {
    return NextResponse.json({ error: 'Email and type are required' }, { status: 400 })
  }

  const userResult = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] })
  const user = userResult.rows[0]
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await db.execute({
    sql: 'UPDATE otps SET used = 1 WHERE user_id = ? AND type = ? AND used = 0',
    args: [Number(user.id), type],
  })

  const code = randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await db.execute({
    sql: 'INSERT INTO otps (user_id, code, type, expires_at, used) VALUES (?, ?, ?, ?, ?)',
    args: [Number(user.id), code, type, expiresAt, 0],
  })

  const devOtp = await sendOTPEmail(email, code, type as 'email_verify' | 'login')

  return NextResponse.json({
    message: 'Verification code resent. Check your email.',
    ...(devOtp ? { data: { devOtp } } : {}),
  })
}
