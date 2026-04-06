-- Migration 009: meetings
-- Spec §10.9: shared meeting record — created from Calendar, Meeting Planner, or Comm Planner.
-- linked_calendar_event_id FK added in migration 011 (circular dep with calendar_events).

create table if not exists public.meetings (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        not null references public.profiles(id) on delete cascade,
  linked_contact_id        uuid        not null references public.contacts(id) on delete restrict,
  -- linked_calendar_event_id FK added after calendar_events is created (migration 011)
  linked_calendar_event_id uuid,
  title                    text        not null,
  date                     date        not null,
  start_at                 timestamptz not null,
  end_at                   timestamptz not null,
  duration_minutes         integer     not null check (duration_minutes > 0),
  agenda                   text        not null default '',
  key_takeaways            text,       -- null until filled post-meeting
  recurrence_rule          text
                           check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  status                   text        not null default 'upcoming'
                           check (status in ('upcoming', 'completed', 'missed', 'cancelled')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- start must be before end
  constraint chk_meeting_time_order check (start_at < end_at),

  -- duration must agree with time range (within 1 min tolerance)
  constraint chk_meeting_duration check (
    abs(extract(epoch from (end_at - start_at)) / 60 - duration_minutes) < 2
  )
);

comment on table public.meetings is 'Single source of truth for all meetings regardless of creation origin (spec §10.9).';
comment on column public.meetings.linked_contact_id is 'Spec §10.9: one contact required for v1. on delete restrict prevents orphan meetings.';
comment on column public.meetings.key_takeaways is 'Spec §12.3: only this field is editable on past meetings.';
