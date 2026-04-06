-- Migration 015: reminder_preferences + reminder_instances
-- Spec §13: user-configurable notification behavior.
-- One preferences row per user; instances generated when notifications fire.

create table if not exists public.reminder_preferences (
  id                              uuid        primary key default gen_random_uuid(),
  user_id                         uuid        not null unique references public.profiles(id) on delete cascade,
  eod_review_enabled              boolean     not null default true,
  eod_review_time                 time        not null default '21:00',
  meeting_reminder_minutes_before integer     not null default 15,
  morning_summary_enabled         boolean     not null default true,
  morning_summary_time            time        not null default '08:00',
  birthday_reminder_days_before   integer     not null default 1,
  travel_reminder_days_before     integer     not null default 1,
  renewal_reminder_days_before    integer     not null default 3,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

-- Lightweight log of fired reminders (for deduplication and audit)
create table if not exists public.reminder_instances (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  reminder_type   text        not null
                  check (reminder_type in (
                    'eod_review', 'meeting_upcoming', 'meeting_passed',
                    'renewal', 'birthday', 'travel', 'morning_summary'
                  )),
  source_id       uuid,       -- optional: meeting_id, year_entry_id, expense_id, etc.
  scheduled_for   timestamptz not null,
  fired_at        timestamptz,
  dismissed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_reminder_instances_user_scheduled
  on public.reminder_instances (user_id, scheduled_for)
  where fired_at is null;

comment on table public.reminder_preferences is 'Spec §13: one row per user, controls all notification timing preferences.';
comment on table public.reminder_instances is 'Log of generated reminders. Used to prevent duplicate firing and support dismiss tracking.';
