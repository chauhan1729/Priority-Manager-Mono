-- Migration: meeting buffer preference (Phase 3A).
-- Recommended minutes to keep free before a meeting (the "15 minutes to do nothing" from the
-- methodology). Used to surface a soft warning when a scheduled block ends too close to a meeting.

alter table public.reminder_preferences
  add column if not exists meeting_buffer_minutes integer not null default 15
    check (meeting_buffer_minutes between 0 and 120);

comment on column public.reminder_preferences.meeting_buffer_minutes is
  'Phase 3A: recommended free buffer before a meeting (minutes). Soft warning only, not a hard block.';
