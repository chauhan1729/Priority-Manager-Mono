// Phase 5: Giving — the 90-Day Karma Scorecard. "The secret of living is giving." Give something every
// day and keep score: log what you gave (words/thoughts/deeds/things-money), what you received, and any
// cognitions. Each is logged separately and you can add more than one of each per day. On Day 91 the
// tracker locks for a review; choosing to continue flips it to a continuous mode.

export type GivingMode = "challenge" | "continuous";
export type GivingStatus = "active" | "completed" | "abandoned";

export interface GivingChallenge {
  id: string;
  user_id: string;
  start_date: string; // ISO date; the 90-day window = start .. start+89
  mode: GivingMode;
  status: GivingStatus;
  reviewed_at: string | null;
  continue_decision: boolean | null; // answer to the Day-91 prompt
  created_at: string;
  updated_at: string;
}

export type GivingCategory = "words" | "thoughts" | "deeds" | "things_money";

/** One logged item. `kind` separates the outflow / inflow / cognition; many allowed per day. */
export type GivingKind = "given" | "received" | "cognition";

export interface GivingLog {
  id: string;
  user_id: string;
  challenge_id: string;
  entry_date: string; // ISO date
  kind: GivingKind;
  content: string;
  categories: GivingCategory[]; // only meaningful for kind = "given"
  given_in_secret: boolean; // only meaningful for kind = "given"
  created_at: string;
  updated_at: string;
}

/** The challenge runs for 90 days; Day 91 locks the tracker for review. */
export const GIVING_CHALLENGE_DAYS = 90;
export const GIVING_CATEGORIES: GivingCategory[] = ["words", "thoughts", "deeds", "things_money"];
export const GIVING_KINDS: GivingKind[] = ["given", "received", "cognition"];
