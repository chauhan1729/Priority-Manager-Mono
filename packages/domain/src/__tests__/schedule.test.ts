import { describe, expect, it } from "vitest";

import { type ScheduleInstance } from "@pm/types";

import {
  checkScheduleOverlap,
  intervalsOverlap,
  validateFocusMinutes,
  validateLockedMinutes,
} from "../schedule";

function makeInstance(
  startIso: string,
  endIso: string,
  overrides: Partial<ScheduleInstance> = {},
): ScheduleInstance {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    source_type: "activity",
    source_activity_id: "activity-1",
    source_meeting_id: null,
    source_event_id: null,
    schedule_date: startIso.slice(0, 10),
    start_at: startIso,
    end_at: endIso,
    locked_minutes: Math.round(
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
    ),
    focus_minutes: null,
    status_snapshot: "upcoming",
    keep_as_history: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
describe("intervalsOverlap", () => {
  const d = (h: number, m = 0) => new Date(`2026-04-05T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);

  it("returns true for fully overlapping blocks", () => {
    expect(intervalsOverlap(d(9), d(11), d(9), d(11))).toBe(true);
  });

  it("returns true for partially overlapping blocks", () => {
    expect(intervalsOverlap(d(9), d(11), d(10), d(12))).toBe(true);
  });

  it("returns true when one block contains another", () => {
    expect(intervalsOverlap(d(9), d(12), d(10), d(11))).toBe(true);
  });

  it("returns false for back-to-back blocks (half-open interval)", () => {
    // 9:00–10:00 and 10:00–11:00 should NOT overlap
    expect(intervalsOverlap(d(9), d(10), d(10), d(11))).toBe(false);
  });

  it("returns false for completely separate blocks", () => {
    expect(intervalsOverlap(d(9), d(10), d(11), d(12))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("checkScheduleOverlap", () => {
  const day = "2026-04-05";

  it("returns no overlap when day is empty", () => {
    const result = checkScheduleOverlap(
      [],
      `${day}T09:00:00Z`,
      `${day}T10:00:00Z`,
    );
    expect(result.overlaps).toBe(false);
    expect(result.conflictingInstances).toHaveLength(0);
  });

  it("detects overlap with an existing block", () => {
    const existing = [
      makeInstance(`${day}T09:30:00Z`, `${day}T10:30:00Z`),
    ];
    const result = checkScheduleOverlap(
      existing,
      `${day}T09:00:00Z`,
      `${day}T10:00:00Z`,
    );
    expect(result.overlaps).toBe(true);
    expect(result.conflictingInstances).toHaveLength(1);
  });

  it("excludes the instance being rescheduled (excludeId)", () => {
    const existing = [
      makeInstance(`${day}T09:00:00Z`, `${day}T10:00:00Z`, { id: "inst-1" }),
    ];
    const result = checkScheduleOverlap(
      existing,
      `${day}T09:00:00Z`,
      `${day}T10:00:00Z`,
      "inst-1", // reschedule: exclude self
    );
    expect(result.overlaps).toBe(false);
  });

  it("allows back-to-back scheduling", () => {
    const existing = [
      makeInstance(`${day}T09:00:00Z`, `${day}T10:00:00Z`),
    ];
    const result = checkScheduleOverlap(
      existing,
      `${day}T10:00:00Z`,
      `${day}T11:00:00Z`,
    );
    expect(result.overlaps).toBe(false);
  });

  it("returns all conflicting instances", () => {
    const existing = [
      makeInstance(`${day}T09:00:00Z`, `${day}T10:00:00Z`),
      makeInstance(`${day}T09:30:00Z`, `${day}T10:30:00Z`),
      makeInstance(`${day}T11:00:00Z`, `${day}T12:00:00Z`),
    ];
    const result = checkScheduleOverlap(
      existing,
      `${day}T09:15:00Z`,
      `${day}T10:15:00Z`,
    );
    expect(result.conflictingInstances).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
describe("validateFocusMinutes (spec §10.6)", () => {
  it("returns null when focus <= remaining", () => {
    expect(validateFocusMinutes(30, 60)).toBeNull();
  });

  it("returns null when focus equals remaining", () => {
    expect(validateFocusMinutes(60, 60)).toBeNull();
  });

  it("returns error when focus > remaining", () => {
    expect(validateFocusMinutes(90, 60)).toMatch(/exceeds remaining/);
  });

  it("returns error when focus is 0 or negative", () => {
    expect(validateFocusMinutes(0, 60)).toMatch(/greater than 0/);
    expect(validateFocusMinutes(-5, 60)).toMatch(/greater than 0/);
  });
});

// ---------------------------------------------------------------------------
describe("validateLockedMinutes", () => {
  const day = "2026-04-05";

  it("returns null when locked matches wall-clock duration", () => {
    expect(
      validateLockedMinutes(60, `${day}T09:00:00Z`, `${day}T10:00:00Z`),
    ).toBeNull();
  });

  it("returns error when locked does not match wall clock", () => {
    expect(
      validateLockedMinutes(30, `${day}T09:00:00Z`, `${day}T10:00:00Z`),
    ).toMatch(/does not match/);
  });

  it("allows 1-minute tolerance", () => {
    // 60 min duration but locked = 60 — within tolerance
    expect(
      validateLockedMinutes(60, `${day}T09:00:30Z`, `${day}T10:00:00Z`),
    ).toBeNull();
  });
});
