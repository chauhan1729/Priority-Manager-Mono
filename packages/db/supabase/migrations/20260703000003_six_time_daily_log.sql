-- Phase 6: collapse the Six-Time Book to a ONCE-a-day log.
-- No history preservation — existing per-slot entries are wiped and the schema switches
-- from six daily slots to a single entry per focus problem per day.

-- 1. Entries: drop the 6-slot model. Wipe old rows (no history kept), then re-key by problem.
delete from public.six_time_entries;

alter table public.six_time_entries drop constraint if exists uq_six_time_entry;
alter table public.six_time_entries drop column if exists slot_index;
alter table public.six_time_entries
  add constraint uq_six_time_entry unique (user_id, entry_date, problem_id);

comment on table public.six_time_entries is
  'Phase 6: one daily log entry (+/−/to-do) per focus problem per day.';

-- 2. Config: a single daily-log time replaces the six slot times.
alter table public.six_time_config drop constraint if exists chk_six_time_slot_count;
alter table public.six_time_config drop column if exists slot_times;
alter table public.six_time_config
  add column if not exists daily_log_time text not null default '21:00';

-- 3. Reminder type: 'six_time_slot' → 'six_time_daily'. Rebuild the full CHECK list.
alter table public.reminder_instances drop constraint if exists reminder_instances_reminder_type_check;
alter table public.reminder_instances
  add constraint reminder_instances_reminder_type_check
  check (reminder_type in (
    'eod_review', 'meeting_upcoming', 'meeting_passed',
    'renewal', 'birthday', 'travel', 'morning_summary',
    'activity_starting', 'activity_overdue', 'event_upcoming',
    'weekly_someday_review', 'meeting_prep',
    'six_time_daily', 'six_time_nightly', 'giving_daily',
    'activity_due_today', 'activity_past_due'
  ));
