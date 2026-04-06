-- Migration 011: add FK from meetings → calendar_events
-- Resolves circular dep: meetings created without FK (migration 009),
-- calendar_events created (migration 010), now wire the FK.

alter table public.meetings
  add constraint fk_meetings_calendar_event
  foreign key (linked_calendar_event_id)
  references public.calendar_events(id)
  on delete set null;
