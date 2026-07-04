import { describe, it, expect } from "vitest";

import {
  addDays,
  computeAllReminders,
  computeBirthdayReminders,
  computeEodReminder,
  computeMeetingPassedReminders,
  computeMeetingUpcomingReminders,
  computeGivingReminder,
  computeMeetingPrepReminders,
  computeSixTimeDailyReminder,
  computeSixTimeNightlyReminder,
  computeMorningSummaryReminder,
  computeRenewalReminders,
  computeSomedayReviewReminder,
  computeTravelReminders,
  filterUnfiredReminders,
} from "../notification";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const BASE_PREFS = {
  eod_review_enabled: true,
  eod_review_time: "21:00",
  meeting_reminder_minutes_before: 15,
  morning_summary_enabled: true,
  morning_summary_time: "08:00",
  birthday_reminder_days_before: 1,
  travel_reminder_days_before: 1,
  renewal_reminder_days_before: 3,
  activity_starting_enabled: true,
  activity_reminder_minutes_before: 5,
  activity_overdue_enabled: true,
  event_reminder_minutes_before: 15,
  someday_review_enabled: false,
  someday_review_weekday: 0,
  someday_review_time: "09:00",
};

function makeMeeting(overrides: Record<string, unknown> = {}) {
  return {
    id: "meet-1",
    title: "Weekly Sync",
    date: "2026-04-05",
    start_at: "2026-04-05T14:00:00.000Z",
    end_at: "2026-04-05T14:30:00.000Z",
    status: "upcoming" as const,
    key_takeaways: null,
    ...overrides,
  };
}

function makeExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    title: "Netflix",
    amount: 15.99,
    expense_date: "2026-04-01",
    recurrence_rule: "monthly" as const,
    ...overrides,
  };
}

function makeYearEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "ye-1",
    title: "Paris Trip",
    type: "travel" as const,
    start_date: "2026-04-10",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// addDays helper
// ---------------------------------------------------------------------------

describe("addDays", () => {
  it("adds positive days", () => {
    expect(addDays("2026-04-05", 3)).toBe("2026-04-08");
  });

  it("adds zero days (identity)", () => {
    expect(addDays("2026-04-05", 0)).toBe("2026-04-05");
  });

  it("crosses month boundary", () => {
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
  });

  it("subtracts days with negative value", () => {
    expect(addDays("2026-04-05", -1)).toBe("2026-04-04");
  });
});

// ---------------------------------------------------------------------------
// End-of-day review reminder
// ---------------------------------------------------------------------------

