-- Migration 013: schedule_instances
-- Spec §9: ScheduleInstance is separate from Activity.
-- One activity can have multiple schedule instances (partial scheduling, history).
-- Polymorphic source: can reference activity, meeting, or appointment.
--
-- Design decision: we use separate nullable FK columns rather than a single
-- source_id uuid with no FK. This gives referential integrity at the DB level.
-- A CHECK constraint ensures exactly one source FK is non-null.

create table if not exists public.schedule_instances (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  source_type         text        not null
                      check (source_type in ('activity', 'meeting', 'appointment', 'other')),

  -- Typed source FKs (exactly one must be non-null based on source_type)
  source_activity_id  uuid        references public.activities(id) on delete cascade,
  source_meeting_id   uuid        references public.meetings(id) on delete cascade,
  -- 'appointment' and 'other' source types reference calendar_events
  source_event_id     uuid        references public.calendar_events(id) on delete cascade,

  schedule_date       date        not null,
  start_at            timestamptz not null,
  end_at              timestamptz not null,
  locked_minutes      integer     not null check (locked_minutes > 0),
  focus_minutes       integer     check (focus_minutes > 0),
  status_snapshot     text
                      check (status_snapshot in (
                        'upcoming', 'working', 'completed', 'postponed', 'missed'
                      )),
  keep_as_history     boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Time order
  constraint chk_schedule_time_order check (start_at < end_at),

  -- focus <= locked
  constraint chk_focus_lte_locked check (
    focus_minutes is null or focus_minutes <= locked_minutes
  ),

  -- locked_minutes matches wall-clock duration (within 1 min)
  constraint chk_locked_matches_duration check (
    abs(extract(epoch from (end_at - start_at)) / 60 - locked_minutes) < 2
  ),

  -- Exactly one source FK per source_type
  constraint chk_source_fk check (
    (source_type = 'activity'    and source_activity_id is not null and source_meeting_id is null and source_event_id is null) or
    (source_type = 'meeting'     and source_meeting_id  is not null and source_activity_id is null and source_event_id is null) or
    (source_type in ('appointment', 'other') and source_event_id is not null and source_activity_id is null and source_meeting_id is null)
  )
);

-- Index for daily-plan queries: all schedule instances for a user on a date
create index idx_schedule_instances_user_date
  on public.schedule_instances (user_id, schedule_date);

-- Index for overlap detection: fast range checks per user per date
create index idx_schedule_instances_time_range
  on public.schedule_instances (user_id, schedule_date, start_at, end_at);

comment on table public.schedule_instances is 'Timed slot on the daily timeline. Separate from activities to support partial scheduling and history (spec §9).';
comment on column public.schedule_instances.keep_as_history is 'Spec §10.6: past scheduled blocks remain visible even after completion.';
comment on column public.schedule_instances.focus_minutes is 'Spec §10.6: how long the user plans to focus on this activity in this block. Must be <= locked_minutes and <= activity.remaining_minutes.';
