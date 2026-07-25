import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Delete pending (unsent) push_outbox rows for the given source IDs.
 *
 * Call this the moment an item is marked completed/cancelled/missed/postponed so a
 * reminder already queued for closed-app delivery can't still fire. Reminders are
 * keyed by source_id — meeting.id, schedule_instance.id, activity.id, or
 * calendar_event.id — so pass the relevant IDs to clear them.
 *
 * Only unsent rows are touched, so delivered history is preserved. This is the
 * immediate counterpart to the prune-on-sync backstop in NotificationProvider.
 */
export async function invalidatePendingOutbox(
  supabase: ServerClient,
  userId: string,
  sourceIds: (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(sourceIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  await supabase
    .from("push_outbox")
    .delete()
    .eq("user_id", userId)
    .is("sent_at", null)
    .in("source_id", ids);
}
