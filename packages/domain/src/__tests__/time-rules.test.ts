import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

import {
  canCreateActivityOnDate,
  canCreateMeetingAt,
  canScheduleAt,
  isDateInPast,
  isDateTimeInPast,
  toMonthKey,
  todayISO,
} from "../time-rules";

// Pin "now" so tests are deterministic
const FIXED_NOW = new Date("2026-04-04T12:00:00.000Z");

describe("time-rules", () => {
  beforeEach(() => {
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  describe("isDateInPast", () => {
    it("returns true for yesterday", () => {
      expect(isDateInPast("2026-04-03")).toBe(true);
    });

    it("returns false for today", () => {
      expect(isDateInPast("2026-04-04")).toBe(false);
    });

    it("returns false for a future date", () => {
      expect(isDateInPast("2026-12-31")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("isDateTimeInPast", () => {
    it("returns true for a datetime 1 second ago", () => {
      expect(isDateTimeInPast("2026-04-04T11:59:59.000Z")).toBe(true);
    });

    it("returns false for a datetime 1 second from now", () => {
      expect(isDateTimeInPast("2026-04-04T12:00:01.000Z")).toBe(false);
    });

    it("returns true for right at now (boundary — Date.now() === fixed time)", () => {
      // Exactly at pinned now — "new Date(iso) < new Date()" is false at exact same ms
      // Spec intent: "past" means strictly before now
      expect(isDateTimeInPast(FIXED_NOW.toISOString())).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("canCreateActivityOnDate", () => {
    it("rejects past dates", () => {
      expect(canCreateActivityOnDate("2026-04-03")).toBe(false);
    });

    it("allows today", () => {
      expect(canCreateActivityOnDate("2026-04-04")).toBe(true);
    });

    it("allows future dates", () => {
      expect(canCreateActivityOnDate("2026-06-01")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("canScheduleAt", () => {
    it("rejects a past datetime", () => {
      expect(canScheduleAt("2026-04-04T11:00:00.000Z")).toBe(false);
    });

    it("allows a future datetime", () => {
      expect(canScheduleAt("2026-04-04T15:00:00.000Z")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("canCreateMeetingAt", () => {
    it("rejects past meeting times", () => {
      expect(canCreateMeetingAt("2026-04-01T09:00:00.000Z")).toBe(false);
    });

    it("allows future meeting times", () => {
      expect(canCreateMeetingAt("2026-04-10T09:00:00.000Z")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("toMonthKey", () => {
    it("returns YYYY-MM for a given date", () => {
      expect(toMonthKey(new Date("2026-04-04"))).toBe("2026-04");
    });

    it("pads single-digit months", () => {
      expect(toMonthKey(new Date("2026-01-15"))).toBe("2026-01");
    });

    it("uses the pinned now when called with no args", () => {
      expect(toMonthKey()).toBe("2026-04");
    });
  });

  // -------------------------------------------------------------------------
  describe("todayISO", () => {
    it("returns today in YYYY-MM-DD format", () => {
      // FIXED_NOW is 2026-04-04 UTC
      expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(todayISO().startsWith("2026-04-04")).toBe(true);
    });
  });
});
