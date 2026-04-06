/**
 * Conflict resolution for offline sync.
 * Spec §14: last-write-wins for low-risk fields; version-based for sensitive edits.
 *
 * "Last-write-wins" means: the side with the later `updated_at` / timestamp wins.
 * - If the server record has been updated *after* the queued change, skip (server wins).
 * - If the queued change is newer or server has no timestamp, apply (client wins).
 */

import type { SyncQueueItem } from "./queue";

// ---------------------------------------------------------------------------
// Core resolution
// ---------------------------------------------------------------------------

export type ConflictDecision = "apply" | "skip";

/**
 * Decides whether to apply or skip a queued item given the server record's
 * current `updated_at` timestamp.
 *
 * @param queuedItem      — the locally queued operation
 * @param serverUpdatedAt — ISO datetime of the server record's last update, or null
 *                          if the record doesn't exist yet (safe to apply)
 */
export function resolveConflict(
  queuedItem: SyncQueueItem,
  serverUpdatedAt: string | null,
): ConflictDecision {
  // Creates and deletes always apply (no concurrent edits to reconcile)
  if (queuedItem.operation === "create") return "apply";
  if (queuedItem.operation === "delete") return "apply";

  // No server record (shouldn't happen for update, but be safe)
  if (!serverUpdatedAt) return "apply";

  const serverMs = new Date(serverUpdatedAt).getTime();
  // Apply if local change is at least as recent as server (>=, not just >)
  return queuedItem.timestamp >= serverMs ? "apply" : "skip";
}

// ---------------------------------------------------------------------------
// Merge helper (for partial updates)
// ---------------------------------------------------------------------------

/**
 * Merges a queued payload onto the known server state, preserving any server
 * fields not present in the queued payload.
 *
 * Returns the merged record ready to UPSERT.
 */
export function mergePayload(
  serverRecord: Record<string, unknown>,
  queuedPayload: Record<string, unknown>,
): Record<string, unknown> {
  return { ...serverRecord, ...queuedPayload };
}

// ---------------------------------------------------------------------------
// Sensitive field guard
// ---------------------------------------------------------------------------

/**
 * Fields that should not be blindly overwritten by last-write-wins.
 * For v1, these are relationship FKs and status fields that touch multiple
 * modules — any write to these should be applied only if the queued item
 * is genuinely newer.
 *
 * If this list grows significantly in future, promote to per-table config.
 */
export const SENSITIVE_FIELDS = new Set([
  "status",
  "linked_project_id",
  "linked_contact_id",
  "linked_calendar_event_id",
  "linked_year_entry_id",
  "linked_expense_id",
  "linked_meeting_id",
  "recurrence_rule",
]);

/**
 * Returns true if the queued payload touches only non-sensitive fields.
 * Low-risk fields (title, note, amount, etc.) always get last-write-wins.
 * Sensitive fields require the timestamp check in resolveConflict first.
 */
export function isSafeUpdate(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).every((k) => !SENSITIVE_FIELDS.has(k));
}

// ---------------------------------------------------------------------------
// Sync result type (for callers to report results)
// ---------------------------------------------------------------------------

export type SyncResultStatus = "applied" | "skipped" | "error";

export interface SyncResult {
  id: string;
  status: SyncResultStatus;
  error?: string;
}
