import { db } from './db'
import { Role } from '@/types'

/**
 * Reads a role's granular permission scope from the `roles` table.
 * master_admin always has full control. Any other role grants a scope only
 * when its permissions JSON has that key truthy. Falls back to false on any
 * parse/query error (deny by default).
 */
export async function hasPermission(role: Role, scope: string): Promise<boolean> {
  if (role === 'master_admin') return true
  try {
    const r = await db.execute({
      sql: 'SELECT permissions FROM roles WHERE name = ?',
      args: [role as string],
    })
    const raw = r.rows[0]?.permissions
    if (!raw) return false
    const perms = JSON.parse(String(raw)) as Record<string, unknown>
    return !!perms[scope]
  } catch {
    return false
  }
}
