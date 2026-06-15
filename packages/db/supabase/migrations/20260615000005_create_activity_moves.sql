-- Migration: activity_moves (Phase 2A — intentional B re-dating history).
-- Records each time an activity is moved from one date to another, so the movement history
-- (originally planned date → chosen date) is preserved rather than silently overwritten.

create table if not exists public.activity_moves (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  activity_id uuid        not null references public.activities(id) on delete cascade,
  from_date   date        not null,
  to_date     date        not null,
  reason      text,
  moved_at    timestamptz not null default now()
);

create index if not exists idx_activity_moves_activity on public.activity_moves (activity_id, moved_at);

alter table public.activity_moves enable row level security;

create policy "activity_moves_own" on public.activity_moves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.activity_moves is 'Phase 2A: per-activity move history (from_date → to_date) for intentional re-dating.';
