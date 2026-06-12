import { NextResponse, NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'auth-token'
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production-please'
)

type JWTPayload = { id: number; email: string; name: string; role: string; exp?: number }

async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
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
