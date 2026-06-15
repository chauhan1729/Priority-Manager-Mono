-- Migration: Six-Time Book (tundruk) — Phase 4.
-- Three focus problems cycled across six daily slots; each slot logs +/−/to-do; plus a nightly review.

-- 1. Focus problems (exactly 3 active per user).
create table if not exists public.six_time_problems (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  position        integer     not null check (position between 1 and 3),
  problem         text        not null,
  solution        text        not null,
  reminder_phrase text        not null,
  status          text        not null default 'active' check (status in ('active', 'retired')),
  created_at      timestamptz not null default now(),
  retired_at      timestamptz,
  updated_at      timestamptz not null default now()
);
-- At most one active problem per (user, position).
create unique index if not exists uq_six_time_active_position
  on public.six_time_problems (user_id, position)
  where status = 'active';

-- 2. Daily slot entries (6 per day).
create table if not exists public.six_time_entries (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  entry_date  date        not null,
  slot_index  integer     not null check (slot_index between 1 and 6),
  problem_id  uuid        not null references public.six_time_problems(id) on delete cascade,
  plus        text,
  minus       text,
  todo        text,
  logged_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_six_time_entry unique (user_id, entry_date, slot_index)
);
create index if not exists idx_six_time_entries_user_date
  on public.six_time_entries (user_id, entry_date);

-- 3. Nightly review (one per day).
create table if not exists public.six_time_nightly_reviews (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  review_date date        not null,
  best        text[]      not null default '{}',
  worst       text[]      not null default '{}',
  logged_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_six_time_nightly unique (user_id, review_date)
);

-- 4. Config (one per user).
create table if not exists public.six_time_config (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  enabled      boolean     not null default true,
  slot_times   text[]      not null default array['08:00','10:30','12:30','15:00','18:00','21:30'],
  nightly_time text        not null default '22:30',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint uq_six_time_config_user unique (user_id),
  constraint chk_six_time_slot_count check (array_length(slot_times, 1) = 6)
);

-- RLS
alter table public.six_time_problems        enable row level security;
alter table public.six_time_entries         enable row level security;
alter table public.six_time_nightly_reviews enable row level security;
alter table public.six_time_config          enable row level security;

create policy "six_time_problems_own"        on public.six_time_problems        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "six_time_entries_own"         on public.six_time_entries         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "six_time_nightly_reviews_own" on public.six_time_nightly_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "six_time_config_own"          on public.six_time_config          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.six_time_problems is 'Phase 4: the three (swappable) focus problems for the Six-Time Book.';
comment on table public.six_time_entries is 'Phase 4: six daily slot entries (+/−/to-do), each tied to one focus problem.';

-- Extend the reminder_instances type CHECK with the Six-Time reminders.
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
    'six_time_slot', 'six_time_nightly'
  ));
