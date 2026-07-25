export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { logActivity } from '@/lib/logger'

function requireWrite(role: string) {
  return ['master_admin', 'admin'].includes(role)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser || !requireWrite(authUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  await db.execute({ sql: `DELETE FROM group_verifier_values WHERE id = ?`, args: [id] })
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  await logActivity(authUser.id, 'verifier_removed', `Removed verifier assignment ${id}`, ip)
  return NextResponse.json({ success: true })
}
