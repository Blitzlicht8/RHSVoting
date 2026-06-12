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
    ],
    'write'
  )

  // Seed default settings
  await db.batch(
    [
      {
        sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_verify_id', 'false')`,
        args: [],
      },
      {
        sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('otp_required_login', 'true')`,
        args: [],
      },
    ],
    'write'
  )

  // Seed master admin only if no admin exists yet
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
}
