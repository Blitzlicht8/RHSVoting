/* Write-path smoke: INSERT RETURNING id (lastInsertRowid), datetime('now'), batch, ON CONFLICT. Cleans up. */
import { readFileSync } from 'node:fs'; import { resolve } from 'node:path'
function loadEnv() { const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8'); for (const line of raw.split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const eq = t.indexOf('='); if (eq === -1) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v } }
loadEnv()
async function main() {
  const { db, ensureInit } = await import('../src/lib/db'); await ensureInit()
  // INSERT ... datetime('now') with RETURNING id → lastInsertRowid
  const ins = await db.execute({ sql: `INSERT INTO user_logs (user_id, action, details, created_at) VALUES (?, ?, ?, datetime('now')) RETURNING id`, args: [null, '__smoke_test__', 'x'] })
  const id = Number(ins.lastInsertRowid)
  if (!id || id < 1) throw new Error('lastInsertRowid not returned: ' + id)
  const back = await db.execute({ sql: `SELECT action, created_at FROM user_logs WHERE id = ?`, args: [id] })
  const ts = String((back.rows[0] as any).created_at)
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(ts)) throw new Error('datetime format wrong: ' + ts)
  // batch transaction
  await db.batch([
    { sql: `UPDATE user_logs SET details = ? WHERE id = ?`, args: ['y', id] },
    { sql: `UPDATE user_logs SET details = ? WHERE id = ?`, args: ['z', id] },
  ], 'write')
  // INSERT OR IGNORE (→ ON CONFLICT DO NOTHING) on settings pk
  await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, args: ['app_name', 'SHOULD_NOT_OVERWRITE'] })
  const s = await db.execute({ sql: `SELECT value FROM settings WHERE key='app_name'`, args: [] })
  if ((s.rows[0] as any).value === 'SHOULD_NOT_OVERWRITE') throw new Error('OR IGNORE overwrote existing')
  // INSERT OR REPLACE settings (→ ON CONFLICT key DO UPDATE)
  await db.execute({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, args: ['__smoke_key__', 'v1'] })
  await db.execute({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, args: ['__smoke_key__', 'v2'] })
  const sr = await db.execute({ sql: `SELECT value FROM settings WHERE key='__smoke_key__'`, args: [] })
  if ((sr.rows[0] as any).value !== 'v2') throw new Error('OR REPLACE did not upsert')
  // cleanup
  await db.execute({ sql: `DELETE FROM user_logs WHERE id = ?`, args: [id] })
  await db.execute({ sql: `DELETE FROM settings WHERE key='__smoke_key__'`, args: [] })
  console.log('✓ write-path OK: RETURNING id / datetime text / batch / ON CONFLICT DO NOTHING / ON CONFLICT DO UPDATE')
  process.exit(0)
}
main().catch((e) => { console.error('✗', e.message); process.exit(1) })
