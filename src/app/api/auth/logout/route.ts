export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (authUser) {
      const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
      await logActivity(authUser.id, 'logout', 'Logged out', ip)
    }
    cookies().delete('auth-token')

    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
