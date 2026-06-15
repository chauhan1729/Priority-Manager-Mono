-- Migration: cycles (Phase 1A — Work Cycles).
-- A Cycle is a completion-driven, count-up focus session against an activity. It reuses
-- schedule_instances for timeline placement (optional link). No countdown / fixed length.

create table if not exists public.cycles (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  activity_id           uuid        not null references public.activities(id) on delete cascade,
  schedule_instance_id  uuid        references public.schedule_instances(id) on delete set null,

  soft_target_minutes   integer     check (soft_target_minutes is null or soft_target_minutes > 0),
  elapsed_focus_minutes integer     not null default 0 check (elapsed_focus_minutes >= 0),
  -- Anchor of the active focus segment; null while on break / completed / abandoned.
  segment_started_at    timestamptz,
  break_count           integer     not null default 0 check (break_count >= 0),
  phase                 text        not null default 'focus'
                        check (phase in ('focus', 'break', 'completed', 'abandoned')),
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- completed_at present iff completed
  constraint chk_cycle_completed_at check (
    (phase = 'completed' and completed_at is not null) or
    (phase <> 'completed')
  ),
  -- a focus segment must have an anchor; non-focus must not
  constraint chk_cycle_focus_anchor check (
    (phase = 'focus' and segment_started_at is not null) or
    (phase <> 'focus' and segment_started_at is null)
  )
);

-- Index for "today's cycles for this user/activity" lookups.
create index if not exists idx_cycles_user_activity
  on public.cycles (user_id, activity_id);

create index if not exists idx_cycles_user_started
  on public.cycles (user_id, started_at);

-- RLS: user owns their cycles.
alter table public.cycles enable row level security;

create policy "cycles_own" on public.cycles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.cycles is 'Phase 1A: completion-driven count-up focus sessions against an activity.';
comment on column public.cycles.segment_started_at is 'Anchor of the active focus segment; null on break/completed/abandoned. Live elapsed = elapsed_focus_minutes + (now - segment_started_at) while in focus.';
comment on column public.cycles.soft_target_minutes is 'Informational target from activity.estimated_minutes. Never a hard stop — cycles are completion-driven.';
