export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { ensureInit } from '@/lib/db'
import { getStructureTree } from '@/lib/groups'
import { cached, CACHE_KEYS, CONFIG_TTL } from '@/lib/cache'

export async function GET() {
  await ensureInit()
  // Global structure tree, identical for all users, changes only on admin edits.
  const data = await cached(CACHE_KEYS.groupsTree, CONFIG_TTL, () => getStructureTree(true))
  return NextResponse.json({ data })
}
