import { Pool, PoolClient, types } from 'pg'
import bcrypt from 'bcryptjs'

// pg returns BIGINT (int8, incl. COUNT() and our BIGINT ids) as strings to avoid
// precision loss. libsql returned them as JS numbers and the whole app assumes
// numbers — parse int8 back to Number (ids here are far below 2^53). This keeps
// id/count comparisons and JSON output types identical to the Turso behavior.
types.setTypeParser(20, (v: string) => (v === null ? null : parseInt(v, 10)))

// ── Turso → Supabase Postgres migration (Session 11 Part 2) ──
// db.ts now runs on node-postgres (`pg`) against Supabase Postgres, but preserves
// the libsql-style surface the rest of the app uses: `db.execute({sql, args})`
// and `db.batch(stmts, mode)`. A translate() shim adapts SQLite dialect to
// Postgres per-statement so the ~320 raw-SQL call sites did NOT have to change:
//   - positional `?`      → `$1..$n`
//   - `datetime('now')`   → SQLite-identical text (keeps TEXT timestamp compares)
//   - `INSERT OR IGNORE`  → `... ON CONFLICT DO NOTHING`
//   - `INSERT OR REPLACE INTO settings` → `... ON CONFLICT (key) DO UPDATE`
// Boolean-ish columns stay INTEGER (0/1) so all `? 1 : 0` / `=== 1` code is intact.
// Result rows expose `lastInsertRowid` from a `RETURNING id` when present.

// Emit the exact text format SQLite's datetime('now') produced ('YYYY-MM-DD HH:MM:SS')
// so migrated + new timestamps sort/compare identically as TEXT.
const NOW_TEXT = `to_char(now() at time zone 'utc','YYYY-MM-DD HH24:MI:SS')`

export interface DbRow {
  [column: string]: unknown
}
export interface DbResult {
  rows: DbRow[]
  rowsAffected: number
  lastInsertRowid?: number
}
export interface DbStatement {
  sql: string
  args?: unknown[]
}

