// Phase 2A: movement history for intentional B re-dating. The methodology warns against blindly
// pushing B's to "tomorrow" — you should choose a thoughtful future day. This log records each move
// (originally planned date → chosen date) so the history isn't lost.

export interface ActivityMove {
  id: string;
  user_id: string;
  activity_id: string;
  from_date: string; // ISO date the activity was on before the move
  to_date: string; // ISO date it was moved to
  reason: string | null; // optional note ("see it done", "waiting on X", …)
  moved_at: string; // ISO datetime
}
