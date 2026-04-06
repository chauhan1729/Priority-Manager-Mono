-- Migration 010: calendar_events
-- Spec §10.2: central scheduling layer. Birthdays synced from year_entries (no duplication).
-- Meetings created here cascade-link to meetings table via linked_meeting_id.

create table if not exists public.calendar_events (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  event_type            text        not null
                        check (event_type in ('meeting', 'appointment', 'birthday', 'renewal', 'other')),
  title                 text        not null,
  date                  date        not null,
  start_at              timestamptz,
  end_at                timestamptz,
  duration_minutes      integer     check (duration_minutes > 0),
  linked_contact_id     uuid        references public.contacts(id) on delete set null,
  linked_project_id     uuid        references public.projects(id) on delete set null,
  linked_meeting_id     uuid        references public.meetings(id) on delete cascade,
  linked_year_entry_id  uuid        references public.year_entries(id) on delete cascade,
  location              text,
  notes                 text,
  recurrence_rule       text
                        check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  status                text        not null default 'upcoming'
                        check (status in ('upcoming', 'completed', 'cancelled', 'missed')),
  source_type           text        not null default 'calendar'
                        check (source_type in (
                          'calendar', 'meeting_planner', 'year_entry', 'expense_recurring'
                        )),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Time-ordered when both set
  constraint chk_event_time_order check (
    start_at is null or end_at is null or start_at < end_at
  ),

  -- Birthday events must come from year_entry source and link to a year_entry
  constraint chk_birthday_source check (
    event_type != 'birthday' or (source_type = 'year_entry' and linked_year_entry_id is not null)
  ),

  -- Meeting events must link to a meeting record
  constraint chk_meeting_linked check (
    event_type != 'meeting' or linked_meeting_id is not null
  )
);

comment on column public.calendar_events.source_type is 'Prevents duplicate creation: birthday events only created via year_entry source.';
comment on column public.calendar_events.linked_meeting_id is 'on delete cascade: removing the calendar event also removes the associated meeting record linkage.';
