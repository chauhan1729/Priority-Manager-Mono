/**
 * Mobile offline sync queue adapter.
 * Spec §14: store offline actions locally (AsyncStorage), drain on reconnect.
 *
 * Uses the same shared SyncQueueItem / queue logic from @pm/domain as the web
 * adapter — only the storage mechanism differs (AsyncStorage vs localStorage).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueue,
  dequeue,
  enqueue,
  incrementRetry,
  getRetryable,
  getExhausted,
  isExhausted,
  queueDepth,
  isQueueEmpty,
  type SyncQueue,
  type SyncQueueItem,
  type SyncOperation,
} from '@pm/domain';

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const QUEUE_KEY = '@pm/sync_queue';

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

export async function loadQueue(): Promise<SyncQueue> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return createQueue();
    const parsed = JSON.parse(raw) as SyncQueue;
    if (!Array.isArray(parsed.items)) return createQueue();
    return parsed;
  } catch {
    return createQueue();
  }
}

export async function saveQueue(queue: SyncQueue): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('[sync] Could not persist sync queue:', err);
  }
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

// ---------------------------------------------------------------------------
// Convenience wrappers (load → mutate → save)
// ---------------------------------------------------------------------------

export async function enqueueOfflineOperation(
  table: string,
  operation: SyncOperation,
  record_id: string,
  payload: Record<string, unknown>,
): Promise<SyncQueue> {
  const queue = await loadQueue();
  const updated = enqueue(queue, {
    table,
    operation,
    record_id,
    payload,
    timestamp: Date.now(),
    max_retries: 3,
  });
  await saveQueue(updated);
  return updated;
}

export async function markSynced(id: string): Promise<SyncQueue> {
  const queue = await loadQueue();
  const updated = dequeue(queue, id);
  await saveQueue(updated);
  return updated;
}

export async function markRetryFailed(id: string): Promise<SyncQueue> {
  const queue = await loadQueue();
  const updated = incrementRetry(queue, id);
  await saveQueue(updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Drain queue (Supabase client from @supabase/supabase-js)
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveConflict } from '@pm/domain';

export interface MobileDrainResult {
  applied: number;
  skipped: number;
  errors: number;
  exhausted: SyncQueueItem[];
}

/**
 * Drains all retryable items from the queue to Supabase.
 * Call from NetInfo online handler or app foreground event.
 */
export async function drainQueue(supabase: SupabaseClient): Promise<MobileDrainResult> {
  const queue = await loadQueue();
  const retryable = getRetryable(queue);
  const result: MobileDrainResult = { applied: 0, skipped: 0, errors: 0, exhausted: [] };

  for (const item of retryable) {
    try {
      if (item.operation === 'create') {
        const { error } = await supabase.from(item.table).insert(item.payload);
        if (error) throw error;
        await markSynced(item.id);
        result.applied++;
        continue;
      }

      if (item.operation === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.record_id);
        if (error) throw error;
        await markSynced(item.id);
        result.applied++;
        continue;
      }

      // update — conflict check
      const { data: serverRecord } = await supabase
        .from(item.table)
        .select('updated_at')
        .eq('id', item.record_id)
        .maybeSingle();

      const serverUpdatedAt = (serverRecord as { updated_at?: string } | null)?.updated_at ?? null;
      const decision = resolveConflict(item, serverUpdatedAt);

      if (decision === 'skip') {
        await markSynced(item.id);
        result.skipped++;
        continue;
      }

      const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.record_id);
      if (error) throw error;

      await markSynced(item.id);
      result.applied++;
    } catch (err) {
      const updatedQueue = await markRetryFailed(item.id);
      const updatedItem = updatedQueue.items.find((i) => i.id === item.id);
      if (updatedItem && isExhausted(updatedItem)) {
        result.exhausted.push(updatedItem);
        await markSynced(item.id);
      }
      result.errors++;
      console.warn('[sync] Item failed:', item.id, err);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Introspection
// ---------------------------------------------------------------------------

export async function getPendingCount(): Promise<number> {
  return queueDepth(await loadQueue());
}

export async function isQueueDrained(): Promise<boolean> {
  return isQueueEmpty(await loadQueue());
}

export { getRetryable, getExhausted };
