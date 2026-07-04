"use client";

import { useState, useTransition } from "react";

import { CURRENCY_OPTIONS } from "@pm/domain";
import type { NotificationSound } from "@pm/types";

import {
  updateProfilePrefs,
  updateReminderPreferences,
  type UpdateReminderPreferencesData,
} from "@/app/(app)/settings/actions";
import { showToast } from "@/components/ui/Toaster";
import { NOTIFICATION_SOUND_OPTIONS, playNotificationSound } from "@/lib/notifications/sounds";
import { enableWebPush, type PushSetupResult } from "@/lib/notifications/web-push";

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
  notification_sound: NotificationSound;
  notification_sound_enabled: boolean;
  someday_review_enabled: boolean;
  someday_review_weekday: number;
  someday_review_time: string;
  activity_due_today_enabled: boolean;
  activity_past_due_enabled: boolean;
  activity_nudge_time: string;
}

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

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
  notification_sound: "chime",
  notification_sound_enabled: true,
  someday_review_enabled: true,
  someday_review_weekday: 0,
  someday_review_time: "09:00",
  activity_due_today_enabled: true,
  activity_past_due_enabled: true,
  activity_nudge_time: "09:00",
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
      notification_sound: (prefs.notification_sound as NotificationSound | null) || DEFAULTS.notification_sound,
      notification_sound_enabled: prefs.notification_sound_enabled ?? DEFAULTS.notification_sound_enabled,
      someday_review_enabled: prefs.someday_review_enabled ?? DEFAULTS.someday_review_enabled,
      someday_review_weekday: prefs.someday_review_weekday ?? DEFAULTS.someday_review_weekday,
      someday_review_time: ((prefs.someday_review_time as string | null)?.slice(0, 5)) || DEFAULTS.someday_review_time,
      activity_due_today_enabled: prefs.activity_due_today_enabled ?? DEFAULTS.activity_due_today_enabled,
      activity_past_due_enabled: prefs.activity_past_due_enabled ?? DEFAULTS.activity_past_due_enabled,
      activity_nudge_time: ((prefs.activity_nudge_time as string | null)?.slice(0, 5)) || DEFAULTS.activity_nudge_time,
    };
  });
  const [timezone, setTimezone] = useState(initialTimezone || "UTC");

  const [pushBusy, setPushBusy] = useState(false);

  function setField<K extends keyof ReminderPreferenceRow>(key: K, value: ReminderPreferenceRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const PUSH_MESSAGES: Record<PushSetupResult, { text: string; kind: "success" | "error" }> = {
    subscribed: { text: "Notifications enabled on this device", kind: "success" },
    denied: { text: "Permission denied — enable notifications in your browser settings", kind: "error" },
    unsupported: { text: "This browser doesn't support push notifications", kind: "error" },
    "no-vapid-key": { text: "Push isn't configured on the server yet (missing VAPID key)", kind: "error" },
    error: { text: "Couldn't enable notifications — please try again", kind: "error" },
  };

  async function handleEnablePush() {
    setPushBusy(true);
    try {
      const result = await enableWebPush();
      const msg = PUSH_MESSAGES[result];
      showToast(msg.text, msg.kind === "error" ? "error" : undefined);
    } finally {
      setPushBusy(false);
    }
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

      {/* Section: Device notifications */}
      <section className="rounded-xl border border-blue-100 bg-white shadow-sm px-6 py-5 space-y-4">
        <h3 className="font-handwriting text-lg text-ink">Device Notifications</h3>

        <div>
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={pushBusy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {pushBusy ? "Enabling…" : "Enable notifications on this device"}
          </button>
          <p className="mt-2 text-xs text-ink-light">
            Turns on push notifications so reminders reach you even when the app is closed.
            You&apos;ll be asked to allow notifications. Do this once per device/browser.
            On iPhone/iPad, first add the app to your Home Screen, then enable here.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-blue-50 pt-4">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Notification sound</label>
            <p className="text-xs text-ink-light">Play a sound with reminders.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.notification_sound_enabled}
              onChange={(e) => setField("notification_sound_enabled", e.target.checked)}
              className="rounded border-blue-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-sm text-ink-light">Enabled</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink mb-1">Sound</label>
          <div className="flex items-center gap-2">
            <select
              value={form.notification_sound}
              onChange={(e) => setField("notification_sound", e.target.value as NotificationSound)}
              disabled={!form.notification_sound_enabled}
              className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40"
            >
              {NOTIFICATION_SOUND_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => playNotificationSound(form.notification_sound)}
              disabled={!form.notification_sound_enabled || form.notification_sound === "none"}
              className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink hover:bg-blue-50 transition disabled:opacity-40"
            >
              Preview
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-light">
            The chosen sound plays while the app is open. When the app is closed, your
            device&apos;s default notification sound is used (browsers don&apos;t allow a
            custom sound for background notifications).
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

      {/* Section: Activity nudges */}
      <section className="rounded-xl border border-blue-100 bg-white shadow-sm px-6 py-5 space-y-4">
        <h3 className="font-handwriting text-lg text-ink">Activity Reminders</h3>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Due today, not scheduled</label>
            <p className="text-xs text-ink-light">
              Nudge for A-priority activities due today that aren&apos;t on the timeline yet.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activity_due_today_enabled}
              onChange={(e) => setField("activity_due_today_enabled", e.target.checked)}
              className="rounded border-blue-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-sm text-ink-light">Enabled</span>
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-blue-50 pt-4">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Overdue activities</label>
            <p className="text-xs text-ink-light">
              Nudge when an activity&apos;s date has passed and it&apos;s still not done.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activity_past_due_enabled}
              onChange={(e) => setField("activity_past_due_enabled", e.target.checked)}
              className="rounded border-blue-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-sm text-ink-light">Enabled</span>
          </label>
        </div>

        <div className="border-t border-blue-50 pt-4">
          <label className="block text-xs font-medium text-ink mb-1">Reminder time</label>
          <input
            type="time"
            value={form.activity_nudge_time}
            onChange={(e) => setField("activity_nudge_time", e.target.value)}
            disabled={!form.activity_due_today_enabled && !form.activity_past_due_enabled}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40"
          />
          <p className="mt-1 text-xs text-ink-light">When the due-today and overdue nudges fire each day.</p>
        </div>
      </section>

      {/* Section: Weekly Someday review */}
      <section className="rounded-xl border border-blue-100 bg-white shadow-sm px-6 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-handwriting text-lg text-ink">Weekly Someday Review</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.someday_review_enabled}
              onChange={(e) => setField("someday_review_enabled", e.target.checked)}
              className="rounded border-blue-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-sm text-ink-light">Enabled</span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Day</label>
            <select
              value={form.someday_review_weekday}
              onChange={(e) => setField("someday_review_weekday", parseInt(e.target.value, 10))}
              disabled={!form.someday_review_enabled}
              className="w-full rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40"
            >
              {WEEKDAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink mb-1">Time</label>
            <input
              type="time"
              value={form.someday_review_time}
              onChange={(e) => setField("someday_review_time", e.target.value)}
              disabled={!form.someday_review_enabled}
              className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40"
            />
          </div>
        </div>

        <p className="text-xs text-ink-light">
          A weekly prompt to review your Someday list and pull anything ready into the next 30 days.
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
