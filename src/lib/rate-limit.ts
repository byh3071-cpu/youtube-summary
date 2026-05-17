/**
 * 프로세스 메모리 기반 고정 창 레이트 리밋 (서버리스 인스턴스당).
 * 남용 완화용이며, 다중 인스턴스 간에는 공유되지 않음.
 */

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()

const PRUNE_THRESHOLD = 4000

function pruneExpired(now: number) {
  if (store.size < PRUNE_THRESHOLD) return
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k)
  }
}

export function takeToken(
  key: string,
  maxInWindow: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  pruneExpired(now)

  const cap = Math.max(1, Math.min(maxInWindow, 200))
  const periodMs = Math.max(5_000, Math.min(windowMs, 3600_000))

  const existing = store.get(key)
  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + periodMs })
    return { ok: true }
  }
  if (existing.count < cap) {
    existing.count += 1
    return { ok: true }
  }
  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  return { ok: false, retryAfterSec }
}
