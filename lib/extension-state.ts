/**
 * Shared guard for in-flight extension mutations (install / uninstall /
 * enable / disable).
 *
 * Problem it solves: after a user click, an optimistic UI update is applied
 * instantly, but the SSE-driven background sync (and the `zerf_extensions_*`
 * custom events it fires) can land BEFORE the mutation POST completes and
 * re-read stale server data — visually flipping the toggle back and forth
 * ("сначала убралось, потом появилось").
 *
 * While any mutation is fresh (within PENDING_WINDOW_MS), listeners must
 * ignore extension-state refreshes; the mutation's own response handler is
 * the source of truth during that window.
 */

const PENDING_WINDOW_MS = 8000

const pendingMutations = new Map<string, number>()

export function markExtensionPending(key: string): void {
  pendingMutations.set(key, Date.now())
}

export function clearExtensionPending(key: string): void {
  pendingMutations.delete(key)
}

/** True while at least one extension mutation is still in flight (fresh). */
export function hasFreshExtensionPending(): boolean {
  const now = Date.now()
  for (const [key, ts] of pendingMutations.entries()) {
    if (now - ts > PENDING_WINDOW_MS) {
      pendingMutations.delete(key)
    }
  }
  return pendingMutations.size > 0
}
