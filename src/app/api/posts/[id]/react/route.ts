import { NextRequest, NextResponse } from 'next/server'
import { db, ensureInit } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const vRow = await db.execute({ sql: `SELECT id_verified FROM users WHERE id = ?`, args: [authUser.id] })
  if (!Number(vRow.rows[0]?.id_verified)) {
    return NextResponse.json({ error: 'Account not yet verified.' }, { status: 403 })
  }
  await db.execute({
    sql: `INSERT OR IGNORE INTO post_reactions (post_id, user_id, type) VALUES (?,?,'heart')`,
    args: [parseInt(params.id), authUser.id],
  })
  return NextResponse.json({ message: 'Reacted' })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit()
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.execute({
    sql: `DELETE FROM post_reactions WHERE post_id=? AND user_id=?`,
    args: [parseInt(params.id), authUser.id],
  })
  return NextResponse.json({ message: 'Unreacted' })
}
