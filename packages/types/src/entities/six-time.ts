// Phase 4: Six-Time Book (tundruk) — a guilt-free continuous self-tracking practice.
// Three focus problems, cycled twice across six daily slots; each slot logs a plus (+), a minus (−),
// and a small symbolic to-do. A nightly review records the top 3 best / worst. Entries are short & sweet.

export type SixTimeProblemStatus = "active" | "retired";

/** One of the three focus problems (positions 1–3). Swappable — retire and add a new one. */
export interface SixTimeProblem {
  id: string;
  user_id: string;
  position: number; // 1, 2, or 3
  problem: string; // the problem
  solution: string; // targeted behavioral solution
  reminder_phrase: string; // short header shown on each slot
  status: SixTimeProblemStatus;
  created_at: string;
  retired_at: string | null;
  updated_at: string;
}

/** One of the six daily slots. Maps to a problem via the cycle position = ((slot−1) mod 3) + 1. */
export interface SixTimeEntry {
  id: string;
  user_id: string;
  entry_date: string; // ISO date YYYY-MM-DD
  slot_index: number; // 1..6
  problem_id: string; // FK → six_time_problems (resolved via the cycle)
  plus: string | null; // a recent success (thought/said/did)
  minus: string | null; // something done not-so-well
  todo: string | null; // brief symbolic game-plan
  logged_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The end-of-day review — top 3 best / worst things, free of judgment. */
export interface SixTimeNightlyReview {
  id: string;
  user_id: string;
  review_date: string; // ISO date
  best: string[]; // up to 3, short
  worst: string[]; // up to 3, short
  logged_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Per-user config: the six slot times + nightly time + on/off. */
export interface SixTimeConfig {
  id: string;
  user_id: string;
  enabled: boolean;
  slot_times: string[]; // exactly 6 "HH:MM"
  nightly_time: string; // "HH:MM"
  created_at: string;
  updated_at: string;
}

/** Default schedule: 3 before lunch, 3 after (≈ every 2 hours). */
export const SIX_TIME_DEFAULT_SLOT_TIMES = [
  "08:00",
  "10:30",
  "12:30",
  "15:00",
  "18:00",
  "21:30",
] as const;
export const SIX_TIME_DEFAULT_NIGHTLY_TIME = "22:30";
