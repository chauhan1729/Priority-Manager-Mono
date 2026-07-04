import { describe, expect, it } from "vitest";

import type { SixTimeEntry, SixTimeProblem } from "@pm/types";

import { buildDailyLog, countActiveProblems, isSixTimeSetUp } from "../six-time";

function makeProblem(position: number, overrides: Partial<SixTimeProblem> = {}): SixTimeProblem {
  return {
    id: `p${position}`,
    user_id: "u1",
    position,
    problem: `Problem ${position}`,
    solution: `Solution ${position}`,
    reminder_phrase: `Phrase ${position}`,
    status: "active",
    created_at: "2026-06-15T00:00:00.000Z",
    retired_at: null,
    updated_at: "2026-06-15T00:00:00.000Z",
    ...overrides,
  };
}

const threeActive = [makeProblem(1), makeProblem(2), makeProblem(3)];

describe("setup state", () => {
  it("countActiveProblems counts only active", () => {
    const probs = [makeProblem(1), makeProblem(2), makeProblem(3, { status: "retired" })];
    expect(countActiveProblems(probs)).toBe(2);
  });
  it("isSixTimeSetUp requires all three positions active", () => {
    expect(isSixTimeSetUp(threeActive)).toBe(true);
    expect(isSixTimeSetUp([makeProblem(1), makeProblem(2)])).toBe(false);
  });
});

describe("buildDailyLog", () => {
  it("builds one card per active problem, ordered by position", () => {
    const cards = buildDailyLog(threeActive);
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.position)).toEqual([1, 2, 3]);
    expect(cards[0]?.problem.id).toBe("p1");
    expect(cards[2]?.problem.id).toBe("p3");
    expect(cards.every((c) => c.entry === null)).toBe(true);
  });

  it("returns empty when not fully set up", () => {
    expect(buildDailyLog([makeProblem(1), makeProblem(2)])).toEqual([]);
  });

  it("merges today's saved entry into the matching problem card", () => {
    const entry: SixTimeEntry = {
      id: "e1",
      user_id: "u1",
      entry_date: "2026-06-15",
      problem_id: "p2",
      plus: "Thanked Susan at 3:15",
      minus: null,
      todo: "Smile first",
      logged_at: "2026-06-15T21:00:00.000Z",
      created_at: "2026-06-15T21:00:00.000Z",
      updated_at: "2026-06-15T21:00:00.000Z",
    };
    const cards = buildDailyLog(threeActive, [entry]);
    expect(cards[1]?.entry?.plus).toBe("Thanked Susan at 3:15");
    expect(cards[0]?.entry).toBeNull();
    expect(cards[2]?.entry).toBeNull();
  });
});
