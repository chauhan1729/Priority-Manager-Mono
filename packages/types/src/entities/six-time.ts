// Phase 4 / Phase 6: Six-Time Book (tundruk) — a guilt-free self-tracking practice.
// Three focus problems, each logged ONCE a day with a plus (+), a minus (−), and a small
// symbolic to-do; plus a nightly review of the top 3 best / worst. Entries are short & sweet.

export type SixTimeProblemStatus = "active" | "retired";

/** One of the three focus problems (positions 1–3). Swappable — retire and add a new one. */
export interface SixTimeProblem {
  id: string;
  user_id: string;
  position: number; // 1, 2, or 3
  problem: string; // the problem
  solution: string; // targeted behavioral solution
  reminder_phrase: string; // short header shown on the log card
  status: SixTimeProblemStatus;
  created_at: string;
  retired_at: string | null;
  updated_at: string;
}

/** One daily log entry — one per focus problem per day (logged once, typically at night). */
export interface SixTimeEntry {
  id: string;
  user_id: string;
  entry_date: string; // ISO date YYYY-MM-DD
  problem_id: string; // FK → six_time_problems
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

/** Per-user config: the once-a-day log time + nightly time + on/off. */
export interface SixTimeConfig {
  id: string;
  user_id: string;
  enabled: boolean;
  daily_log_time: string; // "HH:MM" — the single daily-log nudge
  nightly_time: string; // "HH:MM"
  created_at: string;
  updated_at: string;
}

/** Default once-a-day log time and nightly review time. */
export const SIX_TIME_DEFAULT_LOG_TIME = "21:00";
export const SIX_TIME_DEFAULT_NIGHTLY_TIME = "22:30";
