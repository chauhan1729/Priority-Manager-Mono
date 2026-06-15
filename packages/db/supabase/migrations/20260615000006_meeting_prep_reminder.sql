-- Migration: meeting-prep reminder (Phase 2B).
-- "Prepare for meeting" reminder fired N days before a scheduled meeting (default 1 day before),
-- driven from the shared meetings record — no duplicate task.

alter table public.reminder_preferences
  add column if not exists meeting_prep_enabled     boolean not null default true,
  add column if not exists meeting_prep_days_before integer not null default 1
    check (meeting_prep_days_before between 0 and 14);

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
    'weekly_someday_review', 'meeting_prep'
  ));

comment on column public.reminder_preferences.meeting_prep_enabled is
  'Phase 2B: if true, remind the user to prepare N days before a scheduled meeting.';
