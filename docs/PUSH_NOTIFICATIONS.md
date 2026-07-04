# Push Notifications — Setup

> **Web app / PWA push:** this document covers the **mobile** (Expo) app. For the
> web app and installable PWA — including closed-app delivery via Supabase Edge
> Functions and the notification-sound picker — see
> [WEB_PUSH_SETUP.md](./WEB_PUSH_SETUP.md).

The mobile app uses **local notifications** via `expo-notifications`. They fire on-device even while the app is closed, as long as the user has opened the app at least once since the scheduled time. This covers every notification type listed in `bugs.md` for users who open the app at least daily.

Remote push (Expo Push API) is **optional** and only needed for users who may not open the app for several days. Setup steps for that are at the bottom.

---

## What got built in code

### Reminder types (10 total, up from 7)

| Type | Trigger | Settings |
|---|---|---|
| `morning_summary` | Configured time each morning | `morning_summary_enabled`, `morning_summary_time` |
| `eod_review` | Configured time each evening | `eod_review_enabled`, `eod_review_time` |
| `meeting_upcoming` | N min before meeting start | `meeting_reminder_minutes_before` |
| `meeting_passed` | At meeting end if still "upcoming" | (always on) |
| `renewal` | N days before recurring expense | `renewal_reminder_days_before` |
| `birthday` | N days before year_entry birthday | `birthday_reminder_days_before` |
| `travel` | N days before year_entry travel/away | `travel_reminder_days_before` |
| **`activity_starting`** *(new)* | N min before scheduled block start | `activity_starting_enabled`, `activity_reminder_minutes_before` |
| **`activity_overdue`** *(new)* | At scheduled block end if status still upcoming/working | `activity_overdue_enabled` |
| **`event_upcoming`** *(new)* | N min before calendar-event start (appointment/other) | `event_reminder_minutes_before` |

### Files changed / added

- `packages/types/src/entities/reminder-preference.ts` — added 3 reminder types + 4 pref columns
- `packages/domain/src/notification/index.ts` — added `computeActivityStartingReminders`, `computeActivityOverdueReminders`, `computeEventUpcomingReminders`; updated `computeAllReminders` orchestrator
- `packages/db/supabase/migrations/20260420000001_extend_reminder_preferences.sql` — new migration
- `apps/mobile/src/lib/notifications/mobile-notifications.ts` — `scheduleAllReminders` now accepts `scheduleInstances`, `activities`, `calendarEvents`
- `apps/mobile/src/components/providers/NotificationProvider.tsx` — fetches new data, re-schedules on: prefs change, app foreground, or React Query cache changes for scheduling data
- `apps/mobile/src/hooks/useSettings.ts` — new defaults + UpdateReminderPreferencesData type expanded
- `apps/mobile/app/settings.tsx` — 3 new UI sections (Activity Starting, Activity Overdue, Appointment Reminder)
- `packages/domain/src/__tests__/notification.test.ts` — updated BASE_PREFS fixture

---

## Supabase: what you must do

### 1. Apply the new migration

From the repo root:

```bash
cd packages/db/supabase
supabase db push
```

This applies `20260420000001_extend_reminder_preferences.sql`, which:
- Adds 4 columns to `reminder_preferences` (all with defaults — no backfill needed)
- Replaces the `reminder_instances.reminder_type` CHECK with one that allows the 3 new values

If you use a managed Supabase project (not local CLI), paste the migration SQL into the SQL editor and run it.

### 2. Verify

```sql
-- Confirm new columns
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'reminder_preferences'
  and column_name in (
    'activity_starting_enabled',
    'activity_reminder_minutes_before',
    'activity_overdue_enabled',
    'event_reminder_minutes_before'
  );

-- Confirm CHECK constraint
select pg_get_constraintdef(oid) from pg_constraint
where conname = 'reminder_instances_reminder_type_check';
```

Existing users' rows will get the default values on first read (no migration needed — the defaults are built into the `ALTER TABLE` statements).

---

## How it works end-to-end

1. User opens the mobile app.
2. `NotificationProvider` (mounted at app root) requests notification permission (once per session).
3. It fetches from Supabase: reminder_preferences + meetings + year_entries + recurring expenses + schedule_instances (next 7 days) + activities (next 7 days) + calendar_events (next 7 days).
4. Calls `computeAllReminders()` (domain) to produce a sorted list of `ReminderSchedule` objects.
5. Cancels all previously-scheduled local notifications, then schedules the future ones via `expo-notifications.scheduleNotificationAsync({ trigger: DATE })`.
6. Re-schedules automatically when:
   - Settings change (prefs update)
   - App returns to foreground (with 30 s debounce)
   - Any React Query cache key for `scheduleInstances`, `activities`, `meetings`, `calendarEvents`, or `calendar_events` invalidates (with 2 s debounce)
7. Tapping a notification navigates to the relevant screen (`getNotificationRoute`).

---

## Known limits of local-only notifications

- **Expo Go does not support push** (SDK 53 removed Android support). Test on an EAS dev client or a release build.
- If the user doesn't open the app for several days and a brand-new meeting is scheduled for tomorrow by someone else (impossible in this app — it's single-user), that reminder wouldn't be scheduled until the next open. For this app, local-only is fully sufficient.
- Re-scheduling happens on foreground. If the app is force-killed, OS still fires already-scheduled notifications.

---

## Optional: add server-side remote push (for users who open the app rarely)

Not required for the bugs in `bugs.md`, but if you want it later:

**Additional Supabase work:**

1. **Create a `device_push_tokens` table:**

```sql
create table public.device_push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
alter table public.device_push_tokens enable row level security;
create policy "push_tokens_own" on public.device_push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

2. **Create a Supabase Edge Function** (`supabase/functions/send-reminders/index.ts`) that:
   - Runs on cron every 5 minutes (via `pg_cron` or Supabase Scheduled Functions)
   - Queries users whose reminders are due within the next 5 min
   - Calls `https://exp.host/--/api/v2/push/send` with Expo tokens from `device_push_tokens`
   - Writes to `reminder_instances` to prevent duplicates

3. **Mobile: register the token on login:**
   - Call `Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })`
   - Upsert into `device_push_tokens` with the result

4. **Expo / EAS configuration:**
   - Create an EAS project: `eas init`
   - Add `expo.extra.eas.projectId` to `app.json`
   - For Android: upload FCM server key to Expo dashboard
   - For iOS: upload APNs certificate/key to Expo dashboard
   - Build a dev client: `eas build --profile development --platform all`

Happy to scaffold any of the above on request.
