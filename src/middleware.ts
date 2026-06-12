import { NextResponse, NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production-please'
)
const COOKIE_NAME = 'auth-token'

type JWTPayload = { id: number; email: string; name: string; role: string }

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE_NAME)?.value

  let user: JWTPayload | null = null
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      user = payload as unknown as JWTPayload
    } catch {}
  }

  const isAuthPage = ['/', '/register', '/verify-otp'].some((p) => pathname === p)
  const isProtectedPage = ['/dashboard', '/elections', '/admin', '/verify-id', '/profile'].some(
    (p) => pathname.startsWith(p)
  )
  const isAdminPage = pathname.startsWith('/admin')

  // Authenticated users on login/register → go to dashboard
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Unauthenticated users on protected pages → go to login
  if (!user && isProtectedPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Non-admin users on admin pages → go to dashboard
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
