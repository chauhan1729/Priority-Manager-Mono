-- Migration 002: annual_goals
-- Spec §10.3: 3 sections — Business, Career, Personal.
-- Manual progress; no direct FK to activities.

create table if not exists public.annual_goals (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  section          text        not null
                   check (section in ('business', 'career', 'personal')),
  title            text        not null,
  description      text        not null default '',
  why_it_matters   text        not null default '',
  target_date      date,
  progress_percent integer     not null default 0
                   check (progress_percent between 0 and 100),
  status           text        not null default 'not_started'
                   check (status in ('not_started', 'active', 'on_track', 'at_risk', 'completed', 'dropped')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.annual_goals.progress_percent is 'Spec §10.3: manual — user sets directly. No auto-calc in v1.';
