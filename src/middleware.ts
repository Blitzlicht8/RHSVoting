import { NextResponse, NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'auth-token'
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production-please'
)

// FULL signature verification (jose runs in the Edge runtime), matching what the
// server layouts + /api/auth/me do. Previously this only base64-decoded the
// payload without checking the signature: a token that parsed but failed
// verification made middleware think the user was logged in (redirect / → /dashboard)
// while /api/auth/me returned 401 → client bounced back to / → infinite loop.
// Now a bad token is treated as logged-out and its cookie is cleared.
async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return typeof payload.id === 'number' && typeof payload.role === 'string'
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE_NAME)?.value
  const loggedIn = await hasValidSession(token)

  const isAuthPage = ['/', '/register', '/verify-otp'].some((p) => pathname === p)
  const isProtectedPage = ['/dashboard', '/elections', '/admin', '/verify-id', '/profile', '/users', '/feed'].some(
    (p) => pathname.startsWith(p)
  )

  // A present-but-invalid token is the loop trigger — expire it on every response
  // so the stale cookie can't keep re-driving the redirect cycle.
  const clearStale = (res: NextResponse): NextResponse => {
    if (token && !loggedIn) res.cookies.delete(COOKIE_NAME)
    return res
  }

  if (loggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!loggedIn && isProtectedPage) {
    return clearStale(NextResponse.redirect(new URL('/', request.url)))
  }

  return clearStale(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads|api).*)'],
}
