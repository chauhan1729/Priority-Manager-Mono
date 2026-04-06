/**
 * Offline sync queue — pure data structures and operations.
 * Spec §14: queue offline actions locally, drain on reconnect.
 *
 * Platform adapters (localStorage, AsyncStorage) live in their respective apps.
 * This module contains only the queue logic, fully testable without I/O.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncOperation = "create" | "update" | "delete";

/**
 * A single item in the offline sync queue.
 * Stores enough information to replay the operation against the remote DB.
 */
export interface SyncQueueItem {
  /** Locally generated stable ID for this queue entry. */
  readonly id: string;
  /** The Supabase/Postgres table name (e.g. "activities", "meetings"). */
  readonly table: string;
  /** The CRUD operation to replay. */
  readonly operation: SyncOperation;
  /** The primary key of the affected row. */
  readonly record_id: string;
  /** Full or partial payload to send (for create/update). Empty for delete. */
  readonly payload: Record<string, unknown>;
  /** Unix ms timestamp when this item was enqueued. */
  readonly timestamp: number;
  /** How many times we've already attempted to sync this item. */
  readonly retries: number;
  /** Maximum retries before we give up and log an error. Default: 3. */
  readonly max_retries: number;
}

export interface SyncQueue {
  readonly items: SyncQueueItem[];
}

// ---------------------------------------------------------------------------
// Queue operations (pure — return new queue, never mutate)
// ---------------------------------------------------------------------------

/** Stable local UUID generator (no crypto dependency). */
export function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Adds a new item to the end of the queue.
 * Enforces: duplicate (table, record_id, operation) coalesces for "update"
 * so we never replay stale intermediate updates.
 */
export function enqueue(
  queue: SyncQueue,
  item: Omit<SyncQueueItem, "id" | "retries">,
): SyncQueue {
  // For updates: if an update for the same record is already queued,
  // replace its payload with the latest (last-write-wins optimism).
  if (item.operation === "update") {
    const existing = queue.items.findIndex(
      (q) => q.table === item.table && q.record_id === item.record_id && q.operation === "update",
    );
    if (existing !== -1) {
      const merged: SyncQueueItem = {
        ...queue.items[existing]!,
        payload: { ...queue.items[existing]!.payload, ...item.payload },
        timestamp: item.timestamp,
      };
      const next = [...queue.items];
      next[existing] = merged;
      return { items: next };
    }
  }

  const newItem: SyncQueueItem = { ...item, id: generateLocalId(), retries: 0 };
  return { items: [...queue.items, newItem] };
}

/** Removes a successfully synced item from the queue by id. */
export function dequeue(queue: SyncQueue, id: string): SyncQueue {
  return { items: queue.items.filter((item) => item.id !== id) };
}

/** Increments the retry counter for a failed item. */
export function incrementRetry(queue: SyncQueue, id: string): SyncQueue {
  return {
    items: queue.items.map((item) =>
      item.id === id ? { ...item, retries: item.retries + 1 } : item,
    ),
  };
}

/** Returns true when an item has exhausted its retry budget. */
export function isExhausted(item: SyncQueueItem): boolean {
  return item.retries >= item.max_retries;
}

/**
 * Returns all items that are eligible for retry (not yet exhausted).
 * Ordered oldest-first to preserve causal order.
 */
export function getRetryable(queue: SyncQueue): SyncQueueItem[] {
  return queue.items.filter((item) => !isExhausted(item));
}

/**
 * Returns exhausted items that need to be surfaced as sync errors.
 */
export function getExhausted(queue: SyncQueue): SyncQueueItem[] {
  return queue.items.filter(isExhausted);
}

/** Returns the number of pending items (total queue depth). */
export function queueDepth(queue: SyncQueue): number {
  return queue.items.length;
}

/** Returns true if queue is empty. */
export function isQueueEmpty(queue: SyncQueue): boolean {
  return queue.items.length === 0;
}

/** Creates an empty queue. */
export function createQueue(): SyncQueue {
  return { items: [] };
}
