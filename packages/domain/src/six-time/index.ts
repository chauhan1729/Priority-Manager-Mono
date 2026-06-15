import type { SixTimeEntry, SixTimeProblem } from "@pm/types";

/** Phase 4: Six-Time Book — six daily slots cycling through three focus problems (twice). */
export const SIX_TIME_SLOT_COUNT = 6;
export const SIX_TIME_PROBLEM_COUNT = 3;
export const SIX_TIME_MAX_REVIEW_ITEMS = 3;

/** Slot → problem position: slots 1/4 → P1, 2/5 → P2, 3/6 → P3. */
export function slotToPosition(slotIndex: number): number {
  return ((slotIndex - 1) % SIX_TIME_PROBLEM_COUNT) + 1;
}

/** Map of position → the active problem at that position. */
export function activeProblemsByPosition(
  problems: SixTimeProblem[],
): Map<number, SixTimeProblem> {
  const map = new Map<number, SixTimeProblem>();
  for (const p of problems) {
    if (p.status === "active") map.set(p.position, p);
  }
  return map;
}

export function countActiveProblems(problems: SixTimeProblem[]): number {
  return problems.filter((p) => p.status === "active").length;
}

/** The Six-Time Book is "set up" once all three positions have an active problem. */
export function isSixTimeSetUp(problems: SixTimeProblem[]): boolean {
  const byPos = activeProblemsByPosition(problems);
  return byPos.has(1) && byPos.has(2) && byPos.has(3);
}

/** The active problem a given slot is about (null if that position isn't set up). */
export function resolveSlotProblem(
  slotIndex: number,
  problems: SixTimeProblem[],
): SixTimeProblem | null {
  return activeProblemsByPosition(problems).get(slotToPosition(slotIndex)) ?? null;
}

export interface SixTimeSlot {
  slotIndex: number; // 1..6
  position: number; // 1..3
  problem: SixTimeProblem;
  entry: SixTimeEntry | null; // the saved entry for this slot today, if any
}

/**
 * Builds the six daily slots wired to their problems, merging in any saved entries for the day.
 * Returns an empty array if the book isn't fully set up.
 */
export function buildDaySlots(
  problems: SixTimeProblem[],
  entries: SixTimeEntry[] = [],
): SixTimeSlot[] {
  const byPos = activeProblemsByPosition(problems);
  if (!(byPos.has(1) && byPos.has(2) && byPos.has(3))) return [];
  const entryBySlot = new Map(entries.map((e) => [e.slot_index, e]));
  const slots: SixTimeSlot[] = [];
  for (let slot = 1; slot <= SIX_TIME_SLOT_COUNT; slot++) {
    const position = slotToPosition(slot);
    const problem = byPos.get(position)!;
    slots.push({ slotIndex: slot, position, problem, entry: entryBySlot.get(slot) ?? null });
  }
  return slots;
}

/** Which problem position is the "current" slot to nudge, given the time-of-day index (0-based). */
export function slotIndexForTimeOfDay(elapsedSlots: number): number {
  // clamp to 1..6
  return Math.min(SIX_TIME_SLOT_COUNT, Math.max(1, elapsedSlots + 1));
}
