-- Migration: Karmic Management — Karmic Business Partners + Personal Ethical Code.
-- Companion to the existing Six-Time / Nightly Review tables. All owner-scoped (RLS).
-- Two practices from "Karmic Management" (Roach/McNally/Gordon):
--   KM Rule #3 — make your four karmic business partners successful (a daily action each).
--   Seven-Point Program #3 — keep a personal ethical code, checked nightly.

-- 1. The four fixed partner slots (one row per group per user).
create table if not exists public.karmic_partners (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  partner_group  text        not null check (partner_group in ('coworkers', 'customers', 'suppliers', 'world')),
  name           text,
  success_vision text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint uq_karmic_partner_group unique (user_id, partner_group)
);

-- 2. The daily "what I'll do to make them successful" actions (tied to the group so
--    they survive renaming the partner). Giving-style incremental add/delete + done.
create table if not exists public.karmic_partner_actions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  partner_group  text        not null check (partner_group in ('coworkers', 'customers', 'suppliers', 'world')),
  action_date    date        not null,
  text           text        not null,
  done           boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_karmic_partner_actions_user_date
  on public.karmic_partner_actions (user_id, action_date);

-- 3. The personal ethical code — an ordered, editable list of principles per user
--    (seeded in-app with the book's five defaults on first visit).
create table if not exists public.karmic_ethics_principles (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  label       text        not null,
  sort_order  integer     not null default 0,
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_karmic_ethics_principles_user
  on public.karmic_ethics_principles (user_id);

-- 4. The nightly per-principle check (kept/slipped + optional note), one row per
--    (user, night, principle).
create table if not exists public.karmic_ethics_checkins (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  checkin_date  date        not null,
  principle_id  uuid        not null references public.karmic_ethics_principles(id) on delete cascade,
  kept          boolean     not null,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_karmic_ethics_checkin unique (user_id, checkin_date, principle_id)
);
create index if not exists idx_karmic_ethics_checkins_user_date
  on public.karmic_ethics_checkins (user_id, checkin_date);

-- RLS: each user sees only their own rows.
alter table public.karmic_partners          enable row level security;
alter table public.karmic_partner_actions   enable row level security;
alter table public.karmic_ethics_principles enable row level security;
alter table public.karmic_ethics_checkins   enable row level security;

create policy "karmic_partners_own"          on public.karmic_partners          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "karmic_partner_actions_own"   on public.karmic_partner_actions   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "karmic_ethics_principles_own" on public.karmic_ethics_principles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "karmic_ethics_checkins_own"   on public.karmic_ethics_checkins   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.karmic_partners is 'Karmic Management KM Rule #3: the four karmic business partner slots (coworkers/customers/suppliers/world) with who + what their success looks like.';
comment on table public.karmic_partner_actions is 'Daily concrete actions to make each karmic partner successful (per group, per day, with a done flag).';
comment on table public.karmic_ethics_principles is 'Seven-Point Program #3: the user''s editable personal ethical code.';
comment on table public.karmic_ethics_checkins is 'Nightly kept/slipped check against each personal-ethics principle, with an optional note.';
