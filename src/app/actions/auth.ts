'use server'

import { cookies } from 'next/headers'
import { db, ensureInit } from '@/lib/db'
import { signJWT } from '@/lib/auth'
import { Role } from '@/types'

export type OTPResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string }

export async function verifyOTPAction(
  email: string,
  code: string,
  type: string,
  rememberMe = false
): Promise<OTPResult> {
  await ensureInit()

  const userResult = await db.execute({
    sql: 'SELECT id, email, name, role FROM users WHERE email = ?',
    args: [email],
  })
  const user = userResult.rows[0]
  if (!user) return { ok: false, error: 'User not found' }

  const otpResult = await db.execute({
    sql: 'SELECT id, code, expires_at FROM otps WHERE user_id = ? AND type = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
    args: [Number(user.id), type],
  })
  const otp = otpResult.rows[0]

  if (!otp) return { ok: false, error: 'No active OTP found. Please request a new one.' }
  if (otp.code !== code.toString()) return { ok: false, error: 'Invalid verification code' }

  const now = new Date().toISOString()
  if ((otp.expires_at as string) <= now)
    return { ok: false, error: 'Code has expired. Please request a new one.' }

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
    if (autoVerifyResult.rows[0]?.value === 'true') {
      await db.execute({
        sql: `UPDATE users SET id_verified = 1, updated_at = datetime('now') WHERE id = ?`,
        args: [Number(user.id)],
      })
    }

    return { ok: true, redirect: '/verify-id' }
  }

  if (type === 'login') {
    const token = await signJWT(
      {
        id: Number(user.id),
        email: user.email as string,
        name: user.name as string,
        role: user.role as Role,
      },
      rememberMe
    )

    cookies().set('auth-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 } : {}),
    })

    return { ok: true, redirect: '/dashboard' }
  }

  return { ok: false, error: 'Invalid OTP type' }
}
