import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { randomInt } from 'node:crypto'
import { AuthUser, Role } from '@/types'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-in-production-please')
const COOKIE_NAME = 'auth-token'

export async function signJWT(payload: AuthUser, rememberMe = false): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? '30d' : '1d')
    .sign(JWT_SECRET)
}

export async function verifyJWT(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as AuthUser
  } catch {
    return null
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const token = cookies().get('auth-token')?.value
    if (!token) return null
    return verifyJWT(token)
  } catch {
    return null
  }
}

export async function setAuthCookie(token: string, rememberMe = false): Promise<void> {
  cookies().set('auth-token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 } : {}),
  })
}

export async function clearAuthCookie(): Promise<void> {
  cookies().delete('auth-token')
}

export function generateOTP(): string {
  return randomInt(100000, 999999).toString()
}

export function isAdmin(role: Role): boolean {
  return ['master_admin', 'teacher_admin', 'student_admin'].includes(role)
}

export function canManageVerifications(role: Role): boolean {
  return ['master_admin', 'teacher_admin', 'student_admin'].includes(role)
}

export function getRoleBadgeVariant(role: Role): 'default' | 'danger' | 'purple' | 'info' {
  if (role === 'master_admin') return 'danger'
  if (role.includes('admin')) return 'purple'
  if (role === 'teacher') return 'info'
  return 'default'
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    master_admin: 'Master Admin',
    teacher_admin: 'Teacher Admin',
    student_admin: 'Student Admin',
    teacher: 'Teacher',
    student: 'Student',
  }
  return labels[role] ?? role
}
