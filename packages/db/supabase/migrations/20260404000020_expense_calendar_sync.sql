-- Migration 020: link calendar_events back to their source expense
-- Spec §10.8: recurring subscriptions/renewals must be visible in Calendar.
-- Expense is the source of truth; CalendarEvent is the timed-visibility layer.
-- On expense deletion the ON DELETE CASCADE here auto-removes the linked CalendarEvent.

alter table public.calendar_events
  add column if not exists linked_expense_id uuid
    references public.expenses(id) on delete cascade;

comment on column public.calendar_events.linked_expense_id is
  'Set when source_type = ''expense_recurring''. Expense owns the recurring definition; '
  'CalendarEvent is a visibility projection. Cascades on expense delete.';

create index if not exists idx_calendar_events_expense
  on public.calendar_events (linked_expense_id)
  where linked_expense_id is not null;
