/**
 * Offline mutation queue (outbox pattern).
 *
 * When the device is offline, user mutations (create / update / complete /
 * delete of tasks, notes, goals, habits) are persisted to localStorage and
 * replayed against the API as soon as connectivity returns. Local state is
 * the source of truth during the offline window: items created offline keep
 * temporary IDs and are swapped to their real DB records after the queued
 * create succeeds (REPLACE_* actions in the store).
 */

export type OfflineItemType = 'task' | 'note' | 'goal' | 'habit'
export type OfflineOpKind = 'create' | 'update' | 'delete'

export interface OfflineOp {
  opId: string
  kind: OfflineOpKind
  itemType: OfflineItemType
  /** Temporary local ID for items created while offline. */
  tempId?: string
  /** Real DB ID for mutations to already-synced items. */
  serverId?: string
  /** create: item body; update: field updates; delete: unused. */
  payload: any
  queuedAt: number
}

const QUEUE_KEY = 'zerf_offline_queue'
const ID_MAP_KEY = 'zerf_offline_id_map'

/** true while the replay loop is running — sync must not clobber it. */
let flushInProgress = false

export function isFlushInProgress(): boolean {
  return flushInProgress
}
export function setFlushInProgress(v: boolean): void {
  flushInProgress = v
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function newOpId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function loadQueue(): OfflineOp[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQueue(queue: OfflineOp[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {}
  notifyQueueChanged()
}

export function notifyQueueChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('zerf_offline_queue_changed', {
      detail: { pending: loadQueue().length },
    }))
  } catch {}
}

export function enqueueOp(op: Omit<OfflineOp, 'opId' | 'queuedAt'>): OfflineOp {
  const full: OfflineOp = { ...op, opId: newOpId(), queuedAt: Date.now() }
  const queue = loadQueue()

  // Offline create + later delete of the same temp item cancel each other
  // out — nothing ever reached the server, so nothing needs syncing.
  if (full.kind === 'delete' && full.tempId) {
    const createIdx = queue.findIndex(q => q.kind === 'create' && q.tempId === full.tempId)
    if (createIdx !== -1) {
      // Drop the create and any intermediate updates for this temp item.
      const filtered = queue.filter(
        q => !(q.tempId === full.tempId && (q.kind === 'create' || q.kind === 'update'))
      )
      if (filtered.length !== queue.length) {
        saveQueue(filtered)
        return full
      }
    }
  }

  queue.push(full)
  saveQueue(queue)
  return full
}

export function removeOp(opId: string): void {
  saveQueue(loadQueue().filter(q => q.opId !== opId))
}

export function getQueuedCount(): number {
  return loadQueue().length
}

/** tempId -> serverId map filled during replay. */
export function loadIdMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(ID_MAP_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveIdMapEntry(tempId: string, serverId: string): void {
  try {
    const map = loadIdMap()
    map[tempId] = serverId
    localStorage.setItem(ID_MAP_KEY, JSON.stringify(map))
  } catch {}
}

export function clearIdMap(): void {
  try {
    localStorage.removeItem(ID_MAP_KEY)
  } catch {}
}

/** True if a queued create op still references this temp ID. */
export function queueHasCreate(tempId: string): boolean {
  return loadQueue().some(q => q.kind === 'create' && q.tempId === tempId)
}
