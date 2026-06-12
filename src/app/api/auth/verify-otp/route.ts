import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { signJWT, setAuthCookie } from '@/lib/auth'
import { Role } from '@/types'

export async function POST(request: NextRequest) {
  await ensureInit()

  let body: { email?: string; code?: string; type?: string; rememberMe?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, code, type, rememberMe = false } = body
  if (!email || !code || !type) {
    return NextResponse.json({ error: 'Email, code, and type are required' }, { status: 400 })
  }

  const userResult = await db.execute({
    sql: 'SELECT id, email, name, role FROM users WHERE email = ?',
    args: [email],
  })
  const user = userResult.rows[0]
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const otpResult = await db.execute({
    sql: 'SELECT id, code, expires_at FROM otps WHERE user_id = ? AND type = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
    args: [Number(user.id), type],
  })
  const otp = otpResult.rows[0]

  if (!otp) {
    return NextResponse.json({ error: 'No active OTP found. Please request a new one.' }, { status: 400 })
  }
  if (otp.code !== code.toString()) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }

  const now = new Date().toISOString()
  if ((otp.expires_at as string) <= now) {
    return NextResponse.json({ error: 'Code has expired. Please request a new one.' }, { status: 400 })
  }

  await db.execute({ sql: 'UPDATE otps SET used = 1 WHERE id = ?', args: [Number(otp.id)] })

  if (type === 'email_verify') {
    await db.execute({
      sql: `UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?`,
      args: [Number(user.id)],
    })

    const autoVerifyResult = await db.execute({
      sql: `SELECT value FROM settings WHERE key = 'auto_verify_id'`,
      args: [],
    })
    const autoVerifyEnabled = autoVerifyResult.rows[0]?.value === 'true'
    if (autoVerifyEnabled) {
      await db.execute({
        sql: `UPDATE users SET id_verified = 1, updated_at = datetime('now') WHERE id = ?`,
        args: [Number(user.id)],
      })
    }

    return NextResponse.json({
      data: { emailVerified: true, autoIdVerified: autoVerifyEnabled },
      message: 'Email verified!',
    })
  }

  if (type === 'login') {
    const token = await signJWT({
      id: Number(user.id),
      email: user.email as string,
      name: user.name as string,
      role: user.role as Role,
    }, rememberMe)
    await setAuthCookie(token, rememberMe)

    return NextResponse.json({
      data: { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      message: 'Login successful',
    })
  }

  return NextResponse.json({ error: 'Invalid OTP type' }, { status: 400 })
}
