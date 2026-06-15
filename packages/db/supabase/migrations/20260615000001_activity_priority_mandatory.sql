-- Migration: make activities.priority mandatory (Phase 0A — priority-first restructure).
-- The Priority Manager methodology treats every task as either an A or a B ("everything is a B").
-- So priority is no longer nullable: existing nulls are backfilled to 'B', then the column is
-- constrained NOT NULL with a default of 'B'. New activities land on the A or B screen unconditionally.
--
-- Order matters: backfill must run BEFORE the NOT NULL constraint is added.

-- 1. Backfill any unprioritized activities to 'B' (the default, low-stress bucket).
update public.activities
  set priority = 'B'
  where priority is null;

-- 2. Enforce mandatory priority going forward.
alter table public.activities
  alter column priority set default 'B',
  alter column priority set not null;

comment on column public.activities.priority is
  'Mandatory A|B priority (Phase 0A). Default B — most tasks are B. A is the must-do-today bucket, capped softly at 3/day.';
