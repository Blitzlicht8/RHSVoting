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

export const db = makeClient()

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
          UNIQUE(election_id, position_id, voter_id),
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
        sql: `CREATE TABLE IF NOT EXISTS grade_levels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          order_index INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS grade_subtypes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          grade_level_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          order_index INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE,
          UNIQUE(grade_level_id, name)
        )`,
        args: [],
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS sections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          grade_level_id INTEGER NOT NULL,
          subtype_id INTEGER,
          name TEXT NOT NULL,
          order_index INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE,
          FOREIGN KEY (subtype_id) REFERENCES grade_subtypes(id) ON DELETE CASCADE,
          UNIQUE(grade_level_id, subtype_id, name)
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
        sql: `CREATE TABLE IF NOT EXISTS election_eligibility (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          election_id INTEGER NOT NULL,
          grade_level_id INTEGER,
          subtype_id INTEGER,
          section_id INTEGER,
          is_all_grade INTEGER NOT NULL DEFAULT 0,
          is_all_subtype INTEGER NOT NULL DEFAULT 0,
          is_all_section INTEGER NOT NULL DEFAULT 0,
          is_exclude INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
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
        sql: `CREATE TABLE IF NOT EXISTS teacher_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL,
          grade_level_id INTEGER,
          subtype_id INTEGER,
          section_id INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(teacher_id, grade_level_id, subtype_id, section_id),
          FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE,
          FOREIGN KEY (subtype_id) REFERENCES grade_subtypes(id) ON DELETE CASCADE,
          FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
        )`,
        args: [],
      },
    ],
    'write'
  )

  // Seed default settings
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_verify_id', 'false')`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('otp_required_login', 'true')`, args: [] })
  // Normalize legacy '1'/'0' values to 'true'/'false'
  await db.execute({ sql: `UPDATE settings SET value = ? WHERE key = ? AND value = ?`, args: ['true', 'otp_required_login', '1'] })
  await db.execute({ sql: `UPDATE settings SET value = ? WHERE key = ? AND value = ?`, args: ['false', 'auto_verify_id', '0'] })

  // Seed default grade levels
  await db.execute({ sql: `INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 7', 0)`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 8', 1)`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 9', 2)`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 10', 3)`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 11', 4)`, args: [] })
  await db.execute({ sql: `INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 12', 5)`, args: [] })

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
    `ALTER TABLE verification_requests ADD COLUMN updated_at TEXT`,
  ]
  for (const sql of newColumns) {
    await db.execute({ sql, args: [] }).catch(() => {})
  }

  // Seed default admin@school.edu if missing
  const adminCheck = await db.execute({
    sql: `SELECT id FROM users WHERE email = 'admin@school.edu'`,
    args: [],
  })
  if (adminCheck.rows.length === 0) {
    const hash = await bcrypt.hash('Admin@123', 12)
    await db.execute({
      sql: `INSERT INTO users (email, password_hash, name, role, email_verified, id_verified)
            VALUES ('admin@school.edu', ?, 'Master Admin', 'master_admin', 1, 1)`,
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
