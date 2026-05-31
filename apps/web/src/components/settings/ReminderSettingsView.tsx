"use client";

import { useState, useTransition } from "react";

import { CURRENCY_OPTIONS } from "@pm/domain";

import {
  updateProfilePrefs,
  updateReminderPreferences,
  type UpdateReminderPreferencesData,
} from "@/app/(app)/settings/actions";
import { showToast } from "@/components/ui/Toaster";

// ---------------------------------------------------------------------------
// Common IANA timezones grouped by region
// ---------------------------------------------------------------------------

const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  // UTC
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
  // Africa
  { value: "Africa/Abidjan", label: "Africa/Abidjan (GMT+0)" },
  { value: "Africa/Cairo", label: "Africa/Cairo (EET, UTC+2)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST, UTC+2)" },
  { value: "Africa/Lagos", label: "Africa/Lagos (WAT, UTC+1)" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi (EAT, UTC+3)" },
  // Americas
  { value: "America/Anchorage", label: "America/Anchorage (AKST, UTC-9)" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Buenos_Aires (ART, UTC-3)" },
  { value: "America/Bogota", label: "America/Bogota (COT, UTC-5)" },
  { value: "America/Caracas", label: "America/Caracas (VET, UTC-4)" },
  { value: "America/Chicago", label: "America/Chicago (CST, UTC-6)" },
  { value: "America/Denver", label: "America/Denver (MST, UTC-7)" },
  { value: "America/Halifax", label: "America/Halifax (AST, UTC-4)" },
  { value: "America/Lima", label: "America/Lima (PET, UTC-5)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST, UTC-8)" },
  { value: "America/Mexico_City", label: "America/Mexico_City (CST, UTC-6)" },
  { value: "America/New_York", label: "America/New_York (EST, UTC-5)" },
  { value: "America/Phoenix", label: "America/Phoenix (MST, UTC-7, no DST)" },
  { value: "America/Santiago", label: "America/Santiago (CLT, UTC-4)" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (BRT, UTC-3)" },
  { value: "America/Toronto", label: "America/Toronto (EST, UTC-5)" },
  { value: "America/Vancouver", label: "America/Vancouver (PST, UTC-8)" },
  // Asia
  { value: "Asia/Baghdad", label: "Asia/Baghdad (AST, UTC+3)" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (ICT, UTC+7)" },
  { value: "Asia/Colombo", label: "Asia/Colombo (IST, UTC+5:30)" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (BST, UTC+6)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST, UTC+4)" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong (HKT, UTC+8)" },
  { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB, UTC+7)" },
  { value: "Asia/Karachi", label: "Asia/Karachi (PKT, UTC+5)" },
  { value: "Asia/Kathmandu", label: "Asia/Kathmandu (NPT, UTC+5:45)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+5:30)" },
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur (MYT, UTC+8)" },
  { value: "Asia/Manila", label: "Asia/Manila (PST, UTC+8)" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh (AST, UTC+3)" },
  { value: "Asia/Seoul", label: "Asia/Seoul (KST, UTC+9)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST, UTC+8)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
  { value: "Asia/Taipei", label: "Asia/Taipei (CST, UTC+8)" },
  { value: "Asia/Tehran", label: "Asia/Tehran (IRST, UTC+3:30)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
  // Atlantic
  { value: "Atlantic/Reykjavik", label: "Atlantic/Reykjavik (GMT+0)" },
  // Australia / Pacific
  { value: "Australia/Adelaide", label: "Australia/Adelaide (ACST, UTC+9:30)" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane (AEST, UTC+10)" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEST, UTC+10)" },
  { value: "Australia/Perth", label: "Australia/Perth (AWST, UTC+8)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST, UTC+10)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST, UTC+12)" },
  { value: "Pacific/Honolulu", label: "Pacific/Honolulu (HST, UTC-10)" },
  // Europe
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET, UTC+1)" },
  { value: "Europe/Athens", label: "Europe/Athens (EET, UTC+2)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET, UTC+1)" },
  { value: "Europe/Brussels", label: "Europe/Brussels (CET, UTC+1)" },
  { value: "Europe/Bucharest", label: "Europe/Bucharest (EET, UTC+2)" },
  { value: "Europe/Copenhagen", label: "Europe/Copenhagen (CET, UTC+1)" },
  { value: "Europe/Dublin", label: "Europe/Dublin (GMT+0)" },
  { value: "Europe/Helsinki", label: "Europe/Helsinki (EET, UTC+2)" },
  { value: "Europe/Istanbul", label: "Europe/Istanbul (TRT, UTC+3)" },
  { value: "Europe/Lisbon", label: "Europe/Lisbon (WET, UTC+0)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST, UTC+0/+1)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (CET, UTC+1)" },
  { value: "Europe/Moscow", label: "Europe/Moscow (MSK, UTC+3)" },
  { value: "Europe/Oslo", label: "Europe/Oslo (CET, UTC+1)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET, UTC+1)" },
  { value: "Europe/Rome", label: "Europe/Rome (CET, UTC+1)" },
  { value: "Europe/Stockholm", label: "Europe/Stockholm (CET, UTC+1)" },
  { value: "Europe/Vienna", label: "Europe/Vienna (CET, UTC+1)" },
  { value: "Europe/Warsaw", label: "Europe/Warsaw (CET, UTC+1)" },
  { value: "Europe/Zurich", label: "Europe/Zurich (CET, UTC+1)" },
];

// ---------------------------------------------------------------------------

interface ReminderPreferenceRow {
  eod_review_enabled: boolean;
  eod_review_time: string;
  meeting_reminder_minutes_before: number;
  morning_summary_enabled: boolean;
  morning_summary_time: string;
  birthday_reminder_days_before: number;
  travel_reminder_days_before: number;
  renewal_reminder_days_before: number;
  currency_code: string;
}

// Defaults shown when no row exists yet
const DEFAULTS: ReminderPreferenceRow = {
  eod_review_enabled: true,
  eod_review_time: "21:00",
  meeting_reminder_minutes_before: 15,
  morning_summary_enabled: true,
  morning_summary_time: "08:00",
  birthday_reminder_days_before: 1,
  travel_reminder_days_before: 1,
  renewal_reminder_days_before: 3,
  currency_code: "USD",
};

interface Props {
  prefs: ReminderPreferenceRow | null;
  timezone: string;
}

// ---------------------------------------------------------------------------

export function ReminderSettingsView({ prefs, timezone: initialTimezone }: Props) {
  const [_isPending, startTransition] = useTransition();

  // Local form state — merge saved prefs with DEFAULTS, falling back for any null/empty values
  const [form, setForm] = useState<ReminderPreferenceRow>(() => {
    if (!prefs) return DEFAULTS;
    return {
      eod_review_enabled: prefs.eod_review_enabled ?? DEFAULTS.eod_review_enabled,
      // Postgres `time` columns come back as "HH:MM:SS"; the time input + server expect "HH:MM".
      eod_review_time: ((prefs.eod_review_time as string | null)?.slice(0, 5)) || DEFAULTS.eod_review_time,
      meeting_reminder_minutes_before: prefs.meeting_reminder_minutes_before ?? DEFAULTS.meeting_reminder_minutes_before,
      morning_summary_enabled: prefs.morning_summary_enabled ?? DEFAULTS.morning_summary_enabled,
      morning_summary_time: ((prefs.morning_summary_time as string | null)?.slice(0, 5)) || DEFAULTS.morning_summary_time,
      birthday_reminder_days_before: prefs.birthday_reminder_days_before ?? DEFAULTS.birthday_reminder_days_before,
      travel_reminder_days_before: prefs.travel_reminder_days_before ?? DEFAULTS.travel_reminder_days_before,
      renewal_reminder_days_before: prefs.renewal_reminder_days_before ?? DEFAULTS.renewal_reminder_days_before,
      currency_code: (prefs.currency_code as string | null) || DEFAULTS.currency_code,
    };
  });
  const [timezone, setTimezone] = useState(initialTimezone || "UTC");

  function setField<K extends keyof ReminderPreferenceRow>(key: K, value: ReminderPreferenceRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const data: UpdateReminderPreferencesData = { ...form };
      const result = await updateReminderPreferences(data);
      if (result && "error" in result) {
        showToast(result.error, "error");
        return;
      }

      // Also sync eod_review_time to profile
      const profileResult = await updateProfilePrefs({ timezone, eod_review_time: form.eod_review_time });
      if (profileResult && "error" in profileResult) {
        showToast(profileResult.error, "error");
        return;
      }

      showToast("Notification preferences saved");
    });
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Section: General */}
      <section className="rounded-xl border border-blue-100 bg-white shadow-sm px-6 py-5 space-y-4">
        <h3 className="font-handwriting text-lg text-ink">General</h3>

        <div>
          <label className="block text-xs font-medium text-ink mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-light">Used for scheduling reminders and displaying the correct local date/time.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink mb-1">Currency</label>
          <select
            value={form.currency_code}
            onChange={(e) => setField("currency_code", e.target.value)}
            className="w-full max-w-sm rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label} ({c.symbol})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-light">
            Applied to all expense amounts across the app. Existing amounts are re-labeled, not converted.
          </p>
        </div>
      </section>

      {/* Section: End of day */}
      <section className="rounded-xl border border-blue-100 bg-white shadow-sm px-6 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-handwriting text-lg text-ink">End-of-Day Review</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.eod_review_enabled}
              onChange={(e) => setField("eod_review_enabled", e.target.checked)}
              className="rounded border-blue-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-sm text-ink-light">Enabled</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink mb-1">Review time</label>
          <input
            type="time"
            value={form.eod_review_time}
            onChange={(e) => setField("eod_review_time", e.target.value)}
            disabled={!form.eod_review_enabled}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40"
          />
          <p className="mt-1 text-xs text-ink-light">
            Reminds you to review unfinished activities and update statuses.
          </p>
        </div>
      </section>

      {/* Section: Morning summary */}
      <section className="rounded-xl border border-blue-100 bg-white shadow-sm px-6 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-handwriting text-lg text-ink">Morning Summary</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.morning_summary_enabled}
              onChange={(e) => setField("morning_summary_enabled", e.target.checked)}
              className="rounded border-blue-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-sm text-ink-light">Enabled</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink mb-1">Summary time</label>
          <input
            type="time"
            value={form.morning_summary_time}
            onChange={(e) => setField("morning_summary_time", e.target.value)}
            disabled={!form.morning_summary_enabled}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40"
          />
          <p className="mt-1 text-xs text-ink-light">
            A brief overview of your day&apos;s schedule and priorities.
          </p>
        </div>
      </section>

      {/* Section: Meetings */}
      <section className="rounded-xl border border-blue-100 bg-white shadow-sm px-6 py-5 space-y-4">
        <h3 className="font-handwriting text-lg text-ink">Meeting Reminders</h3>

        <div>
          <label className="block text-xs font-medium text-ink mb-1">
            Upcoming meeting lead time
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={120}
              value={form.meeting_reminder_minutes_before}
              onChange={(e) =>
                setField("meeting_reminder_minutes_before", parseInt(e.target.value, 10) || 0)
              }
              className="w-20 rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-sm text-ink-light">minutes before</span>
          </div>
          <p className="mt-1 text-xs text-ink-light">
            Alert before a meeting starts. Set 0 to disable. Meeting time-passed alerts are always on.
          </p>
        </div>
      </section>

      {/* Section: Birthdays, travel, renewals */}
      <section className="rounded-xl border border-blue-100 bg-white shadow-sm px-6 py-5 space-y-4">
        <h3 className="font-handwriting text-lg text-ink">Event Reminders</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Birthday</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={30}
                value={form.birthday_reminder_days_before}
                onChange={(e) =>
                  setField("birthday_reminder_days_before", parseInt(e.target.value, 10) || 0)
                }
                className="w-16 rounded-lg border border-blue-200 px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-xs text-ink-light">days before</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink mb-1">Travel</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={30}
                value={form.travel_reminder_days_before}
                onChange={(e) =>
                  setField("travel_reminder_days_before", parseInt(e.target.value, 10) || 0)
                }
                className="w-16 rounded-lg border border-blue-200 px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-xs text-ink-light">days before</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink mb-1">Renewal</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={30}
                value={form.renewal_reminder_days_before}
                onChange={(e) =>
                  setField("renewal_reminder_days_before", parseInt(e.target.value, 10) || 0)
                }
                className="w-16 rounded-lg border border-blue-200 px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-xs text-ink-light">days before</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-ink-light">
          Birthdays and travel driven from Year at a Glance. Renewals driven from recurring expenses.
        </p>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Save preferences
        </button>
      </div>
    </div>
  );
}
