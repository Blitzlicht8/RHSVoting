/* Runtime smoke test of the pg adapter against migrated Supabase data. Read-only. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}
loadEnv()

async function main() {
  const { db, ensureInit } = await import('../src/lib/db')
  await ensureInit()
  const ok: string[] = []
  const fail: string[] = []
  const t = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); ok.push(name) } catch (e) { fail.push(`${name}: ${(e as Error).message}`) }
  }

  // 1. settings (cache path)
  await t('settings select', async () => {
    const r = await db.execute({ sql: 'SELECT key, value FROM settings', args: [] })
    if (r.rows.length < 11) throw new Error('too few settings')
  })
  // 2. elections list complex query: ?->$n, subqueries, EXISTS AS "hasVoted"
  await t('elections list (hasVoted/subqueries)', async () => {
    const r = await db.execute({
      sql: `SELECT e.*,
              (SELECT COUNT(*) FROM positions p WHERE p.election_id = e.id) AS position_count,
              (SELECT COUNT(*) FROM votes v WHERE v.election_id = e.id) AS vote_count,
              EXISTS(SELECT 1 FROM votes vhv WHERE vhv.election_id = e.id AND vhv.voter_id = ?) AS "hasVoted"
            FROM elections e ORDER BY e.created_at DESC`,
      args: [1],
    })
    const row = r.rows[0] as Record<string, unknown> | undefined
    if (row && !('hasVoted' in row)) throw new Error('hasVoted alias missing (folded?)')
  })
  // 3. ILIKE search
  await t('ILIKE user search', async () => {
    await db.execute({ sql: `SELECT id, name FROM users WHERE (name LIKE ? OR email LIKE ?)`, args: ['%a%', '%@%'] })
  })
  // 4. JOIN + eligibility rules IN(...)
  await t('eligibility rules IN', async () => {
    await db.execute({ sql: `SELECT election_id, structure_id, value_id, is_all_groups, is_exclude FROM election_eligibility_rules WHERE election_id IN (?)`, args: [1] })
  })
  // 5. group tree
  await t('group tree', async () => {
    const s = await db.execute({ sql: `SELECT id FROM group_structures WHERE active = 1`, args: [] })
    if (s.rows.length === 0) throw new Error('no structures')
  })
  // 6. FK integrity: every candidate points to a real position + election
  await t('FK: candidates→positions/elections', async () => {
    const r = await db.execute({ sql: `SELECT COUNT(*) AS n FROM candidates c LEFT JOIN positions p ON p.id=c.position_id LEFT JOIN elections e ON e.id=c.election_id WHERE p.id IS NULL OR e.id IS NULL`, args: [] })
    if (Number((r.rows[0] as any).n) > 0) throw new Error('orphan candidates')
  })
  // 7. FK: user_group_values reference real users+values
  await t('FK: user_group_values', async () => {
    const r = await db.execute({ sql: `SELECT COUNT(*) AS n FROM user_group_values ugv LEFT JOIN users u ON u.id=ugv.user_id LEFT JOIN group_values gv ON gv.id=ugv.value_id WHERE u.id IS NULL OR gv.id IS NULL`, args: [] })
    if (Number((r.rows[0] as any).n) > 0) throw new Error('orphan user_group_values')
  })
  // 8. identity sequence: next users.id > current max (does NOT insert)
  await t('identity sequence advanced', async () => {
    const r = await db.execute({ sql: `SELECT (SELECT last_value FROM pg_sequences WHERE sequencename = 'users_id_seq') AS seq, (SELECT MAX(id) FROM users) AS maxid`, args: [] })
    const seq = Number((r.rows[0] as any).seq); const maxid = Number((r.rows[0] as any).maxid)
    if (seq < maxid) throw new Error(`seq ${seq} < max id ${maxid}`)
  })
  // 9. permissions JSON intact on roles
  await t('roles permissions JSON', async () => {
    const r = await db.execute({ sql: `SELECT permissions FROM roles WHERE name='admin'`, args: [] })
    JSON.parse((r.rows[0] as any).permissions)
  })

  console.log('PASS:', ok.length); ok.forEach((n) => console.log('  ✓', n))
  if (fail.length) { console.log('FAIL:', fail.length); fail.forEach((n) => console.log('  ✗', n)) }
  process.exit(fail.length ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
