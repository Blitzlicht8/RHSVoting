import { NextResponse, NextRequest } from 'next/server'

const COOKIE_NAME = 'auth-token'

// Lightweight check: parse JWT payload without verifying the signature.
// Real signature verification (via jose in Node.js runtime) happens in
// the server layout files for each protected route.
function hasValidSession(token: string | undefined): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - (parts[1].length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    if (payload.exp && payload.exp < Date.now() / 1000) return false
    return typeof payload.id === 'number' && typeof payload.role === 'string'
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE_NAME)?.value
  const loggedIn = hasValidSession(token)

  const isAuthPage = ['/', '/register', '/verify-otp'].some((p) => pathname === p)
  const isProtectedPage = ['/dashboard', '/elections', '/admin', '/verify-id', '/profile'].some(
    (p) => pathname.startsWith(p)
  )

  if (loggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!loggedIn && isProtectedPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads|api).*)'],
}