// ── SQLite → Postgres statement translation ──
function translate(sql: string): string {
  let out = sql

  // datetime('now') / datetime("now") → SQLite-format UTC text
  out = out.replace(/datetime\(\s*['"]now['"]\s*\)/gi, NOW_TEXT)

  // SQLite LIKE is case-insensitive; Postgres LIKE is not → use ILIKE to preserve
  // search behavior. (All LIKE uses in this codebase are case-insensitive searches.)
  out = out.replace(/\bLIKE\b/g, 'ILIKE')

  // INSERT OR REPLACE INTO settings (...) VALUES (...) → upsert on key
  out = out.replace(
    /INSERT\s+OR\s+REPLACE\s+INTO\s+settings\s*\(([^)]*)\)\s*VALUES/gi,
    'INSERT INTO settings ($1) VALUES'
  )
  const wasReplaceSettings = /INSERT\s+OR\s+REPLACE\s+INTO\s+settings/i.test(sql)

  // Remaining INSERT OR REPLACE (non-settings) — fall back to plain insert
  out = out.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO')

  // INSERT OR IGNORE INTO → INSERT INTO (+ ON CONFLICT DO NOTHING appended below)
  const wasIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(out)
  out = out.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')

  // Append conflict clauses (before any RETURNING) when not already present
  if ((wasReplaceSettings || wasIgnore) && !/ON\s+CONFLICT/i.test(out)) {
    const clause = wasReplaceSettings
      ? ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value'
      : ' ON CONFLICT DO NOTHING'
    const ret = out.match(/\sRETURNING\s/i)
    if (ret && ret.index !== undefined) {
      out = out.slice(0, ret.index) + clause + out.slice(ret.index)
    } else {
      out = out.trimEnd() + clause
    }
  }

  // Positional ? → $1..$n (skip ? inside single-quoted string literals)
  let n = 0
  let inStr = false
  let result = ''
  for (let i = 0; i < out.length; i++) {
    const ch = out[i]
    if (ch === "'") {
      // handle escaped '' inside a string
      if (inStr && out[i + 1] === "'") {
        result += "''"
        i++
        continue
      }
      inStr = !inStr
      result += ch
    } else if (ch === '?' && !inStr) {
      result += '$' + ++n
    } else {
      result += ch
    }
  }
  return result
}

function toResult(res: { rows: DbRow[]; rowCount: number | null }): DbResult {
  const rows = res.rows ?? []
  const first = rows[0] as DbRow | undefined
  const lastId =
    first && typeof first.id === 'number' ? (first.id as number) : undefined
  return { rows, rowsAffected: res.rowCount ?? 0, lastInsertRowid: lastId }
}

// ── Lazy pg Pool (mirrors the old lazy-Proxy rule: never eager-init at import) ──
// Parse postgresql://user:pass@host:port/db?params into discrete fields WITHOUT
// URL-decoding — Supabase passwords often contain characters (@, /, etc.) that
// break connection-string parsing when unencoded. Split on the LAST '@' (the
// host has none) so a raw password is passed through verbatim.
export function parsePgUrl(url: string): {
  user: string; password: string; host: string; port: number; database: string
} {
  const scheme = url.indexOf('://')
  const rest = url.slice(scheme + 3)
  const at = rest.lastIndexOf('@')
  const creds = rest.slice(0, at)
  const hostPart = rest.slice(at + 1)
  const ci = creds.indexOf(':')
  const user = ci === -1 ? creds : creds.slice(0, ci)
  const password = ci === -1 ? '' : creds.slice(ci + 1)
  const slash = hostPart.indexOf('/')
  const hostPort = slash === -1 ? hostPart : hostPart.slice(0, slash)
  const dbAndParams = slash === -1 ? '' : hostPart.slice(slash + 1)
  const database = dbAndParams.split('?')[0] || 'postgres'
  const colon = hostPort.lastIndexOf(':')
  const host = colon === -1 ? hostPort : hostPort.slice(0, colon)
  const port = colon === -1 ? 5432 : parseInt(hostPort.slice(colon + 1), 10) || 5432
  return { user, password, host, port, database }
}

let _pool: Pool | null = null
function getPool(): Pool {
  if (!_pool) {
    // APP_DATABASE_URL first: a dedicated var we control. The Supabase↔Vercel
    // integration manages/overwrites POSTGRES_URL (direct connection, user
    // "postgres") and can carry a stale password — set APP_DATABASE_URL to the
    // Session-pooler URL (user "postgres.<ref>", port 5432) to bypass that.
    const url =
      process.env.APP_DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL
    if (!url) throw new Error('APP_DATABASE_URL / POSTGRES_URL is not set')
    const cfg = parsePgUrl(url)
    _pool = new Pool({ ...cfg, ssl: { rejectUnauthorized: false }, max: 5 })
  }
  return _pool
}

export interface Db {
  execute(stmt: DbStatement): Promise<DbResult>
  batch(stmts: DbStatement[], mode?: string): Promise<DbResult[]>
}

async function execute(stmt: DbStatement): Promise<DbResult> {
  const text = translate(stmt.sql)
  const res = await getPool().query(text, (stmt.args ?? []) as unknown[])
  return toResult(res as { rows: DbRow[]; rowCount: number | null })
}

async function batch(stmts: DbStatement[], _mode?: string): Promise<DbResult[]> {
  const client: PoolClient = await getPool().connect()
  try {
    await client.query('BEGIN')
    const out: DbResult[] = []
    for (const s of stmts) {
      const res = await client.query(translate(s.sql), (s.args ?? []) as unknown[])
      out.push(toResult(res as { rows: DbRow[]; rowCount: number | null }))
    }
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

export const db: Db = { execute, batch }

let initPromise: Promise<void> | null = null
export function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = _init()
  return initPromise
}

// Postgres schema. INTEGER PRIMARY KEY AUTOINCREMENT → GENERATED BY DEFAULT AS
// IDENTITY (lets the data-migration script insert explicit ids, then autoincrement
// after). Boolean flags stay INTEGER to preserve app comparisons. Timestamp
// columns stay TEXT defaulting to SQLite-format UTC text.
const PK = 'BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY'
const TS_DEFAULT = `DEFAULT (${NOW_TEXT})`

async function _init(): Promise<void> {
  const tables: string[] = [
    `CREATE TABLE IF NOT EXISTS users (
      id ${PK},
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      email_verified INTEGER NOT NULL DEFAULT 0,
      id_verified INTEGER NOT NULL DEFAULT 0,
      id_image TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL ${TS_DEFAULT},
      updated_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS otps (
      id ${PK},
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS elections (
      id ${PK},
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL ${TS_DEFAULT},
      updated_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS positions (
      id ${PK},
      election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      max_votes INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS candidates (
      id ${PK},
      election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
      position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      bio TEXT,
      image TEXT,
      created_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS votes (
      id ${PK},
      election_id INTEGER NOT NULL REFERENCES elections(id),
      position_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      voter_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL ${TS_DEFAULT},
      UNIQUE(election_id, position_id, voter_id, candidate_id)
    )`,
    `CREATE TABLE IF NOT EXISTS verification_requests (
      id ${PK},
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      image_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS user_logs (
      id ${PK},
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip TEXT,
      created_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS verification_documents (
      id ${PK},
      verification_request_id INTEGER NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS posts (
      id ${PK},
      author_id INTEGER NOT NULL REFERENCES users(id),
      election_id INTEGER REFERENCES elections(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL ${TS_DEFAULT},
      updated_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS post_media (
      id ${PK},
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS post_reactions (
      id ${PK},
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL DEFAULT 'heart',
      created_at TEXT NOT NULL ${TS_DEFAULT},
      UNIQUE(post_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS post_comments (
      id ${PK},
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS post_reports (
      id ${PK},
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL ${TS_DEFAULT},
      UNIQUE(post_id, reporter_id)
    )`,
    `CREATE TABLE IF NOT EXISTS name_history (
      id ${PK},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      old_name TEXT NOT NULL,
      new_name TEXT NOT NULL,
      changed_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS verification_requirements (
      id ${PK},
      name TEXT NOT NULL,
      description TEXT,
      required INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS candidate_achievements (
      id ${PK},
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      year INTEGER,
      created_at TEXT ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS comment_reports (
      id ${PK},
      comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL ${TS_DEFAULT},
      UNIQUE(comment_id, reporter_id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_achievements (
      id ${PK},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      year INTEGER,
      order_index INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS group_structures (
      id ${PK},
      name TEXT NOT NULL,
      parent_structure_id INTEGER REFERENCES group_structures(id) ON DELETE CASCADE,
      is_required INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS group_values (
      id ${PK},
      structure_id INTEGER NOT NULL REFERENCES group_structures(id) ON DELETE CASCADE,
      parent_value_id INTEGER REFERENCES group_values(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
    `CREATE TABLE IF NOT EXISTS user_group_values (
      id ${PK},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      structure_id INTEGER NOT NULL REFERENCES group_structures(id) ON DELETE CASCADE,
      value_id INTEGER NOT NULL REFERENCES group_values(id) ON DELETE CASCADE,
      UNIQUE(user_id, structure_id)
    )`,
    `CREATE TABLE IF NOT EXISTS candidate_group_values (
      id ${PK},
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      structure_id INTEGER NOT NULL REFERENCES group_structures(id) ON DELETE CASCADE,
      value_id INTEGER NOT NULL REFERENCES group_values(id) ON DELETE CASCADE,
      UNIQUE(candidate_id, structure_id)
    )`,
    `CREATE TABLE IF NOT EXISTS election_eligibility_rules (
      id ${PK},
      election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
      structure_id INTEGER REFERENCES group_structures(id) ON DELETE CASCADE,
      value_id INTEGER REFERENCES group_values(id) ON DELETE CASCADE,
      is_all_groups INTEGER NOT NULL DEFAULT 0,
      is_exclude INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS group_verifier_values (
      id ${PK},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      structure_id INTEGER NOT NULL REFERENCES group_structures(id) ON DELETE CASCADE,
      value_id INTEGER NOT NULL REFERENCES group_values(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL ${TS_DEFAULT},
      UNIQUE(user_id, structure_id, value_id)
    )`,
    `CREATE TABLE IF NOT EXISTS roles (
      id ${PK},
      name TEXT NOT NULL UNIQUE,
      is_system INTEGER NOT NULL DEFAULT 0,
      permissions TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL ${TS_DEFAULT}
    )`,
  ]
  for (const sql of tables) {
    await db.execute({ sql, args: [] })
  }

  // Additive columns (idempotent via ADD COLUMN IF NOT EXISTS)
  const newColumns: string[] = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_level TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS section TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS intended_role TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS intended_role TEXT`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS grade_level TEXT`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS section TEXT`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS student_user_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_level_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS subtype_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS section_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS grade_level_id INTEGER`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS subtype_id INTEGER`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS section_id INTEGER`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS doc_type TEXT`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS allow_teacher_vote INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS is_global INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS user_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_academic_update INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_notes TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS updated_at TEXT`,
    `ALTER TABLE verification_documents ADD COLUMN IF NOT EXISTS created_at TEXT`,
    `ALTER TABLE verification_documents ADD COLUMN IF NOT EXISTS doc_type TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo_url TEXT`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS grade_level_id INTEGER`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS subtype_id INTEGER`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS section_id INTEGER`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS share_token TEXT`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS platform TEXT`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS qualifications TEXT`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS achievements TEXT`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS subtype TEXT`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS auto_start INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS auto_end INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE positions ADD COLUMN IF NOT EXISTS max_votes_mode TEXT NOT NULL DEFAULT 'custom'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS lrn TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS lrn TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS profile_photo_url TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS denied_fields TEXT`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS visible_to_all INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS warn_non_voters INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS timeout_until TEXT`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS face_descriptor TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS face_descriptor TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS face_skip INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS face_reverify_required INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS face_enroll_required INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS face_report_pending INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS face_reported_at TEXT`,
  ]
  for (const sql of newColumns) {
    await db.execute({ sql, args: [] }).catch(() => {})
  }

  // Seed default settings (ON CONFLICT DO NOTHING via translate())
  const seedSettings: [string, string][] = [
    ['auto_verify_id', 'false'],
    ['otp_required_login', 'true'],
    ['app_name', 'Rizal High School Elections'],
    ['group_label_l1', 'Group'],
    ['group_label_l2', 'Subgroup'],
    ['group_label_l3', 'Unit'],
    ['doc_type_labels', '["Government ID","School ID","Employee ID"]'],
    ['org_type', 'school'],
    ['require_post_approval', 'false'],
    ['auto_approve_posts', 'true'],
    ['enable_face_verification', 'false'],
  ]
  for (const [k, v] of seedSettings) {
    await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, args: [k, v] })
  }
  await db.execute({ sql: `UPDATE settings SET value = ? WHERE key = ? AND value = ?`, args: ['true', 'otp_required_login', '1'] })
  await db.execute({ sql: `UPDATE settings SET value = ? WHERE key = ? AND value = ?`, args: ['false', 'auto_verify_id', '0'] })
  await db.execute({ sql: `UPDATE settings SET value = ? WHERE key = 'app_name' AND value = ?`, args: ['Rizal High School Elections', 'Community Hub'] })
  await db.execute({ sql: `UPDATE settings SET value = ? WHERE key = 'org_type' AND value = ?`, args: ['school', 'community'] })

  // Seed default roles
  const roleSeeds = [
    { name: 'master_admin', is_system: 1, perms: '{"manageUsers":true,"manageElections":true,"manageSettings":true,"manageRoles":true,"viewReports":true,"verifyMembers":true,"managePosts":true}' },
    { name: 'admin', is_system: 0, perms: '{"manageUsers":true,"manageElections":true,"viewReports":true,"verifyMembers":true,"managePosts":true}' },
    { name: 'moderator', is_system: 0, perms: '{"viewReports":true,"managePosts":true}' },
    { name: 'staff', is_system: 0, perms: '{"managePosts":true}' },
    { name: 'member', is_system: 0, perms: '{}' },
    { name: 'unverified', is_system: 1, perms: '{}' },
  ]
  for (const r of roleSeeds) {
    await db.execute({ sql: `INSERT OR IGNORE INTO roles (name, is_system, permissions) VALUES (?,?,?)`, args: [r.name, r.is_system, r.perms] })
  }

  // Backfill Session-8 granular scopes (read-modify-write in JS — no json_insert in PG).
  const scopeBackfill: { role: string; scope: string }[] = [
    { role: 'admin', scope: 'reviewVerificationFields' },
    { role: 'admin', scope: 'manageElectionVisibility' },
    { role: 'admin', scope: 'manageUserPenalties' },
    { role: 'admin', scope: 'managePostApproval' },
    { role: 'moderator', scope: 'reviewVerificationFields' },
    { role: 'moderator', scope: 'managePostApproval' },
  ]
  for (const b of scopeBackfill) {
    const row = await db.execute({ sql: `SELECT permissions FROM roles WHERE name = ?`, args: [b.role] })
    const permsStr = (row.rows[0]?.permissions as string) ?? '{}'
    let perms: Record<string, unknown>
    try { perms = JSON.parse(permsStr) } catch { perms = {} }
    if (!(b.scope in perms)) {
      perms[b.scope] = true
      await db.execute({ sql: `UPDATE roles SET permissions = ? WHERE name = ?`, args: [JSON.stringify(perms), b.role] })
    }
  }

  // Fresh-install group structure seed (legacy Turso migration handled by the
  // one-time data-migration script, which copies group_structures directly).
  await seedGroupStructures()

  // Seed default admin accounts if missing
  const adminCheck = await db.execute({ sql: `SELECT id FROM users WHERE email = 'admin@localhost.local'`, args: [] })
  if (adminCheck.rows.length === 0) {
    const hash = await bcrypt.hash('Admin@123', 12)
    await db.execute({
      sql: `INSERT INTO users (email, password_hash, name, role, email_verified, id_verified)
            VALUES ('admin@localhost.local', ?, 'Master Admin', 'master_admin', 1, 1)`,
      args: [hash],
    })
  }

  const rhenaCheck = await db.execute({ sql: `SELECT id FROM users WHERE email = 'rhenallenpabalan@gmail.com'`, args: [] })
  if (rhenaCheck.rows.length === 0) {
    const hash = await bcrypt.hash('Admin@123', 12)
    await db.execute({
      sql: `INSERT INTO users (email, password_hash, name, role, email_verified, id_verified)
            VALUES ('rhenallenpabalan@gmail.com', ?, 'Rhena', 'master_admin', 1, 1)`,
      args: [hash],
    })
  } else {
    await db.execute({
      sql: `UPDATE users SET role = 'master_admin', email_verified = 1, id_verified = 1, active = 1
            WHERE email = 'rhenallenpabalan@gmail.com'`,
      args: [],
    })
  }
}

// Fresh-install seed of one required Grade Level structure (Grades 7-12).
async function seedGroupStructures(): Promise<void> {
  const flag = await db.execute({ sql: `SELECT value FROM settings WHERE key = 'group_migration_v1'`, args: [] })
  if ((flag.rows[0]?.value as string) === 'done') return

  const structCount = await db.execute({ sql: `SELECT COUNT(*) as c FROM group_structures`, args: [] })
  if (Number(structCount.rows[0]?.c ?? 0) > 0) {
    await db.execute({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES ('group_migration_v1','done')`, args: [] })
    return
  }

  const s = await db.execute({
    sql: `INSERT INTO group_structures (name, parent_structure_id, is_required, order_index) VALUES ('Grade Level', NULL, 1, 0) RETURNING id`,
    args: [],
  })
  const sid = Number(s.rows[0].id)
  const grades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']
  for (let i = 0; i < grades.length; i++) {
    await db.execute({
      sql: `INSERT INTO group_values (structure_id, parent_value_id, name, order_index) VALUES (?, NULL, ?, ?)`,
      args: [sid, grades[i], i],
    })
  }
  await db.execute({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES ('group_migration_v1','done')`, args: [] })
}
