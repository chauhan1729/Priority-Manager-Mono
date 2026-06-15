import type { GivingCategory, GivingChallenge, GivingLog } from "@pm/types";

import { GIVING_CHALLENGE_DAYS } from "@pm/types";

/** Whole days from a → b (noon-anchored to avoid timezone drift). */
function daysBetweenISO(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T12:00:00`).getTime();
  const b = new Date(`${bISO}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 1-based day number of the challenge (start date = Day 1). */
export function challengeDayNumber(
  challenge: Pick<GivingChallenge, "start_date">,
  todayISO: string,
): number {
  return daysBetweenISO(challenge.start_date, todayISO) + 1;
}

/** A 90-day challenge is "complete" once Day 91 is reached. Continuous never completes by time. */
export function isChallengeComplete(
  challenge: Pick<GivingChallenge, "start_date" | "mode">,
  todayISO: string,
): boolean {
  if (challenge.mode === "continuous") return false;
  return challengeDayNumber(challenge, todayISO) > GIVING_CHALLENGE_DAYS;
}

/**
 * Whether daily entries can still be edited. Continuous mode never locks; a 90-day challenge locks
 * on Day 91 (pending the review). A non-active challenge is read-only.
 */
export function canEditEntries(
  challenge: Pick<GivingChallenge, "start_date" | "mode" | "status">,
  todayISO: string,
): boolean {
  if (challenge.status !== "active") return false;
  if (challenge.mode === "continuous") return true;
  return challengeDayNumber(challenge, todayISO) <= GIVING_CHALLENGE_DAYS;
}

/** True when the Day-91 review is due (90-day challenge reached the end, not yet reviewed). */
export function needsReview(
  challenge: Pick<GivingChallenge, "start_date" | "mode" | "status" | "reviewed_at">,
  todayISO: string,
): boolean {
  return (
    challenge.mode === "challenge" &&
    challenge.status === "active" &&
    !challenge.reviewed_at &&
    challengeDayNumber(challenge, todayISO) > GIVING_CHALLENGE_DAYS
  );
}

export interface GivingScore {
  daysLogged: number; // distinct days with a gift
  givenCount: number;
  receivedCount: number;
  cognitionsCount: number;
  byCategory: Record<GivingCategory, number>;
}

/** Aggregate the scorecard from the individual logs. */
export function aggregateScore(
  logs: Pick<GivingLog, "kind" | "categories" | "entry_date">[],
): GivingScore {
  const byCategory: Record<GivingCategory, number> = {
    words: 0,
    thoughts: 0,
    deeds: 0,
    things_money: 0,
  };
  let givenCount = 0;
  let receivedCount = 0;
  let cognitionsCount = 0;
  const givenDays = new Set<string>();
  for (const l of logs) {
    if (l.kind === "given") {
      givenCount += 1;
      givenDays.add(l.entry_date);
      for (const c of l.categories) byCategory[c] = (byCategory[c] ?? 0) + 1;
    } else if (l.kind === "received") {
      receivedCount += 1;
    } else if (l.kind === "cognition") {
      cognitionsCount += 1;
    }
  }
  return {
    daysLogged: givenDays.size,
    givenCount,
    receivedCount,
    cognitionsCount,
    byCategory,
  };
}

/** Consecutive days with a gift, counting back from today (or yesterday if today isn't logged yet). */
export function givingStreak(
  logs: Pick<GivingLog, "kind" | "entry_date">[],
  todayISO: string,
): number {
  const dates = new Set(logs.filter((l) => l.kind === "given").map((l) => l.entry_date));
  // Start from today if logged, else yesterday (today still in progress).
  let cursor = todayISO;
  if (!dates.has(cursor)) {
    cursor = shiftISO(todayISO, -1);
    if (!dates.has(cursor)) return 0;
  }
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = shiftISO(cursor, -1);
  }
  return streak;
}

function shiftISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Apply the Day-91 review decision to a challenge (the caller starts a fresh continuous one if yes). */
export function completeReview(
  challenge: GivingChallenge,
  continueDecision: boolean,
  nowISO: string,
): GivingChallenge {
  return {
    ...challenge,
    status: "completed",
    reviewed_at: nowISO,
    continue_decision: continueDecision,
    updated_at: nowISO,
  };
}
