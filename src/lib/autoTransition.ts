import { db } from '@/lib/db'

export async function checkAutoTransition(electionId: number): Promise<void> {
  const now = new Date().toISOString()
  const result = await db.execute({
    sql: 'SELECT id, status, start_date, end_date, auto_start, auto_end FROM elections WHERE id = ?',
    args: [electionId],
  })
  const el = result.rows[0]
  if (!el) return

  if (el.status === 'draft' && el.auto_start && (el.start_date as string) <= now) {
    const pCount = await db.execute({ sql: 'SELECT COUNT(*) as n FROM positions WHERE election_id = ?', args: [electionId] })
    const cCount = await db.execute({ sql: 'SELECT COUNT(*) as n FROM candidates WHERE election_id = ?', args: [electionId] })
    if (
      Number((pCount.rows[0] as unknown as { n: number }).n) > 0 &&
      Number((cCount.rows[0] as unknown as { n: number }).n) > 0
    ) {
      await db.execute({ sql: "UPDATE elections SET status='active', updated_at=datetime('now') WHERE id=?", args: [electionId] })
    }
  }

  if (el.status === 'active' && el.auto_end && (el.end_date as string) <= now) {
    await db.execute({ sql: "UPDATE elections SET status='ended', updated_at=datetime('now') WHERE id=?", args: [electionId] })
  }
}
