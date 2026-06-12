import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { db, ensureInit } from '@/lib/db'
import { signJWT, buildSetCookieHeader } from '@/lib/auth'
import { Role } from '@/types'
import { sendOTPEmail } from '@/lib/email'
import { logActivity } from '@/lib/logger'

export async function POST(request: NextRequest) {
  await ensureInit()

  let body: { email?: string; password?: string; rememberMe?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, password, rememberMe = false } = body
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'

  const userResult = await db.execute({
    sql: 'SELECT id, email, name, role, password_hash, email_verified, id_verified, active FROM users WHERE email = ?',
    args: [email],
  })
  const user = userResult.rows[0]

  if (!user) {
    await logActivity(null, 'login_failed', `Email not found: ${email}`, ip)
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }
  if (!user.active) {
    return NextResponse.json({ error: 'Your account has been deactivated' }, { status: 403 })
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash as string)
  if (!passwordMatch) {
    await logActivity(Number(user.id), 'login_failed', 'Wrong password', ip)
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (!user.email_verified) {
    return NextResponse.json(
      { error: 'Please verify your email first', data: { requiresEmailVerification: true, email } },
      { status: 403 }
    )
  }

  const otpSettingResult = await db.execute({
    sql: `SELECT value FROM settings WHERE key = 'otp_required_login'`,
    args: [],
  })
  const otpRequired = otpSettingResult.rows[0]?.value !== 'false'

  if (otpRequired) {
    await db.execute({
      sql: `UPDATE otps SET used = 1 WHERE user_id = ? AND type = 'login' AND used = 0`,
      args: [Number(user.id)],
    })

    const code = randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await db.execute({
      sql: 'INSERT INTO otps (user_id, code, type, expires_at, used) VALUES (?, ?, ?, ?, ?)',
      args: [Number(user.id), code, 'login', expiresAt, 0],
    })
    const devOtp = await sendOTPEmail(email, code, 'login')
    await logActivity(Number(user.id), 'login_otp_sent', `OTP sent to ${email}`, ip)

    return NextResponse.json({ data: { requiresOTP: true, email, ...(devOtp ? { devOtp } : {}) }, message: 'OTP sent to your email' })
  }

  const token = await signJWT({
    id: Number(user.id),
    email: user.email as string,
    name: user.name as string,
    role: user.role as Role,
  }, rememberMe)

  await logActivity(Number(user.id), 'login_success', 'Logged in directly (OTP disabled)', ip)

  const response = NextResponse.json(
    { data: { redirectTo: '/dashboard' }, message: 'Login successful.' },
    { status: 200 }
  )
  response.headers.set('Set-Cookie', buildSetCookieHeader(token, rememberMe))
  return response
}
