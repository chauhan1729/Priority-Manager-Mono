import { describe, expect, it } from "vitest";

import type { Activity, Cycle } from "@pm/types";

import {
  ENERGY_CHANGE_INTERVAL_MIN,
  abandonCycle,
  acknowledgmentMessage,
  buildCycleStart,
  canStartCycle,
  completeCycle,
  cyclesCompletedToday,
  elapsedFocusMinutes,
  minutesBetween,
  resumeCycle,
  shouldPromptEnergyChange,
  takeMiniBreak,
} from "../cycle";

// Fixed clock helpers (Date.now is unavailable in some contexts; use explicit ISO strings).
const T0 = "2026-06-15T09:00:00.000Z";
const at = (minFromT0: number) =>
  new Date(new Date(T0).getTime() + minFromT0 * 60_000).toISOString();

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    user_id: "user-1",
    section_type: "work",
    title: "Clean up planner",
    priority: "A",
    activity_date: "2030-01-01", // future so canStartCycle passes
    estimated_minutes: 45,
    remaining_minutes: 45,
    status: "not_started",
    linked_project_id: "proj-1",
    delegated_contact_id: null,
    note: null,
    origin_type: "manual",
    moved_from_date: null,
    hours_worked: 0,
    archived: false,
    is_someday: false,
    is_weekly: false,
    recurrence_rule: null,
    created_at: T0,
    updated_at: T0,
    ...overrides,
  };
}

function makeCycle(start = buildCycleStart({ activity: makeActivity(), nowISO: T0 })): Cycle {
  return {
    id: "cyc-1",
    user_id: "user-1",
    created_at: T0,
    updated_at: T0,
    ...start,
  };
}

describe("minutesBetween", () => {
  it("computes whole minutes, never negative", () => {
    expect(minutesBetween(T0, at(20))).toBe(20);
    expect(minutesBetween(at(20), T0)).toBe(0);
  });
});

describe("canStartCycle", () => {
  it("allows a future, not-started activity", () => {
    expect(canStartCycle(makeActivity())).toBe(true);
  });
  it("rejects a past-dated activity", () => {
    expect(canStartCycle(makeActivity({ activity_date: "2020-01-01" }))).toBe(false);
  });
  it("rejects a completed activity", () => {
    expect(canStartCycle(makeActivity({ status: "completed" }))).toBe(false);
  });
});

describe("buildCycleStart", () => {
  it("seeds soft target from the estimate and starts in focus", () => {
    const start = buildCycleStart({ activity: makeActivity({ estimated_minutes: 45 }), nowISO: T0 });
    expect(start.soft_target_minutes).toBe(45);
    expect(start.phase).toBe("focus");
    expect(start.segment_started_at).toBe(T0);
    expect(start.elapsed_focus_minutes).toBe(0);
  });
  it("uses null soft target when there is no estimate", () => {
    const start = buildCycleStart({ activity: makeActivity({ estimated_minutes: 0 }), nowISO: T0 });
    expect(start.soft_target_minutes).toBeNull();
  });
});

describe("elapsedFocusMinutes (count-up)", () => {
  it("counts up live during a focus segment", () => {
    const c = makeCycle();
    expect(elapsedFocusMinutes(c, at(12))).toBe(12);
  });
  it("freezes during a break", () => {
    const onBreak = takeMiniBreak(makeCycle(), at(15));
    expect(elapsedFocusMinutes(onBreak, at(40))).toBe(15); // break time not counted
  });
  it("accumulates across break → resume → more focus", () => {
    let c = makeCycle();
    c = takeMiniBreak(c, at(15)); // bank 15
    c = resumeCycle(c, at(20)); // 5-min break, resume
    expect(elapsedFocusMinutes(c, at(30))).toBe(25); // 15 + 10
  });
});

describe("shouldPromptEnergyChange (~20 min)", () => {
  it("fires once the focus segment reaches the interval", () => {
    const c = makeCycle();
    expect(shouldPromptEnergyChange(c, at(ENERGY_CHANGE_INTERVAL_MIN))).toBe(true);
    expect(shouldPromptEnergyChange(c, at(ENERGY_CHANGE_INTERVAL_MIN - 1))).toBe(false);
  });
  it("does not fire on a break", () => {
    const onBreak = takeMiniBreak(makeCycle(), at(25));
    expect(shouldPromptEnergyChange(onBreak, at(60))).toBe(false);
  });
});

describe("transitions", () => {
  it("takeMiniBreak banks the segment, increments break_count, clears the anchor", () => {
    const c = takeMiniBreak(makeCycle(), at(10));
    expect(c.phase).toBe("break");
    expect(c.elapsed_focus_minutes).toBe(10);
    expect(c.break_count).toBe(1);
    expect(c.segment_started_at).toBeNull();
  });
  it("resumeCycle re-anchors to now", () => {
    let c = takeMiniBreak(makeCycle(), at(10));
    c = resumeCycle(c, at(13));
    expect(c.phase).toBe("focus");
    expect(c.segment_started_at).toBe(at(13));
  });
  it("completeCycle is user-driven and sets completed_at + final elapsed", () => {
    const c = completeCycle(makeCycle(), at(45), "Rewrote Dustin's planner");
    expect(c.phase).toBe("completed");
    expect(c.completed_at).toBe(at(45));
    expect(c.elapsed_focus_minutes).toBe(45);
    expect(c.note).toBe("Rewrote Dustin's planner");
    expect(c.segment_started_at).toBeNull();
  });
  it("does not auto-complete just because elapsed passed the soft target", () => {
    const c = makeCycle(); // 45-min target
    expect(elapsedFocusMinutes(c, at(90))).toBe(90);
    expect(c.phase).toBe("focus"); // still running until the user completes
  });
  it("abandonCycle banks elapsed and marks abandoned", () => {
    const c = abandonCycle(makeCycle(), at(8));
    expect(c.phase).toBe("abandoned");
    expect(c.elapsed_focus_minutes).toBe(8);
  });
  it("does not mutate the input", () => {
    const original = makeCycle();
    takeMiniBreak(original, at(10));
    expect(original.phase).toBe("focus");
  });
});

describe("acknowledgment", () => {
  it("counts completed cycles", () => {
    const cycles = [makeCycle(completeCycle(makeCycle(), at(30))), makeCycle()];
    expect(cyclesCompletedToday(cycles)).toBe(1);
  });
  it("escalates the message", () => {
    expect(acknowledgmentMessage(0)).toMatch(/start a cycle/i);
    expect(acknowledgmentMessage(1)).toMatch(/one down/i);
    expect(acknowledgmentMessage(3)).toMatch(/ahead of schedule/i);
  });
});
