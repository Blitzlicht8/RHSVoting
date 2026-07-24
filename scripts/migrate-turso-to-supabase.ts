/**
 * One-time data migration: Turso (libsql/SQLite) → Supabase Postgres.
 *
 * Run:  npx tsx scripts/migrate-turso-to-supabase.ts [--wipe]
 *
 * - Creates the Postgres schema via the app's ensureInit() (idempotent).
 * - Copies every Turso table row-for-row, PRESERVING ids and FK relationships.
 * - FK checks deferred during load (session_replication_role=replica).
 * - Fixes each table's IDENTITY sequence to MAX(id)+1 afterward.
 * - Verifies row counts (Turso vs Postgres) and prints a report.
 *
 * Pass --wipe to TRUNCATE all target tables first (use for a clean re-run; the
 * copy is otherwise idempotent via ON CONFLICT (id) DO NOTHING).
 *
 * Reads creds from .env.local (TURSO_DATABASE_URL/AUTH_TOKEN, POSTGRES_URL).
 * Idempotent and safe to re-run. Does NOT touch Turso (read-only there).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@libsql/client'
import pg from 'pg'

// ── env ──
function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnv()

const WIPE = process.argv.includes('--wipe')

// Copy order: parents before children (matters even with FK deferred, for clarity).
const TABLE_ORDER = [
  'users', 'roles', 'settings', 'otps',
  'elections', 'positions', 'candidates', 'votes',
  'verification_requests', 'verification_documents', 'verification_requirements',
  'user_logs', 'name_history',
  'posts', 'post_media', 'post_reactions', 'post_comments', 'post_reports', 'comment_reports',
  'candidate_achievements', 'user_achievements',
  'group_structures', 'group_values', 'user_group_values', 'candidate_group_values',
  'election_eligibility_rules', 'group_verifier_values',
]

async function main() {
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  // Build the Postgres schema (tables/columns/seeds) via the app's own init.
  const { ensureInit } = await import('../src/lib/db')
  await ensureInit()
  console.log('✓ Postgres schema ensured')

  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 4,
  })
  const client = await pool.connect()

  // Which Turso tables actually exist
  const existing = await turso.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'`
  )
  const tursoTables = new Set(existing.rows.map((r) => String(r.name)))
  const tables = TABLE_ORDER.filter((t) => tursoTables.has(t))
  const skipped = Array.from(tursoTables).filter((t) => !TABLE_ORDER.includes(t))
  if (skipped.length) console.log('⚠ Turso tables not in copy list (skipped):', skipped.join(', '))

  const report: { table: string; turso: number; pg: number; ok: boolean }[] = []

  try {
    await client.query('SET session_replication_role = replica') // defer FK/triggers

    if (WIPE) {
      await client.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
      console.log('✓ Wiped target tables')
    }

    for (const table of tables) {
      const src = await turso.execute(`SELECT * FROM ${table}`)
      const rows = src.rows as unknown as Record<string, unknown>[]
      if (rows.length === 0) {
        report.push({ table, turso: 0, pg: 0, ok: true })
        continue
      }
      const cols = Object.keys(rows[0])
      const colList = cols.map((c) => `"${c}"`).join(', ')
      const BATCH = 300
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH)
        const values: unknown[] = []
        const tuples = chunk.map((row, r) => {
          const ph = cols.map((c, k) => {
            values.push(row[c] ?? null)
            return `$${r * cols.length + k + 1}`
          })
          return `(${ph.join(', ')})`
        })
        await client.query(
          `INSERT INTO ${table} (${colList}) VALUES ${tuples.join(', ')} ON CONFLICT (id) DO NOTHING`,
          values
        )
      }
      report.push({ table, turso: rows.length, pg: 0, ok: false })
    }

    // Fix identity sequences to MAX(id)+1 for tables with an id column
    for (const table of tables) {
      try {
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}), true)`,
          [table]
        )
      } catch { /* table has no id/identity (e.g. settings) — skip */ }
    }
  } finally {
    await client.query('SET session_replication_role = DEFAULT').catch(() => {})
  }

  // Verify counts
  for (const row of report) {
    const c = await client.query(`SELECT COUNT(*)::int AS n FROM ${row.table}`)
    row.pg = c.rows[0].n
    row.ok = row.pg >= row.turso
  }

  console.log('\n── Row count verification (Turso → Postgres) ──')
  let allOk = true
  for (const r of report) {
    const mark = r.ok ? '✓' : '✗'
    if (!r.ok) allOk = false
    console.log(`${mark} ${r.table.padEnd(28)} turso=${r.turso}  pg=${r.pg}`)
  }
  console.log(allOk ? '\n✓ ALL TABLES MIGRATED' : '\n✗ MISMATCH — investigate before trusting the migration')

  client.release()
  await pool.end()
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error('Migration failed:', e)
  process.exit(1)
})
