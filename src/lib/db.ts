import { createClient, Client } from '@libsql/client'
import bcrypt from 'bcryptjs'

function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) throw new Error('TURSO_DATABASE_URL is not set')
  return createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
}

let _db: Client | null = null
function getClient(): Client {
  if (!_db) _db = makeClient()
  return _db
}

export const db: Client = new Proxy({} as Client, {
  get(_t, prop) {
    const client = getClient()
    const val = (client as any)[prop]
    return typeof val === 'function' ? val.bind(client) : val
  },
})

let initPromise: Promise<void> | null = null

export function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = _init()
  return initPromise
}

async function _init(): Promise<void> {
  await db.batch(
    [
      {
        sql: `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'student',
          email_verified INTEGER NOT NULL DEFAULT 0,
          id_verified INTEGER NOT NULL DEFAULT 0,
          id_image TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS otps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          code TEXT NOT NULL,
          type TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS elections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          created_by INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS positions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          election_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          max_votes INTEGER NOT NULL DEFAULT 1,
          order_index INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS candidates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          election_id INTEGER NOT NULL,
          position_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          bio TEXT,
          image TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
          FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          election_id INTEGER NOT NULL,
          position_id INTEGER NOT NULL,
          candidate_id INTEGER NOT NULL,
          voter_id INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(election_id, position_id, voter_id, candidate_id),
          FOREIGN KEY (election_id) REFERENCES elections(id),
          FOREIGN KEY (candidate_id) REFERENCES candidates(id),
          FOREIGN KEY (voter_id) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS verification_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          image_path TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          reviewed_by INTEGER,
          reviewed_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (reviewed_by) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS user_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          details TEXT,
          ip TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS verification_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          verification_request_id INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          FOREIGN KEY (verification_request_id) REFERENCES verification_requests(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          author_id INTEGER NOT NULL,
          election_id INTEGER,
          content TEXT NOT NULL,
          is_public INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (author_id) REFERENCES users(id),
          FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE SET NULL
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS post_media (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          url TEXT NOT NULL,
          order_index INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS post_reactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL DEFAULT 'heart',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(post_id, user_id),
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS post_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          author_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
          FOREIGN KEY (author_id) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS post_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          reporter_id INTEGER NOT NULL,
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          reviewed_by INTEGER,
          reviewed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(post_id, reporter_id),
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
          FOREIGN KEY (reporter_id) REFERENCES users(id),
          FOREIGN KEY (reviewed_by) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS name_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          old_name TEXT NOT NULL,
          new_name TEXT NOT NULL,
          changed_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS verification_requirements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          required INTEGER NOT NULL DEFAULT 1,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_by INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS candidate_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          year INTEGER,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS comment_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          comment_id INTEGER NOT NULL,
          reporter_id INTEGER NOT NULL,
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          reviewed_by INTEGER,
          reviewed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(comment_id, reporter_id),
          FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE CASCADE,
          FOREIGN KEY (reporter_id) REFERENCES users(id),
          FOREIGN KEY (reviewed_by) REFERENCES users(id)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS user_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          year INTEGER,
          order_index INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS group_structures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          parent_structure_id INTEGER,
          is_required INTEGER NOT NULL DEFAULT 1,
          order_index INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (parent_structure_id) REFERENCES group_structures(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS group_values (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          structure_id INTEGER NOT NULL,
          parent_value_id INTEGER,
          name TEXT NOT NULL,
          order_index INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (structure_id) REFERENCES group_structures(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_value_id) REFERENCES group_values(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS user_group_values (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          structure_id INTEGER NOT NULL,
          value_id INTEGER NOT NULL,
          UNIQUE(user_id, structure_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (structure_id) REFERENCES group_structures(id) ON DELETE CASCADE,
          FOREIGN KEY (value_id) REFERENCES group_values(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS candidate_group_values (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          structure_id INTEGER NOT NULL,
          value_id INTEGER NOT NULL,
          UNIQUE(candidate_id, structure_id),
          FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
          FOREIGN KEY (structure_id) REFERENCES group_structures(id) ON DELETE CASCADE,
          FOREIGN KEY (value_id) REFERENCES group_values(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS election_eligibility_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          election_id INTEGER NOT NULL,
          structure_id INTEGER,
          value_id INTEGER,
          is_all_groups INTEGER NOT NULL DEFAULT 0,
          is_exclude INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
          FOREIGN KEY (structure_id) REFERENCES group_structures(id) ON DELETE CASCADE,
          FOREIGN KEY (value_id) REFERENCES group_values(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS group_verifier_values (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          structure_id INTEGER NOT NULL,
          value_id INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(user_id, structure_id, value_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (structure_id) REFERENCES group_structures(id) ON DELETE CASCADE,
          FOREIGN KEY (value_id) REFERENCES group_values(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_system INTEGER NOT NULL DEFAULT 0,
          permissions TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        args: [],
      },
      { sql: `INSERT OR IGNORE INTO roles (name, is_system, permissions) VALUES ('master_admin', 1, '{}')`, args: [] },
      { sql: `INSERT OR IGNORE INTO roles (name, is_system, permissions) VALUES ('admin', 1, '{}')`, args: [] },
      { sql: `INSERT OR IGNORE INTO roles (name, is_system, permissions) VALUES ('moderator', 1, '{}')`, args: [] },
      { sql: `INSERT OR IGNORE INTO roles (name, is_system, permissions) VALUES ('staff', 1, '{}')`, args: [] },
      { sql: `INSERT OR IGNORE INTO roles (name, is_system, permissions) VALUES ('member', 1, '{}')`, args: [] },
      { sql: `INSERT OR IGNORE INTO roles (name, is_system, permissions) VALUES ('unverified', 1, '{}')`, args: [] },
    ],
    'write'
  )

  // Seed default settings
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_verify_id', 'false')`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('otp_required_login', 'true')`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('app_name', 'Rizal High School Elections')`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('group_label_l1', 'Group')`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('group_label_l2', 'Subgroup')`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('group_label_l3', 'Unit')`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('doc_type_labels', '["Government ID","School ID","Employee ID"]')`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('org_type', 'school')`, args: [] })
  // Normalize legacy '1'/'0' values to 'true'/'false'
  await db.execute({ sql: `UPDATE settings SET value = ? WHERE key = ? AND value = ?`, args: ['true', 'otp_required_login', '1'] })
  await db.execute({ sql: `UPDATE settings SET value = ? WHERE key = ? AND value = ?`, args: ['false', 'auto_verify_id', '0'] })
  // Rebrand: normalize legacy community-hub branding to Rizal High School Elections
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

  // Add new columns (idempotent — silently skip if column already exists)
  const newColumns: string[] = [
    `ALTER TABLE users ADD COLUMN grade_level TEXT`,
    `ALTER TABLE users ADD COLUMN section TEXT`,
    `ALTER TABLE users ADD COLUMN intended_role TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN intended_role TEXT`,
    `ALTER TABLE candidates ADD COLUMN grade_level TEXT`,
    `ALTER TABLE candidates ADD COLUMN section TEXT`,
    `ALTER TABLE candidates ADD COLUMN student_user_id INTEGER`,
    `ALTER TABLE users ADD COLUMN grade_level_id INTEGER`,
    `ALTER TABLE users ADD COLUMN subtype_id INTEGER`,
    `ALTER TABLE users ADD COLUMN section_id INTEGER`,
    `ALTER TABLE users ADD COLUMN avatar_url TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN grade_level_id INTEGER`,
    `ALTER TABLE verification_requests ADD COLUMN subtype_id INTEGER`,
    `ALTER TABLE verification_requests ADD COLUMN section_id INTEGER`,
    `ALTER TABLE verification_requests ADD COLUMN doc_type TEXT`,
    `ALTER TABLE elections ADD COLUMN allow_teacher_vote INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE elections ADD COLUMN is_global INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE candidates ADD COLUMN user_id INTEGER`,
    `ALTER TABLE users ADD COLUMN needs_academic_update INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN verification_status TEXT`,
    `ALTER TABLE users ADD COLUMN verification_notes TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN updated_at TEXT`,
    `ALTER TABLE verification_documents ADD COLUMN created_at TEXT`,
    `ALTER TABLE verification_documents ADD COLUMN doc_type TEXT`,
    `ALTER TABLE users ADD COLUMN role_id INTEGER`,
    `ALTER TABLE users ADD COLUMN bio TEXT`,
    `ALTER TABLE candidates ADD COLUMN photo_url TEXT`,
    `ALTER TABLE candidates ADD COLUMN grade_level_id INTEGER`,
    `ALTER TABLE candidates ADD COLUMN subtype_id INTEGER`,
    `ALTER TABLE candidates ADD COLUMN section_id INTEGER`,
    `ALTER TABLE elections ADD COLUMN thumbnail_url TEXT`,
    `ALTER TABLE elections ADD COLUMN share_token TEXT`,
    `ALTER TABLE candidates ADD COLUMN platform TEXT`,
    `ALTER TABLE candidates ADD COLUMN qualifications TEXT`,
    `ALTER TABLE candidates ADD COLUMN achievements TEXT`,
    `ALTER TABLE candidates ADD COLUMN subtype TEXT`,
    `ALTER TABLE elections ADD COLUMN auto_start INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE elections ADD COLUMN auto_end INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE positions ADD COLUMN max_votes_mode TEXT NOT NULL DEFAULT 'custom'`,
    // Session 2: unified account/profile/verification flow
    `ALTER TABLE users ADD COLUMN lrn TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN lrn TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN profile_photo_url TEXT`,
    `ALTER TABLE verification_requests ADD COLUMN denied_fields TEXT`,
    // Session 4: election visible to non-eligible groups (read-only view, cannot vote)
    `ALTER TABLE elections ADD COLUMN visible_to_all INTEGER NOT NULL DEFAULT 0`,
    // Session 5: deadline warning toggle + user timeout/penalty
    `ALTER TABLE elections ADD COLUMN warn_non_voters INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN timeout_until TEXT`,
  ]
  for (const sql of newColumns) {
    await db.execute({ sql, args: [] }).catch(() => {})
  }

  // ── Configurable group structures: one-time migration from fixed grade/subtype/section model ──
  await migrateGroupStructures()

  // Migrate votes UNIQUE constraint: old=(election_id, position_id, voter_id) blocks multi-vote.
  // New=(election_id, position_id, voter_id, candidate_id) allows multiple candidates per position per voter.
  const votesMeta = await db.execute({
    sql: `SELECT sql FROM sqlite_master WHERE type='table' AND name='votes'`,
    args: [],
  })
  const votesTableSql = (votesMeta.rows[0]?.sql as string) ?? ''
  if (votesTableSql && !votesTableSql.includes('voter_id, candidate_id')) {
    await db.execute({ sql: `DROP TABLE IF EXISTS votes_mv`, args: [] })
    await db.execute({
      sql: `CREATE TABLE votes_mv (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        election_id INTEGER NOT NULL,
        position_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        voter_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(election_id, position_id, voter_id, candidate_id),
        FOREIGN KEY (election_id) REFERENCES elections(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        FOREIGN KEY (voter_id) REFERENCES users(id)
      )`,
      args: [],
    })
    await db.execute({
      sql: `INSERT OR IGNORE INTO votes_mv (id, election_id, position_id, candidate_id, voter_id, created_at)
            SELECT id, election_id, position_id, candidate_id, voter_id, created_at FROM votes`,
      args: [],
    })
    await db.execute({ sql: `DROP TABLE votes`, args: [] })
    await db.execute({ sql: `ALTER TABLE votes_mv RENAME TO votes`, args: [] })
  }

  // Seed default admin@localhost.local if missing
  const adminCheck = await db.execute({
    sql: `SELECT id FROM users WHERE email = 'admin@localhost.local'`,
    args: [],
  })
  if (adminCheck.rows.length === 0) {
    const hash = await bcrypt.hash('Admin@123', 12)
    await db.execute({
      sql: `INSERT INTO users (email, password_hash, name, role, email_verified, id_verified)
            VALUES ('admin@localhost.local', ?, 'Master Admin', 'master_admin', 1, 1)`,
      args: [hash],
    })
  }

  // Ensure rhenallenpabalan@gmail.com is always master_admin
  const rhenaCheck = await db.execute({
    sql: `SELECT id FROM users WHERE email = 'rhenallenpabalan@gmail.com'`,
    args: [],
  })
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

async function tableExists(name: string): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`,
    args: [name],
  })
  return r.rows.length > 0
}

/**
 * One-time migration from the fixed grade_levels/grade_subtypes/sections model
 * into the configurable group_structures/group_values model.
 * Guarded by settings flag `group_migration_v1`. Idempotent.
 *
 * - Legacy DB (grade_levels has rows): migrates all data, preserving assignments
 *   on users/candidates, election eligibility rules, and verifier scopes, then
 *   drops the legacy tables.
 * - Fresh DB: seeds a single required "Grade Level" structure with Grades 7-12.
 */
async function migrateGroupStructures(): Promise<void> {
  const flag = await db.execute({
    sql: `SELECT value FROM settings WHERE key = 'group_migration_v1'`,
    args: [],
  })
  if ((flag.rows[0]?.value as string) === 'done') return

  const structCount = await db.execute({ sql: `SELECT COUNT(*) as c FROM group_structures`, args: [] })
  if (Number(structCount.rows[0]?.c ?? 0) > 0) {
    await db.execute({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES ('group_migration_v1','done')`, args: [] })
    return
  }

  const hasGrades = await tableExists('grade_levels')
  const legacyGrades = hasGrades
    ? await db.execute({ sql: `SELECT * FROM grade_levels ORDER BY order_index, id`, args: [] })
    : { rows: [] as any[] }

  if (legacyGrades.rows.length === 0) {
    // Fresh install: seed one required Grade Level structure with default grades.
    const s = await db.execute({
      sql: `INSERT INTO group_structures (name, parent_structure_id, is_required, order_index) VALUES ('Grade Level', NULL, 1, 0)`,
      args: [],
    })
    const sid = Number(s.lastInsertRowid)
    const grades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']
    for (let i = 0; i < grades.length; i++) {
      await db.execute({
        sql: `INSERT INTO group_values (structure_id, parent_value_id, name, order_index) VALUES (?, NULL, ?, ?)`,
        args: [sid, grades[i], i],
      })
    }
    await db.execute({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES ('group_migration_v1','done')`, args: [] })
    return
  }

  // ── Legacy migration ──
  // 1. Create the three leveled structures: Grade Level → Strand → Section
  const glStruct = await db.execute({
    sql: `INSERT INTO group_structures (name, parent_structure_id, is_required, order_index) VALUES ('Grade Level', NULL, 1, 0)`,
    args: [],
  })
  const glStructId = Number(glStruct.lastInsertRowid)
  const strandStruct = await db.execute({
    sql: `INSERT INTO group_structures (name, parent_structure_id, is_required, order_index) VALUES ('Strand', ?, 0, 1)`,
    args: [glStructId],
  })
  const strandStructId = Number(strandStruct.lastInsertRowid)
  const secStruct = await db.execute({
    sql: `INSERT INTO group_structures (name, parent_structure_id, is_required, order_index) VALUES ('Section', ?, 0, 2)`,
    args: [strandStructId],
  })
  const secStructId = Number(secStruct.lastInsertRowid)

  // 2. Migrate grade levels → group_values (map old id → new value id)
  const gradeMap = new Map<number, number>()
  for (const row of legacyGrades.rows as any[]) {
    const v = await db.execute({
      sql: `INSERT INTO group_values (structure_id, parent_value_id, name, order_index, active) VALUES (?, NULL, ?, ?, ?)`,
      args: [glStructId, row.name, Number(row.order_index ?? 0), Number(row.active ?? 1)],
    })
    gradeMap.set(Number(row.id), Number(v.lastInsertRowid))
  }

  // 3. Migrate subtypes → group_values (parent = mapped grade)
  const subtypeMap = new Map<number, number>()
  if (await tableExists('grade_subtypes')) {
    const subs = await db.execute({ sql: `SELECT * FROM grade_subtypes ORDER BY order_index, id`, args: [] })
    for (const row of subs.rows as any[]) {
      const parent = gradeMap.get(Number(row.grade_level_id)) ?? null
      const v = await db.execute({
        sql: `INSERT INTO group_values (structure_id, parent_value_id, name, order_index, active) VALUES (?, ?, ?, ?, ?)`,
        args: [strandStructId, parent, row.name, Number(row.order_index ?? 0), Number(row.active ?? 1)],
      })
      subtypeMap.set(Number(row.id), Number(v.lastInsertRowid))
    }
  }

  // 4. Migrate sections → group_values (parent = mapped subtype, else mapped grade)
  const sectionMap = new Map<number, number>()
  if (await tableExists('sections')) {
    const secs = await db.execute({ sql: `SELECT * FROM sections ORDER BY order_index, id`, args: [] })
    for (const row of secs.rows as any[]) {
      const parent = row.subtype_id != null
        ? subtypeMap.get(Number(row.subtype_id)) ?? null
        : gradeMap.get(Number(row.grade_level_id)) ?? null
      const v = await db.execute({
        sql: `INSERT INTO group_values (structure_id, parent_value_id, name, order_index, active) VALUES (?, ?, ?, ?, ?)`,
        args: [secStructId, parent, row.name, Number(row.order_index ?? 0), Number(row.active ?? 1)],
      })
      sectionMap.set(Number(row.id), Number(v.lastInsertRowid))
    }
  }

  // 5. Migrate user assignments
  const users = await db.execute({ sql: `SELECT id, grade_level_id, subtype_id, section_id FROM users`, args: [] })
  for (const u of users.rows as any[]) {
    const uid = Number(u.id)
    if (u.grade_level_id != null && gradeMap.has(Number(u.grade_level_id))) {
      await db.execute({ sql: `INSERT OR IGNORE INTO user_group_values (user_id, structure_id, value_id) VALUES (?,?,?)`, args: [uid, glStructId, gradeMap.get(Number(u.grade_level_id))!] })
    }
    if (u.subtype_id != null && subtypeMap.has(Number(u.subtype_id))) {
      await db.execute({ sql: `INSERT OR IGNORE INTO user_group_values (user_id, structure_id, value_id) VALUES (?,?,?)`, args: [uid, strandStructId, subtypeMap.get(Number(u.subtype_id))!] })
    }
    if (u.section_id != null && sectionMap.has(Number(u.section_id))) {
      await db.execute({ sql: `INSERT OR IGNORE INTO user_group_values (user_id, structure_id, value_id) VALUES (?,?,?)`, args: [uid, secStructId, sectionMap.get(Number(u.section_id))!] })
    }
  }

  // 6. Migrate candidate assignments
  const cands = await db.execute({ sql: `SELECT id, grade_level_id, subtype_id, section_id FROM candidates`, args: [] })
  for (const c of cands.rows as any[]) {
    const cid = Number(c.id)
    if (c.grade_level_id != null && gradeMap.has(Number(c.grade_level_id))) {
      await db.execute({ sql: `INSERT OR IGNORE INTO candidate_group_values (candidate_id, structure_id, value_id) VALUES (?,?,?)`, args: [cid, glStructId, gradeMap.get(Number(c.grade_level_id))!] })
    }
    if (c.subtype_id != null && subtypeMap.has(Number(c.subtype_id))) {
      await db.execute({ sql: `INSERT OR IGNORE INTO candidate_group_values (candidate_id, structure_id, value_id) VALUES (?,?,?)`, args: [cid, strandStructId, subtypeMap.get(Number(c.subtype_id))!] })
    }
    if (c.section_id != null && sectionMap.has(Number(c.section_id))) {
      await db.execute({ sql: `INSERT OR IGNORE INTO candidate_group_values (candidate_id, structure_id, value_id) VALUES (?,?,?)`, args: [cid, secStructId, sectionMap.get(Number(c.section_id))!] })
    }
  }

  // 7. Migrate election eligibility
  if (await tableExists('election_eligibility')) {
    const rules = await db.execute({ sql: `SELECT * FROM election_eligibility`, args: [] })
    for (const r of rules.rows as any[]) {
      const eid = Number(r.election_id)
      const isExclude = Number(r.is_exclude ?? 0)
      if (Number(r.is_all_grade ?? 0) === 1) {
        await db.execute({ sql: `INSERT INTO election_eligibility_rules (election_id, structure_id, value_id, is_all_groups, is_exclude) VALUES (?, NULL, NULL, 1, ?)`, args: [eid, isExclude] })
      } else if (r.section_id != null && sectionMap.has(Number(r.section_id))) {
        await db.execute({ sql: `INSERT INTO election_eligibility_rules (election_id, structure_id, value_id, is_all_groups, is_exclude) VALUES (?, ?, ?, 0, ?)`, args: [eid, secStructId, sectionMap.get(Number(r.section_id))!, isExclude] })
      } else if (r.subtype_id != null && subtypeMap.has(Number(r.subtype_id))) {
        await db.execute({ sql: `INSERT INTO election_eligibility_rules (election_id, structure_id, value_id, is_all_groups, is_exclude) VALUES (?, ?, ?, 0, ?)`, args: [eid, strandStructId, subtypeMap.get(Number(r.subtype_id))!, isExclude] })
      } else if (r.grade_level_id != null && gradeMap.has(Number(r.grade_level_id))) {
        await db.execute({ sql: `INSERT INTO election_eligibility_rules (election_id, structure_id, value_id, is_all_groups, is_exclude) VALUES (?, ?, ?, 0, ?)`, args: [eid, glStructId, gradeMap.get(Number(r.grade_level_id))!, isExclude] })
      }
    }
  }

  // 8. Migrate verifier scopes (deepest non-null id per row)
  if (await tableExists('group_verifiers')) {
    const gv = await db.execute({ sql: `SELECT * FROM group_verifiers`, args: [] })
    for (const r of gv.rows as any[]) {
      const uid = Number(r.user_id)
      if (r.section_id != null && sectionMap.has(Number(r.section_id))) {
        await db.execute({ sql: `INSERT OR IGNORE INTO group_verifier_values (user_id, structure_id, value_id) VALUES (?,?,?)`, args: [uid, secStructId, sectionMap.get(Number(r.section_id))!] })
      } else if (r.subtype_id != null && subtypeMap.has(Number(r.subtype_id))) {
        await db.execute({ sql: `INSERT OR IGNORE INTO group_verifier_values (user_id, structure_id, value_id) VALUES (?,?,?)`, args: [uid, strandStructId, subtypeMap.get(Number(r.subtype_id))!] })
      } else if (r.grade_level_id != null && gradeMap.has(Number(r.grade_level_id))) {
        await db.execute({ sql: `INSERT OR IGNORE INTO group_verifier_values (user_id, structure_id, value_id) VALUES (?,?,?)`, args: [uid, glStructId, gradeMap.get(Number(r.grade_level_id))!] })
      }
    }
  }

  // 9. Drop legacy tables (full cutover). Dead id columns on users/candidates/
  //    verification_requests are left in place (harmless; avoids table rebuild).
  for (const t of ['group_verifiers', 'teacher_assignments', 'election_eligibility', 'sections', 'grade_subtypes', 'grade_levels']) {
    await db.execute({ sql: `DROP TABLE IF EXISTS ${t}`, args: [] }).catch(() => {})
  }

  await db.execute({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES ('group_migration_v1','done')`, args: [] })
}
