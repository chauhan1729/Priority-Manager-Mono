-- ============================================================
-- Allow appointment / "other" event blocks to be materialized in the past.
--
-- Appointment and "other" schedule_instances are not "new" scheduling — they
-- mirror an already-existing calendar_event and are created on demand to record
-- a per-occurrence status (e.g. marking a 10:00am appointment "completed" in the
-- afternoon, or "missed" the next day). The DB-level past-time guard
-- (trg_schedule_no_past) was rejecting these inserts with
--   "Cannot create a schedule block in the past (spec §12.1)".
--
-- Activities and meetings remain blocked from past creation, per spec §12.1.
-- Idempotent: create-or-replace only redefines the function body; the existing
-- trigger trg_schedule_no_past keeps pointing at it.
-- ============================================================

create or replace function public.check_no_past_scheduling()
returns trigger language plpgsql as $$
begin
  -- Appointment / "other" instances record status for an existing calendar
  -- event, including ones whose time has already passed — allow them.
  if new.source_type in ('appointment', 'other') then
    return new;
  end if;

  if new.start_at < now() - interval '1 minute' then
    raise exception 'Cannot create a schedule block in the past (spec §12.1)'
      using errcode = 'P0002';
  end if;
  return new;
end;
$$;
