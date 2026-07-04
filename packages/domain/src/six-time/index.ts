import type { SixTimeEntry, SixTimeProblem } from "@pm/types";

/** Phase 4 / 6: Six-Time Book — three focus problems, each logged ONCE a day. */
export const SIX_TIME_PROBLEM_COUNT = 3;
export const SIX_TIME_MAX_REVIEW_ITEMS = 3;

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

export interface SixTimeLogCard {
  position: number; // 1..3
  problem: SixTimeProblem;
  entry: SixTimeEntry | null; // today's saved entry for this problem, if any
}

/**
 * Builds the once-a-day log: one card per active focus problem (ordered by position),
 * merging in any saved entry for the day. Returns an empty array if the book isn't
 * fully set up (all three positions active).
 */
export function buildDailyLog(
  problems: SixTimeProblem[],
  entries: SixTimeEntry[] = [],
): SixTimeLogCard[] {
  const byPos = activeProblemsByPosition(problems);
  if (!(byPos.has(1) && byPos.has(2) && byPos.has(3))) return [];
  const entryByProblem = new Map(entries.map((e) => [e.problem_id, e]));
  const cards: SixTimeLogCard[] = [];
  for (let pos = 1; pos <= SIX_TIME_PROBLEM_COUNT; pos++) {
    const problem = byPos.get(pos)!;
    cards.push({
      position: pos,
      problem,
      entry: entryByProblem.get(problem.id) ?? null,
    });
  }
  return cards;
}
