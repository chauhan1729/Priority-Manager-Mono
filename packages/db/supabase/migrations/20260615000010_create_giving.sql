-- Migration: Giving — 90-Day Karma Scorecard (Phase 5).

create table if not exists public.giving_challenges (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  start_date        date        not null,
  mode              text        not null default 'challenge' check (mode in ('challenge', 'continuous')),
  status            text        not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  reviewed_at       timestamptz,
  continue_decision boolean,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- At most one active challenge per user.
create unique index if not exists uq_giving_active_challenge
  on public.giving_challenges (user_id) where status = 'active';

-- One logged item per row (given / received / cognition). Many allowed per day.
drop table if exists public.giving_entries cascade; -- superseded by giving_logs (no data lost; new feature)
create table if not exists public.giving_logs (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  challenge_id     uuid        not null references public.giving_challenges(id) on delete cascade,
  entry_date       date        not null,
  kind             text        not null check (kind in ('given', 'received', 'cognition')),
  content          text        not null,
  categories       text[]      not null default '{}',
  given_in_secret  boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_giving_logs_challenge
  on public.giving_logs (challenge_id, entry_date);

-- Daily giving reminder preference.
alter table public.reminder_preferences
  add column if not exists giving_reminder_enabled boolean not null default true,
  add column if not exists giving_reminder_time    text    not null default '20:00';

-- RLS
alter table public.giving_challenges enable row level security;
alter table public.giving_logs       enable row level security;
drop policy if exists "giving_challenges_own" on public.giving_challenges;
drop policy if exists "giving_logs_own"        on public.giving_logs;
create policy "giving_challenges_own" on public.giving_challenges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "giving_logs_own"       on public.giving_logs       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Extend the reminder_instances type CHECK with the giving reminder.
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
    'six_time_slot', 'six_time_nightly', 'giving_daily'
  ));

comment on table public.giving_challenges is 'Phase 5: a 90-day giving challenge (or continuous mode after review).';
comment on table public.giving_logs is 'Phase 5: individual give/receive/cognition logs (the Karma Scorecard); many per day.';
