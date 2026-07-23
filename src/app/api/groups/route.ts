export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { ensureInit } from '@/lib/db'
import { getStructureTree } from '@/lib/groups'

export async function GET() {
  await ensureInit()
  const data = await getStructureTree(true)
  return NextResponse.json({ data })
}