describe("computeEodReminder", () => {
  it("returns a reminder when enabled", () => {
    const result = computeEodReminder(
      { eod_review_enabled: true, eod_review_time: "21:00" },
      "2026-04-05",
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe("eod_review");
    expect(result!.source_id).toBeNull();
    expect(result!.scheduled_for.getHours()).toBe(21);
    expect(result!.scheduled_for.getMinutes()).toBe(0);
  });

  it("returns null when disabled", () => {
    const result = computeEodReminder(
      { eod_review_enabled: false, eod_review_time: "21:00" },
      "2026-04-05",
    );
    expect(result).toBeNull();
  });

  it("respects custom time", () => {
    const result = computeEodReminder(
      { eod_review_enabled: true, eod_review_time: "18:30" },
      "2026-04-05",
    );
    expect(result!.scheduled_for.getHours()).toBe(18);
    expect(result!.scheduled_for.getMinutes()).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Morning summary reminder
// ---------------------------------------------------------------------------

describe("computeGivingReminder (Phase 5)", () => {
  const prefs = { giving_reminder_enabled: true, giving_reminder_time: "20:00" };
  it("fires daily while a challenge is active", () => {
    expect(computeGivingReminder(prefs, true, "2026-06-15")?.type).toBe("giving_daily");
  });
  it("does not fire without an active challenge", () => {
    expect(computeGivingReminder(prefs, false, "2026-06-15")).toBeNull();
  });
  it("does not fire when disabled", () => {
    expect(computeGivingReminder({ ...prefs, giving_reminder_enabled: false }, true, "2026-06-15")).toBeNull();
  });
});

describe("Six-Time reminders (Phase 4)", () => {
  const config = {
    enabled: true,
    daily_log_time: "21:00",
    nightly_time: "22:30",
  };
  const problems = [
    { position: 1, status: "active" as const, reminder_phrase: "Be patient" },
    { position: 2, status: "active" as const, reminder_phrase: "Listen first" },
    { position: 3, status: "active" as const, reminder_phrase: "Follow up" },
  ];

  it("emits one daily log reminder when set up", () => {
    const r = computeSixTimeDailyReminder(config, problems, "2026-06-15");
    expect(r?.type).toBe("six_time_daily");
    expect(r?.scheduled_for.getHours()).toBe(21);
  });

  it("emits nothing when disabled or not set up", () => {
    expect(computeSixTimeDailyReminder({ ...config, enabled: false }, problems, "2026-06-15")).toBeNull();
    expect(computeSixTimeDailyReminder(config, [problems[0]!], "2026-06-15")).toBeNull();
    expect(computeSixTimeNightlyReminder({ ...config, enabled: false }, "2026-06-15")).toBeNull();
  });

  it("nightly reminder fires when enabled", () => {
    expect(computeSixTimeNightlyReminder(config, "2026-06-15")?.type).toBe("six_time_nightly");
  });
});

describe("computeMeetingPrepReminders (Phase 2B)", () => {
  it("fires one day before an upcoming meeting", () => {
    const meeting = makeMeeting({ date: "2026-04-06", title: "Dustin 1:1" });
    const r = computeMeetingPrepReminders([meeting], 1, "2026-04-05");
    expect(r).toHaveLength(1);
    expect(r[0]?.type).toBe("meeting_prep");
    expect(r[0]?.title).toContain("Dustin 1:1");
  });

  it("does not fire on other days", () => {
    const meeting = makeMeeting({ date: "2026-04-10" });
    expect(computeMeetingPrepReminders([meeting], 1, "2026-04-05")).toHaveLength(0);
  });

  it("skips non-upcoming meetings", () => {
    const meeting = makeMeeting({ date: "2026-04-06", status: "completed" });
    expect(computeMeetingPrepReminders([meeting], 1, "2026-04-05")).toHaveLength(0);
  });

  it("honors a custom days-before", () => {
    const meeting = makeMeeting({ date: "2026-04-08" });
    expect(computeMeetingPrepReminders([meeting], 3, "2026-04-05")).toHaveLength(1);
  });
});

describe("computeSomedayReviewReminder (Phase 1B)", () => {
  const today = "2026-06-14";
  const weekday = new Date(`${today}T12:00:00`).getDay();

  it("fires on the configured weekday when enabled", () => {
    const r = computeSomedayReviewReminder(
      { someday_review_enabled: true, someday_review_weekday: weekday, someday_review_time: "09:00" },
      today,
    );
    expect(r?.type).toBe("weekly_someday_review");
  });

  it("returns null when disabled", () => {
    expect(
      computeSomedayReviewReminder(
        { someday_review_enabled: false, someday_review_weekday: weekday, someday_review_time: "09:00" },
        today,
      ),
    ).toBeNull();
  });

  it("returns null on a different weekday", () => {
    expect(
      computeSomedayReviewReminder(
        {
          someday_review_enabled: true,
          someday_review_weekday: (weekday + 1) % 7,
          someday_review_time: "09:00",
        },
        today,
      ),
    ).toBeNull();
  });
});

describe("computeMorningSummaryReminder", () => {
  it("returns a reminder when enabled", () => {
    const result = computeMorningSummaryReminder(
      { morning_summary_enabled: true, morning_summary_time: "08:00" },
      "2026-04-05",
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe("morning_summary");
    expect(result!.scheduled_for.getHours()).toBe(8);
  });

  it("returns null when disabled", () => {
    const result = computeMorningSummaryReminder(
      { morning_summary_enabled: false, morning_summary_time: "08:00" },
      "2026-04-05",
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Meeting upcoming reminders
// ---------------------------------------------------------------------------

describe("computeMeetingUpcomingReminders", () => {
  it("returns reminder when now is within the lead-time window", () => {
    // Meeting starts at 14:00 UTC. With 15 min lead, reminder fires 13:45 UTC.
    // now = 13:50 (inside [13:45, 14:00))
    const now = new Date("2026-04-05T13:50:00.000Z");
    const result = computeMeetingUpcomingReminders([makeMeeting()], 15, now);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("meeting_upcoming");
    expect(result[0]!.source_id).toBe("meet-1");
  });

  it("emits a future-scheduled reminder before the window (queued for closed-app push)", () => {
    const now = new Date("2026-04-05T13:00:00.000Z"); // before 13:45
    const result = computeMeetingUpcomingReminders([makeMeeting()], 15, now);
    expect(result).toHaveLength(1);
    // scheduled_for = reminderTime (13:45) is still future → the outbox queues it;
    // the foreground only fires it once due. No lower-bound guard strands it.
    expect(result[0]!.scheduled_for.toISOString()).toBe("2026-04-05T13:45:00.000Z");
  });

  it("returns nothing when meeting has already started", () => {
    const now = new Date("2026-04-05T14:05:00.000Z"); // after start
    const result = computeMeetingUpcomingReminders([makeMeeting()], 15, now);
    expect(result).toHaveLength(0);
  });

  it("returns nothing for non-upcoming meetings", () => {
    const now = new Date("2026-04-05T13:50:00.000Z");
    const completed = makeMeeting({ status: "completed" });
    expect(computeMeetingUpcomingReminders([completed], 15, now)).toHaveLength(0);
  });

  it("returns nothing if minutesBefore is 0 (disabled)", () => {
    const now = new Date("2026-04-05T14:00:00.000Z");
    expect(computeMeetingUpcomingReminders([makeMeeting()], 0, now)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Meeting time-passed reminders
// ---------------------------------------------------------------------------

describe("computeMeetingPassedReminders", () => {
  it("returns reminder when meeting has ended and is still upcoming", () => {
    const now = new Date("2026-04-05T15:00:00.000Z"); // after 14:30
    const result = computeMeetingPassedReminders([makeMeeting()], now);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("meeting_passed");
    expect(result[0]!.source_id).toBe("meet-1");
  });

  it("body mentions takeaways when key_takeaways is null", () => {
    const now = new Date("2026-04-05T15:00:00.000Z");
    const result = computeMeetingPassedReminders([makeMeeting({ key_takeaways: null })], now);
    expect(result[0]!.body).toContain("takeaways");
  });

  it("body does not mention takeaways when key_takeaways present", () => {
    const now = new Date("2026-04-05T15:00:00.000Z");
    const result = computeMeetingPassedReminders(
      [makeMeeting({ key_takeaways: "We agreed on X." })],
      now,
    );
    expect(result[0]!.body).not.toContain("takeaways");
  });

  it("emits a reminder scheduled at end time even before the meeting ends (closed-app push)", () => {
    const now = new Date("2026-04-05T14:00:00.000Z"); // before 14:30
    const result = computeMeetingPassedReminders([makeMeeting()], now);
    // scheduled_for = end_at (14:30) is future → the outbox queues it so the
    // "update status" prompt pushes at meeting end even when the app is closed.
    expect(result).toHaveLength(1);
    expect(result[0]!.scheduled_for.toISOString()).toBe("2026-04-05T14:30:00.000Z");
  });

  it("returns nothing if meeting is already completed/cancelled", () => {
    const now = new Date("2026-04-05T15:00:00.000Z");
    expect(
      computeMeetingPassedReminders([makeMeeting({ status: "completed" })], now),
    ).toHaveLength(0);
    expect(
      computeMeetingPassedReminders([makeMeeting({ status: "cancelled" })], now),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Renewal reminders (from recurring expenses)
// ---------------------------------------------------------------------------

describe("computeRenewalReminders", () => {
  // Netflix recurs monthly from 2026-04-01.
  // Next occurrence after 2026-04-05 → 2026-05-01
  // With daysBefore=3: reminder fires when today = 2026-04-28 (3 days before 2026-05-01)

  it("returns reminder when today is daysBefore before next renewal", () => {
    // today = 2026-04-28, daysBefore = 3, nextOccurrence = 2026-05-01
    const result = computeRenewalReminders([makeExpense()], 3, "2026-04-28");
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("renewal");
    expect(result[0]!.source_id).toBe("exp-1");
    expect(result[0]!.title).toContain("Netflix");
  });

  it("returns nothing when today is not exactly daysBefore before renewal", () => {
    const result = computeRenewalReminders([makeExpense()], 3, "2026-04-05");
    expect(result).toHaveLength(0);
  });

  it("returns nothing for non-recurring expenses", () => {
    const oneTime = makeExpense({ recurrence_rule: null });
    expect(computeRenewalReminders([oneTime], 3, "2026-04-28")).toHaveLength(0);
  });

  it("uses plural 'days' in body when daysBefore > 1", () => {
    const result = computeRenewalReminders([makeExpense()], 3, "2026-04-28");
    expect(result[0]!.body).toContain("3 days");
  });

  it("uses singular 'day' in body when daysBefore = 1", () => {
    // Netflix next occurrence after 2026-05-01 is 2026-06-01 → fire on 2026-05-31
    const result = computeRenewalReminders([makeExpense()], 1, "2026-04-30");
    expect(result).toHaveLength(1);
    expect(result[0]!.body).toContain("1 day");
  });
});

// ---------------------------------------------------------------------------
// Birthday reminders (from YearEntry)
// ---------------------------------------------------------------------------

describe("computeBirthdayReminders", () => {
  // Birthday on April 10 (stored as any year, match by MM-DD)
  const birthday = makeYearEntry({ type: "birthday", start_date: "1990-04-10" });

  it("returns reminder when birthday is daysBefore days away", () => {
    // today = 2026-04-09, daysBefore = 1, birthday = April 10
    const result = computeBirthdayReminders([birthday], 1, "2026-04-09");
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("birthday");
    expect(result[0]!.source_id).toBe("ye-1");
    expect(result[0]!.title).toContain("Paris Trip"); // title comes from the entry
  });

  it("returns reminder on the day itself when daysBefore = 0", () => {
    const result = computeBirthdayReminders([birthday], 0, "2026-04-10");
    expect(result).toHaveLength(1);
    expect(result[0]!.body).toContain("Today");
  });

  it("returns nothing when birthday is not in the reminder window", () => {
    const result = computeBirthdayReminders([birthday], 1, "2026-04-05");
    expect(result).toHaveLength(0);
  });

  it("returns nothing for non-birthday entries", () => {
    const travel = makeYearEntry({ type: "travel", start_date: "2026-04-10" });
    const result = computeBirthdayReminders([travel], 0, "2026-04-10");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Travel reminders (from YearEntry)
// ---------------------------------------------------------------------------

describe("computeTravelReminders", () => {
  // Travel starts 2026-04-10
  const travel = makeYearEntry({ type: "travel", start_date: "2026-04-10" });

  it("returns reminder when travel is daysBefore days away", () => {
    const result = computeTravelReminders([travel], 1, "2026-04-09");
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("travel");
    expect(result[0]!.source_id).toBe("ye-1");
  });

  it("returns reminder on the day of travel when daysBefore = 0", () => {
    const result = computeTravelReminders([travel], 0, "2026-04-10");
    expect(result).toHaveLength(1);
    expect(result[0]!.body).toContain("today");
  });

  it("returns nothing when date doesn't match", () => {
    const result = computeTravelReminders([travel], 1, "2026-04-05");
    expect(result).toHaveLength(0);
  });

  it("returns nothing for birthday entries", () => {
    const bday = makeYearEntry({ type: "birthday", start_date: "2026-04-10" });
    const result = computeTravelReminders([bday], 0, "2026-04-10");
    expect(result).toHaveLength(0);
  });

  it("works for away entries too", () => {
    const away = makeYearEntry({ type: "away", start_date: "2026-04-10" });
    const result = computeTravelReminders([away], 1, "2026-04-09");
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// computeAllReminders orchestrator
// ---------------------------------------------------------------------------

describe("computeAllReminders", () => {
  it("returns all enabled reminders sorted by scheduled_for", () => {
    const todayISO = "2026-04-05";
    const now = new Date("2026-04-05T13:50:00.000Z"); // inside meeting reminder window

    const result = computeAllReminders({
      prefs: BASE_PREFS,
      meetings: [makeMeeting()],
      expenses: [],
      yearEntries: [],
      todayISO,
      now,
    });

    // Should include: morning_summary, meeting_upcoming, eod_review
    const types = result.map((r) => r.type);
    expect(types).toContain("morning_summary");
    expect(types).toContain("meeting_upcoming");
    expect(types).toContain("eod_review");

    // Sorted ascending
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.scheduled_for.getTime()).toBeGreaterThanOrEqual(
        result[i - 1]!.scheduled_for.getTime(),
      );
    }
  });

  it("returns empty when prefs disable all and no source records", () => {
    const result = computeAllReminders({
      prefs: {
        ...BASE_PREFS,
        eod_review_enabled: false,
        morning_summary_enabled: false,
        meeting_reminder_minutes_before: 0,
      },
      meetings: [],
      expenses: [],
      yearEntries: [],
      todayISO: "2026-04-05",
      now: new Date("2026-04-05T12:00:00Z"),
    });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterUnfiredReminders
// ---------------------------------------------------------------------------

describe("filterUnfiredReminders", () => {
  const reminders = [
    {
      type: "eod_review" as const,
      source_id: null,
      scheduled_for: new Date("2026-04-05T21:00:00"),
      title: "EOD",
      body: "Review",
    },
    {
      type: "meeting_passed" as const,
      source_id: "meet-1",
      scheduled_for: new Date("2026-04-05T14:30:00"),
      title: "Meeting ended",
      body: "Update status",
    },
  ];

  it("returns all reminders when none have been fired", () => {
    expect(filterUnfiredReminders(reminders, [])).toHaveLength(2);
  });

  it("filters out already-fired reminders", () => {
    const fired = [{ reminder_type: "eod_review", source_id: null }];
    const result = filterUnfiredReminders(reminders, fired);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("meeting_passed");
  });

  it("matches by both type and source_id", () => {
    const fired = [{ reminder_type: "meeting_passed", source_id: "meet-2" }]; // different meeting
    const result = filterUnfiredReminders(reminders, fired);
    expect(result).toHaveLength(2); // meet-1 still unfired
  });
});
