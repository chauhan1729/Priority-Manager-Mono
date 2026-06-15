import { describe, expect, it } from "vitest";

import type { GivingChallenge, GivingLog } from "@pm/types";

import {
  aggregateScore,
  canEditEntries,
  challengeDayNumber,
  completeReview,
  givingStreak,
  isChallengeComplete,
  needsReview,
} from "../giving";

function makeChallenge(overrides: Partial<GivingChallenge> = {}): GivingChallenge {
  return {
    id: "c1",
    user_id: "u1",
    start_date: "2026-06-01",
    mode: "challenge",
    status: "active",
    reviewed_at: null,
    continue_decision: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLog(overrides: Partial<GivingLog> = {}): GivingLog {
  return {
    id: "l1",
    user_id: "u1",
    challenge_id: "c1",
    entry_date: "2026-06-01",
    kind: "given",
    content: "Bought a coffee for a stranger",
    categories: ["things_money"],
    given_in_secret: true,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("challengeDayNumber + completion", () => {
  it("start date is Day 1", () => {
    expect(challengeDayNumber(makeChallenge(), "2026-06-01")).toBe(1);
  });
  it("Day 90 is the last day; Day 91 completes", () => {
    expect(challengeDayNumber(makeChallenge(), "2026-08-29")).toBe(90); // +89
    expect(isChallengeComplete(makeChallenge(), "2026-08-29")).toBe(false);
    expect(isChallengeComplete(makeChallenge(), "2026-08-30")).toBe(true); // Day 91
  });
  it("continuous never completes by time", () => {
    expect(isChallengeComplete(makeChallenge({ mode: "continuous" }), "2030-01-01")).toBe(false);
  });
});

describe("canEditEntries (Day-91 lock)", () => {
  it("editable through Day 90", () => {
    expect(canEditEntries(makeChallenge(), "2026-08-29")).toBe(true);
  });
  it("locked on Day 91 for a 90-day challenge", () => {
    expect(canEditEntries(makeChallenge(), "2026-08-30")).toBe(false);
  });
  it("continuous always editable while active", () => {
    expect(canEditEntries(makeChallenge({ mode: "continuous" }), "2030-01-01")).toBe(true);
  });
  it("completed challenge is read-only", () => {
    expect(canEditEntries(makeChallenge({ status: "completed" }), "2026-06-05")).toBe(false);
  });
});

describe("needsReview", () => {
  it("true once a 90-day challenge passes Day 90 and is unreviewed", () => {
    expect(needsReview(makeChallenge(), "2026-08-30")).toBe(true);
    expect(needsReview(makeChallenge(), "2026-08-29")).toBe(false);
    expect(needsReview(makeChallenge({ reviewed_at: "x" }), "2026-08-30")).toBe(false);
  });
});

describe("aggregateScore", () => {
  it("counts gives, receives, cognitions, distinct days, and categories", () => {
    const score = aggregateScore([
      makeLog({ entry_date: "2026-06-01", kind: "given", categories: ["words", "deeds"] }),
      makeLog({ entry_date: "2026-06-01", kind: "given", categories: ["things_money"] }), // 2 gifts same day
      makeLog({ entry_date: "2026-06-02", kind: "given", categories: ["thoughts"] }),
      makeLog({ kind: "received", categories: [] }),
      makeLog({ kind: "received", categories: [] }),
      makeLog({ kind: "cognition", categories: [] }),
    ]);
    expect(score.givenCount).toBe(3);
    expect(score.daysLogged).toBe(2); // distinct days with a gift
    expect(score.receivedCount).toBe(2);
    expect(score.cognitionsCount).toBe(1);
    expect(score.byCategory.words).toBe(1);
    expect(score.byCategory.things_money).toBe(1);
    expect(score.byCategory.thoughts).toBe(1);
  });
});

describe("givingStreak", () => {
  it("counts consecutive days with a gift ending today", () => {
    const logs = [
      makeLog({ entry_date: "2026-06-03" }),
      makeLog({ entry_date: "2026-06-04" }),
      makeLog({ entry_date: "2026-06-05" }),
    ];
    expect(givingStreak(logs, "2026-06-05")).toBe(3);
  });
  it("counts back from yesterday if today isn't logged yet", () => {
    const logs = [makeLog({ entry_date: "2026-06-04" }), makeLog({ entry_date: "2026-06-05" })];
    expect(givingStreak(logs, "2026-06-06")).toBe(2);
  });
  it("ignores received/cognition logs for the streak", () => {
    const logs = [makeLog({ entry_date: "2026-06-05", kind: "received" })];
    expect(givingStreak(logs, "2026-06-05")).toBe(0);
  });
});

describe("completeReview", () => {
  it("marks completed with the decision", () => {
    const c = completeReview(makeChallenge(), true, "2026-08-30T22:00:00.000Z");
    expect(c.status).toBe("completed");
    expect(c.continue_decision).toBe(true);
    expect(c.reviewed_at).toBe("2026-08-30T22:00:00.000Z");
  });
});
