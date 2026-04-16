# Authentication
**Google OAuth**: Supabase Dashboard → Auth → Providers → Google → paste Client ID + Secret
**Apple OAuth**: Supabase Dashboard → Auth → Providers → Apple → configure (requires Apple Developer account + HTTPS domain)

# Project Planner
**estimated_cost precision** — returned from Supabase as a JS number (from numeric(12,2)); toLocaleString() will show it correctly, but insertion doesn't enforce currency rounding — could add Zod refinement later
**Activity section constraint on edit** — if someone edits an activity via Activities tab and removes the linked_project_id, the project won't know; progress metrics will silently drop. Needs a shared edit form with guard in a future pass.
**Delegated activities** — excluded from the in-project activity form (needs contact picker from Communication Planner, not yet built)
**No pagination** — large activity lists load entirely; add limit+cursor when counts grow

# Activities
**Carry-forward from page that isn't "today"**: the panel fetches previousDate relative to selectedDate, so navigating to a past date shows that date's prior day — could confuse users, but is correct behavior
**No pagination**: fetches all activities for a date. Fine for a personal app; worth revisiting if someone accumulates 100+ activities per day
**Postpone target is always +1 day from selectedDate** — the spec mentions "move to date" as a future option; the edit modal's date field serves that purpose for now
**remaining_minutes sync**: on edit, remaining is reset to new estimated value. Once scheduling (ScheduleInstance) is built, this logic needs to account for already-scheduled minutes
**Delegated activity creation**: fully blocked until Communication Planner is built.
**Amount of hours worked**: add this field to the activity table. It should be a number and should be used to calculate the progress of the activity. 

# Daily Plan
**Remaining time**: When a user schedule an activity for a certain time, it should be added to the timeline. And the amount of time the user kept it scheduled should be added to the activity's amount of hours worked. 
---

# Mobile Settings Screen — Surgical Rebuild Plan

## Context

The mobile Settings screen at `apps/mobile/app/settings.tsx` (728 lines) **looks complete on the surface but has multiple silent failures**. The user discovered this pattern across the mobile app: surface UI exists, but actual functionality is broken or doesn't match the web. We're starting fresh with **screen-by-screen surgical rebuilds** — keep what works (hooks, types, theme, navigation), rewrite the screen file to match the web's behavior 1:1.

**Why Settings first:** smallest, lowest risk, self-contained. Establishes the workflow before tackling Daily Plan + Activities.

**Source of truth:** the web app (`apps/web/src/app/(app)/settings/page.tsx` + `ReminderSettingsView.tsx` + `actions.ts`). Mobile must match field-for-field.

---

## Behavior spec (derived from web)

The Settings screen edits two database tables:

- **`reminder_preferences`** — 8 fields controlling notifications
- **`users`** (mobile) / **`profiles`** (web) — `timezone` + mirrored `eod_review_time`

Plus an Account section with email + sign-out.

### Field inventory

| Field | Type | Range | Default | Conditional |
|---|---|---|---|---|
| `morning_summary_enabled` | bool | — | true | — |
| `morning_summary_time` | "HH:MM" | 00:00–23:59 | "08:00" | shown only when enabled |
| `eod_review_enabled` | bool | — | true | — |
| `eod_review_time` | "HH:MM" | 00:00–23:59 | "21:00" | shown only when enabled |
| `meeting_reminder_minutes_before` | int | 0–120 | **15** | — |
| `birthday_reminder_days_before` | int | 0–30 | 1 | — |
| `travel_reminder_days_before` | int | 0–30 | 1 | — |
| `renewal_reminder_days_before` | int | 0–30 | **3** | — |
| `users.timezone` | IANA string | — | "UTC" | — |

### Save semantics

- **Mobile keeps immediate save** (per-field) — native Settings UX (iOS / Android).
- On `eod_review_time` change → save to **both** `reminder_preferences.eod_review_time` AND `users.eod_review_time` (web mirrors them).
- On error → **revert local state** to last server value + show error toast.
- On success → no toast (immediate save = silent OK), only on errors.

### Downstream consumers (already wired)

`apps/mobile/src/components/providers/NotificationProvider.tsx` reads these values via `useReminderPreferences()` and `useProfile()` and computes reminder schedules using `@pm/domain` helpers (`computeAllReminders`, etc.). **No changes needed here** — this provider already works against the same hooks.

---

## Bugs to fix

| # | Severity | Location | Bug |
|---|---|---|---|
| 1 | HIGH | `useSettings.ts:78,83` | Insert defaults wrong: `meeting=10` (web=15), `renewal=1` (web=3) |
| 2 | HIGH | `useSettings.ts:60-87` | Race: `select` then `insert/update` — concurrent saves from a fresh user trigger UNIQUE violation. Use `upsert({...}, { onConflict: 'user_id' })` like web does. |
| 3 | HIGH | `settings.tsx:80,83` | Local-state defaults wrong (10/1 vs 15/3) |
| 4 | HIGH | `settings.tsx:112-123` | No rollback on mutation error → user sees value they didn't actually save |
| 5 | HIGH | `useSettings.ts:116` | `UpdateProfileData` lacks `eod_review_time` → can't mirror to `users` table |
| 6 | HIGH | `settings.tsx:209-218` | `eod_review_time` only saves to `reminder_preferences`, not `users` (web saves both) |
| 7 | MEDIUM | `settings.tsx:37-61` | Timezone list has 23 entries — web has 73 with UTC-offset labels |
| 8 | MEDIUM | `settings.tsx:391` | TimePickerRow only allows 4 minute values (00/15/30/45). If server has "08:37" UI can't represent it |
| 9 | MEDIUM | `settings.tsx:388` | `value.split(':')` crashes if value is null/malformed |
| 10 | LOW | `settings.tsx:31` | MEETING_REMINDER_OPTIONS missing 0 (web allows 0 to disable) |
| 11 | LOW | n/a | No loading indicator while initial fetch in flight |
| 12 | LOW | n/a | No client-side range validation feedback (currently chips enforce ranges, but free-text time picker would not) |

