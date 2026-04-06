/**
 * Web platform sync queue adapter using localStorage.
 * Spec §14: store offline actions locally, drain on reconnect.
 *
 * This module manages persistence of the SyncQueue to/from localStorage.
 * The pure queue logic lives in @pm/domain/sync.
 */

import {
  createQueue,
  dequeue,
  enqueue,
  incrementRetry,
  type SyncQueue,
  type SyncQueueItem,
  type SyncOperation,
} from "@pm/domain";

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const QUEUE_STORAGE_KEY = "pm_sync_queue";

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

/** Loads the sync queue from localStorage. Returns an empty queue if missing/corrupt. */
export function loadQueue(): SyncQueue {
  if (typeof window === "undefined") return createQueue();
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return createQueue();
    const parsed = JSON.parse(raw) as SyncQueue;
    // Basic shape validation
    if (!Array.isArray(parsed.items)) return createQueue();
    return parsed;
  } catch {
    return createQueue();
  }
}

/** Saves the queue to localStorage. */
export function saveQueue(queue: SyncQueue): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full or unavailable — log and continue
    console.warn("[sync] Could not persist sync queue:", queue.items.length, "items");
  }
}

/** Clears the persisted queue (e.g. after a full successful drain). */
export function clearQueue(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(QUEUE_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Convenience wrappers (load → mutate → save)
// ---------------------------------------------------------------------------

/**
 * Enqueues a new operation, persists, and returns the updated queue.
 * Call this from any server action wrapper that needs to queue offline writes.
 */
export function enqueueOfflineOperation(
  table: string,
  operation: SyncOperation,
  record_id: string,
  payload: Record<string, unknown>,
): SyncQueue {
  const queue = loadQueue();
  const updated = enqueue(queue, {
    table,
    operation,
    record_id,
    payload,
    timestamp: Date.now(),
    max_retries: 3,
  });
  saveQueue(updated);
  return updated;
}

/** Marks an item as synced and removes it from the persisted queue. */
export function markSynced(id: string): SyncQueue {
  const queue = loadQueue();
  const updated = dequeue(queue, id);
  saveQueue(updated);
  return updated;
}

/** Increments the retry counter for a failed item and persists. */
export function markRetryFailed(id: string): SyncQueue {
  const queue = loadQueue();
  const updated = incrementRetry(queue, id);
  saveQueue(updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Introspection
// ---------------------------------------------------------------------------

export function getPendingCount(): number {
  return loadQueue().items.length;
}

export function getAllPending(): SyncQueueItem[] {
  return loadQueue().items;
}
