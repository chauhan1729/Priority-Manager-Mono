-- Migration 019: calendar_month_notes
-- Spec §10.2: bottom monthly notes area — free text per month, stored cleanly
-- without polluting calendar_event records.

create table if not exists public.calendar_month_notes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  month_key  text        not null,
  notes      text        not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One note record per user per month
  constraint uq_calendar_month_notes unique (user_id, month_key),

  -- month_key must be YYYY-MM
  constraint chk_month_key_format check (month_key ~ '^\d{4}-\d{2}$')
);

alter table public.calendar_month_notes enable row level security;

create policy "calendar_month_notes_own" on public.calendar_month_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_calendar_month_notes_user_month
  on public.calendar_month_notes (user_id, month_key);

comment on table public.calendar_month_notes is 'Free-text monthly notes for Calendar (spec §10.2). One row per user per month. Does not pollute calendar_event records.';
