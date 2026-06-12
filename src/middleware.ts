import { NextResponse, NextRequest } from 'next/server'

const COOKIE_NAME = 'auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production-please'

type JWTPayload = { id: number; email: string; name: string; role: string; exp?: number }

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    s.length + (4 - (s.length % 4)) % 4,
    '='
  )
  const binary = atob(padded)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, sigB64] = parts

    const keyData = new TextEncoder().encode(JWT_SECRET)
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const sig = base64urlDecode(sigB64)
    const valid = await crypto.subtle.verify('HMAC', key, sig.buffer as ArrayBuffer, data.buffer as ArrayBuffer)
    if (!valid) return null

    const payload: JWTPayload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadB64))
    )

    if (payload.exp && payload.exp < Date.now() / 1000) return null

    return payload
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE_NAME)?.value

  let user: JWTPayload | null = null
  if (token) {
    user = await verifyToken(token)
  }

  const isAuthPage = ['/', '/register', '/verify-otp'].some((p) => pathname === p)
  const isProtectedPage = ['/dashboard', '/elections', '/admin', '/verify-id', '/profile'].some(
    (p) => pathname.startsWith(p)
  )
  const isAdminPage = pathname.startsWith('/admin')

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!user && isProtectedPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (user && isAdminPage) {
    const adminRoles = ['master_admin', 'teacher_admin', 'student_admin']
    if (!adminRoles.includes(user.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads|api).*)'],
}
