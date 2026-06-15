import { describe, expect, it } from "vitest";

import type { SixTimeEntry, SixTimeProblem } from "@pm/types";

import {
  buildDaySlots,
  countActiveProblems,
  isSixTimeSetUp,
  resolveSlotProblem,
  slotToPosition,
} from "../six-time";

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

describe("slotToPosition", () => {
  it("cycles 1/4→1, 2/5→2, 3/6→3", () => {
    expect([1, 2, 3, 4, 5, 6].map(slotToPosition)).toEqual([1, 2, 3, 1, 2, 3]);
  });
});

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

describe("resolveSlotProblem", () => {
  it("maps each slot to the right problem", () => {
    expect(resolveSlotProblem(1, threeActive)?.position).toBe(1);
    expect(resolveSlotProblem(4, threeActive)?.position).toBe(1);
    expect(resolveSlotProblem(5, threeActive)?.position).toBe(2);
    expect(resolveSlotProblem(6, threeActive)?.position).toBe(3);
  });
  it("returns null when not set up", () => {
    expect(resolveSlotProblem(1, [makeProblem(2)])).toBeNull();
  });
});

describe("buildDaySlots", () => {
  it("builds 6 slots cycling the problems twice", () => {
    const slots = buildDaySlots(threeActive);
    expect(slots).toHaveLength(6);
    expect(slots.map((s) => s.position)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(slots[0]?.problem.id).toBe("p1");
    expect(slots[3]?.problem.id).toBe("p1");
  });

  it("returns empty when not fully set up", () => {
    expect(buildDaySlots([makeProblem(1), makeProblem(2)])).toEqual([]);
  });

  it("merges saved entries into their slots", () => {
    const entry: SixTimeEntry = {
      id: "e1",
      user_id: "u1",
      entry_date: "2026-06-15",
      slot_index: 2,
      problem_id: "p2",
      plus: "Thanked Susan at 3:15",
      minus: null,
      todo: "Smile first",
      logged_at: "2026-06-15T10:30:00.000Z",
      created_at: "2026-06-15T10:30:00.000Z",
      updated_at: "2026-06-15T10:30:00.000Z",
    };
    const slots = buildDaySlots(threeActive, [entry]);
    expect(slots[1]?.entry?.plus).toBe("Thanked Susan at 3:15");
    expect(slots[0]?.entry).toBeNull();
  });
});
