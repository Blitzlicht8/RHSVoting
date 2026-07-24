// Tiny in-memory TTL cache for read-heavy, low-churn, GLOBAL (non-per-user) data.
// Lives per server instance (per Vercel lambda). Short TTL bounds cross-instance
// staleness; explicit invalidate() on writes keeps the writing instance fresh
// immediately. Do NOT use for per-user or vote-volatile data.
type Entry = { value: unknown; expires: number }

const store = new Map<string, Entry>()

/** Return cached value if fresh, else run loader, store with ttlMs, and return it. */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.expires > now) return hit.value as T
  const value = await loader()
  store.set(key, { value, expires: now + ttlMs })
  return value
}

export function invalidate(key: string): void {
  store.delete(key)
}

export function invalidatePrefix(prefix: string): void {
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

// Cache keys used across the app (keep centralized to avoid typos).
export const CACHE_KEYS = {
  settings: 'settings:all',
  groupsTree: 'groups:tree:active',
  rolesList: 'roles:list',
} as const

// Default TTL for global config reads (ms).
export const CONFIG_TTL = 60_000
