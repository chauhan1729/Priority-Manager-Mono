/**
 * Drains the offline sync queue to Supabase when the user comes back online.
 * Spec §14: sync automatically once online; last-write-wins conflict resolution.
 *
 * Processes items oldest-first to preserve causal order.
 * On error: increments retry counter, leaves in queue.
 * On exhaustion: removes from queue and logs (surface to user via SyncProvider).
 */

import {
  getExhausted,
  getRetryable,
  isExhausted,
  resolveConflict,
  type SyncQueueItem,
  type SyncResult,
} from "@pm/domain";

import type { SupabaseClient } from "@supabase/supabase-js";

import { markRetryFailed, markSynced } from "./web-sync-store";

// ---------------------------------------------------------------------------
// Core drain logic
// ---------------------------------------------------------------------------

/**
 * Attempts to sync a single queue item to Supabase.
 * Returns a SyncResult indicating applied, skipped, or error.
 */
async function syncItem(
  supabase: SupabaseClient,
  item: SyncQueueItem,
): Promise<SyncResult> {
  try {
    if (item.operation === "create") {
      const { error } = await supabase.from(item.table).insert(item.payload);
      if (error) throw error;
      return { id: item.id, status: "applied" };
    }

    if (item.operation === "delete") {
      const { error } = await supabase
        .from(item.table)
        .delete()
        .eq("id", item.record_id);
      if (error) throw error;
      return { id: item.id, status: "applied" };
    }

    // update — fetch server record first to resolve conflicts
    const { data: serverRecord, error: fetchError } = await supabase
      .from(item.table)
      .select("updated_at")
      .eq("id", item.record_id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const serverUpdatedAt = (serverRecord as { updated_at?: string } | null)?.updated_at ?? null;
    const decision = resolveConflict(item, serverUpdatedAt);

    if (decision === "skip") {
      return { id: item.id, status: "skipped" };
    }

    const { error: updateError } = await supabase
      .from(item.table)
      .update(item.payload)
      .eq("id", item.record_id);
    if (updateError) throw updateError;

    return { id: item.id, status: "applied" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { id: item.id, status: "error", error: message };
  }
}

// ---------------------------------------------------------------------------
// Drain queue
// ---------------------------------------------------------------------------

export interface DrainResult {
  applied: number;
  skipped: number;
  errors: number;
  exhausted: SyncQueueItem[];
}

/**
 * Drains all retryable items from the offline queue.
 * Should be called when the user comes back online.
 *
 * @param supabase    — Supabase browser client (authenticated)
 * @param currentQueue — current items (pass getRetryable from loadQueue)
 */
export async function drainQueue(
  supabase: SupabaseClient,
  retryableItems: SyncQueueItem[],
): Promise<DrainResult> {
  const result: DrainResult = { applied: 0, skipped: 0, errors: 0, exhausted: [] };

  for (const item of retryableItems) {
    const syncResult = await syncItem(supabase, item);

    if (syncResult.status === "applied" || syncResult.status === "skipped") {
      markSynced(item.id);
      if (syncResult.status === "applied") result.applied++;
      else result.skipped++;
    } else {
      // error — increment retry counter
      const updated = markRetryFailed(item.id);
      const updatedItem = updated.items.find((i) => i.id === item.id);
      if (updatedItem && isExhausted(updatedItem)) {
        result.exhausted.push(updatedItem);
        // Remove exhausted items from queue
        markSynced(item.id);
      }
      result.errors++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Export for external callers
// ---------------------------------------------------------------------------

export { getRetryable, getExhausted };
