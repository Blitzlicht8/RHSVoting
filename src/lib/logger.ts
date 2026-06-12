import { db } from '@/lib/db'

export async function logActivity(
  userId: number | null,
  action: string,
  details?: string,
  ip?: string
): Promise<void> {
  try {
    await db.execute({
      sql: 'INSERT INTO user_logs (user_id, action, details, ip) VALUES (?, ?, ?, ?)',
      args: [userId, action, details ?? null, ip ?? null],
    })
  } catch {
    // log failures should never crash the app
  }
}
