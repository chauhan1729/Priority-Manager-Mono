-- Migration: weekly Someday-review reminder (Phase 1B).
-- Adds preference columns + extends the reminder_instances reminder_type CHECK.

alter table public.reminder_preferences
  add column if not exists someday_review_enabled boolean not null default true,
  add column if not exists someday_review_weekday integer not null default 0
    check (someday_review_weekday between 0 and 6),
  add column if not exists someday_review_time    text    not null default '09:00';

-- Extend the reminder_type CHECK with the new value (re-create safely).
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
    'activity_starting', 'activity_overdue', 'event_upcoming',
    'weekly_someday_review'
  ));

comment on column public.reminder_preferences.someday_review_enabled is
  'Phase 1B: weekly reminder to review the Someday list and pull items into the 30-day horizon.';
comment on column public.reminder_preferences.someday_review_weekday is
  '0=Sunday … 6=Saturday — the weekday the Someday review fires.';
