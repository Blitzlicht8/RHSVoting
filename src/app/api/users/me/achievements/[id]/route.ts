export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  await db.execute({
    sql: `UPDATE user_achievements SET title=?, description=?, year=? WHERE id=? AND user_id=?`,
    args: [body.title.trim(), body.description ?? null, body.year ?? null, parseInt(params.id), authUser.id],
  })
  return NextResponse.json({ message: 'Updated' })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.execute({
    sql: `DELETE FROM user_achievements WHERE id=? AND user_id=?`,
    args: [parseInt(params.id), authUser.id],
  })
  return NextResponse.json({ message: 'Deleted' })
}
