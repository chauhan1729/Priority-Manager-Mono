-- Migration: activity date-based nudges (Group D) — due-today + past-due.
--
-- Adds two reminder types driven from the shared Activity records (no duplicate
-- reminder rows), plus preference columns to control them. Also re-asserts the
-- reminder_instances.reminder_type CHECK with the full current set (defensive:
-- the remote history has drifted from the repo, so we make the constraint match
-- the code's ReminderType union authoritatively).

-- 1. Preference columns (defaulted so existing rows stay valid — no backfill).
alter table public.reminder_preferences
  add column if not exists activity_due_today_enabled boolean not null default true,
  add column if not exists activity_past_due_enabled  boolean not null default true,
  add column if not exists activity_nudge_time        text    not null default '09:00';

-- Defensive: ensure the Someday-review columns exist (this migration adds a
-- settings UI that writes them; the remote migration history has drifted, so we
-- can't assume 20260615000004 was applied). No-op if already present.
alter table public.reminder_preferences
  add column if not exists someday_review_enabled boolean not null default true,
  add column if not exists someday_review_weekday integer not null default 0,
  add column if not exists someday_review_time    text    not null default '09:00';

comment on column public.reminder_preferences.activity_due_today_enabled is
  'If true, nudge for A-priority activities dated today that are not yet scheduled.';
comment on column public.reminder_preferences.activity_past_due_enabled is
  'If true, nudge for still-actionable activities whose date has passed.';
comment on column public.reminder_preferences.activity_nudge_time is
  'HH:MM local time the activity due-today / past-due nudges fire.';

-- 2. Re-assert the reminder_instances type CHECK with the complete set.
do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'reminder_instances'
      and constraint_name = 'reminder_instances_reminder_type_check'
  ) then
    alter table public.reminder_instances drop constraint reminder_instances_reminder_type_check;
  end if;
end $$;

alter table public.reminder_instances
  add constraint reminder_instances_reminder_type_check
  check (reminder_type in (
    'eod_review', 'meeting_upcoming', 'meeting_passed',
    'renewal', 'birthday', 'travel', 'morning_summary',
    'activity_starting', 'activity_overdue', 'event_upcoming',
    'weekly_someday_review', 'meeting_prep',
    'six_time_slot', 'six_time_nightly', 'giving_daily',
    'activity_due_today', 'activity_past_due'
  ));
