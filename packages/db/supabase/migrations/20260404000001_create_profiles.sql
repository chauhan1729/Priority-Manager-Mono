-- Migration 001: profiles
-- Extends Supabase auth.users with app-specific fields.
-- One row per authenticated user; id matches auth.users(id).

create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  name             text        not null default '',
  email            text        not null,
  auth_provider    text        not null default 'email'
                   check (auth_provider in ('email', 'google', 'apple')),
  timezone         text        not null default 'UTC',
  eod_review_time  time,       -- user-preferred end-of-day review time, e.g. '21:00'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'App-level user profile, 1-to-1 with auth.users.';
comment on column public.profiles.eod_review_time is 'Spec §13: user-configurable end-of-day review notification time.';
