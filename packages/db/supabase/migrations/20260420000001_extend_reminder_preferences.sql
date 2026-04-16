-- Migration: extend reminder_preferences with activity + event reminder settings,
-- and extend reminder_instances.reminder_type CHECK with new values.
-- Spec §13 + §18.4: activity blocks and calendar events now trigger reminders.

-- 1. Add new preference columns (defaulted so existing rows remain valid)
alter table public.reminder_preferences
  add column if not exists activity_starting_enabled        boolean not null default true,
  add column if not exists activity_reminder_minutes_before integer not null default 5,
  add column if not exists activity_overdue_enabled         boolean not null default true,
  add column if not exists event_reminder_minutes_before    integer not null default 15;

-- 2. Drop and re-add the reminder_type CHECK constraint with 3 new values.
-- Postgres doesn't support IF EXISTS on constraints in all versions, so do it safely.
do $$
begin
  if exists (
    select 1
    from information_schema.constraint_column_usage
    where table_name = 'reminder_instances'
      and constraint_name = 'reminder_instances_reminder_type_check'
  ) then
    alter table public.reminder_instances
      drop constraint reminder_instances_reminder_type_check;
  end if;
end $$;

alter table public.reminder_instances
  add constraint reminder_instances_reminder_type_check
  check (reminder_type in (
    'eod_review', 'meeting_upcoming', 'meeting_passed',
    'renewal', 'birthday', 'travel', 'morning_summary',
    'activity_starting', 'activity_overdue', 'event_upcoming'
  ));

comment on column public.reminder_preferences.activity_starting_enabled is
  'Spec §18.4: if true, remind user N minutes before a scheduled activity block starts.';
comment on column public.reminder_preferences.activity_reminder_minutes_before is
  'Minutes before start_at to fire activity_starting reminders.';
comment on column public.reminder_preferences.activity_overdue_enabled is
  'Spec §18.4: if true, remind user to update status when a scheduled block''s end_at has passed.';
comment on column public.reminder_preferences.event_reminder_minutes_before is
  'Minutes before start_at to fire event_upcoming reminders (appointments, other calendar events).';