---

## Files to change

### 1. `apps/mobile/src/hooks/useSettings.ts` — fix hooks

- Replace the manual `select` + branch + `insert` / `update` with a single Supabase `upsert(payload, { onConflict: 'user_id' })`. Match the web's `actions.ts:65-95` pattern.
- In the upsert payload, set defaults to: `meeting_reminder_minutes_before: 15`, `renewal_reminder_days_before: 3` (others stay).
- Extend `UpdateProfileData` to include `eod_review_time?: string | null`.

### 2. `apps/mobile/app/settings.tsx` — surgical rewrite

Keep the file structure (sections: Notifications / Display / Account) but:

- **Defaults**: change initial state to `meetingMinutes=15`, `renewalDays=3`.
- **Replace bespoke `TimePickerRow`** with shared `TimePickerField` from `apps/mobile/src/components/ui/TimePickerField.tsx`. Add tiny adapter for HH:MM ↔ Date conversion (TimePickerField uses Date, hook expects "HH:MM").
- **Keep custom timezone modal** (it has search, which `SelectPickerField` lacks — important for 73 entries) but **expand the timezone list to 73 entries with UTC-offset labels**, matching the web's `ReminderSettingsView.tsx:16-93`. Extract to a constant so it can be reused later.
- **Error rollback**: capture the previous value before each `setX(v) + savePrefs({...: v})`, restore in mutation `onError`. Prefer using `useMutation`'s `onError` callback with a captured snapshot.
- **eod_review_time sync**: when EOD time changes, fire BOTH `updatePrefs.mutate({ eod_review_time })` AND `updateProfile.mutate({ eod_review_time })`. Use `Promise.all` semantics or sequential — either is fine for immediate-save.
- **Loading state**: while `useReminderPreferences().isLoading || useProfile().isLoading`, render a centered "Loading…" placeholder instead of stale defaults.
- **Null-safe time parsing**: in any time-string handling, guard against null/malformed (`(value ?? '00:00').split(':')`).
- **Add `0` option** to `MEETING_REMINDER_OPTIONS` so users can disable meeting alerts (web allows 0).
- **Remove unused styles** (`header`, `backBtn`, `headerTitle` — they're dead code from when the screen had its own header).

### 3. No changes to:

- `packages/types/src/entities/reminder-preference.ts` — types are correct
- `packages/types/src/entities/user.ts` — types are correct
- `apps/mobile/src/components/providers/NotificationProvider.tsx` — already consumes hooks correctly
- `apps/mobile/app/_layout.tsx` — navigation already wires Settings into the drawer

---

## Reusable components/utilities

| Reusing | Path |
|---|---|
| `TimePickerField` (replaces TimePickerRow) | `apps/mobile/src/components/ui/TimePickerField.tsx` |
| Theme tokens (colors, spacing, typography) | `apps/mobile/src/theme/` |
| `useReminderPreferences`, `useUpdateReminderPreferences`, `useProfile`, `useUpdateProfile` | `apps/mobile/src/hooks/useSettings.ts` (after fix) |
| `ReminderPreference`, `User` types | `@pm/types` |

**Not reused:** `SelectPickerField` (no search; bad fit for 73 timezones). Keep custom modal.

---

## Verification

After implementation, manually verify on a real device or simulator:

1. **Cold load** — open Settings on a freshly-installed app. Should show "Loading…" briefly, then default values (15 mins, 3 days for renewal).
2. **Toggle Morning Summary off** → time field disappears. Toggle on → time field reappears with previous value.
3. **Change Morning Summary time** → modify, close & reopen Settings → value persists.
4. **Change EOD time** → close & reopen Settings → value persists. Then verify in Supabase that BOTH `reminder_preferences.eod_review_time` and `users.eod_review_time` were updated.
5. **Change timezone** → open dropdown, search "kolk", pick "Asia/Kolkata (IST, UTC+5:30)" → value persists in `users.timezone`.
6. **Force a save error** — disable network → toggle a switch → confirm:
   - Error toast/alert appears
   - Toggle reverts to previous state (NOT stuck on the new state)
7. **Race-condition test for fresh user**: with a brand-new account (no `reminder_preferences` row), toggle two switches quickly. Confirm no UNIQUE-constraint error in Supabase logs and both saves persist.
8. **NotificationProvider integration**: change EOD time to 2 minutes from now → wait → confirm reminder fires (or appears in `reminder_instances` table on next focus).
9. **Sign Out** → confirms then routes to login screen.
10. **Type check** — run `npx tsc --noEmit` from `apps/mobile/` and confirm zero new errors in `settings.tsx` or `useSettings.ts`.

---

## Out of scope (intentionally deferred)

- Push notifications via `expo-notifications` — separate workstream once 2-3 screens are solid
- "Save" button pattern (web has one; mobile keeps immediate-save per-field — native UX convention)
- Toast component for success messages (immediate-save = silent OK)
- Dark mode (CLAUDE.md says light-only)
