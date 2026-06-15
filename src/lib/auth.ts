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

export function cookieOptions(rememberMe = false) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 } : {}),
  }
}

export function buildSetCookieHeader(token: string, rememberMe = false): string {
  const isProduction = process.env.NODE_ENV === 'production'
  const maxAge = rememberMe ? `; Max-Age=${30 * 24 * 60 * 60}` : ''
  const secure = isProduction ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}${maxAge}`
}

export async function setAuthCookie(token: string, rememberMe = false): Promise<void> {
  cookies().set(COOKIE_NAME, token, cookieOptions(rememberMe))
}

export async function clearAuthCookie(): Promise<void> {
  cookies().delete('auth-token')
}

export function generateOTP(): string {
  return randomInt(100000, 999999).toString()
}

export function isAdmin(role: Role): boolean {
  return ['master_admin', 'admin', 'moderator'].includes(role)
}

export function canManageVerifications(role: Role): boolean {
  return ['master_admin', 'admin', 'moderator'].includes(role)
}

export function getRoleBadgeVariant(role: Role): 'default' | 'danger' | 'purple' | 'info' | 'warning' {
  if (role === 'master_admin') return 'danger'
  if (role === 'admin') return 'warning'
  if (role === 'moderator') return 'purple'
  if (role === 'staff') return 'info'
  if (role === 'member') return 'default'
  if (role === 'unverified') return 'default'
  if (role.includes('admin')) return 'purple'
  return 'default'
}

export function getRoleLabel(role: Role): string {
  const labels: Record<string, string> = {
    master_admin: 'Master Admin',
    admin: 'Admin',
    moderator: 'Moderator',
    staff: 'Staff',
    member: 'Member',
    unverified: 'Unverified',
  }
  return labels[role] ?? role
}
