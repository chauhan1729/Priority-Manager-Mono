-- Migration: add activities.is_someday (Phase 1B — 30-day horizon + Someday list).
-- A someday item is parked outside the rolling 30-day planning horizon and reviewed weekly
-- (the "Kevin list" in the FOTW methodology). Someday work items are exempt from the
-- work→project requirement until pulled into the horizon (enforced in app logic).

alter table public.activities
  add column if not exists is_someday boolean not null default false;

create index if not exists idx_activities_user_someday
  on public.activities (user_id, is_someday);

comment on column public.activities.is_someday is
  'Phase 1B: parked outside the 30-day horizon (someday list, reviewed weekly). Exempt from work→project rule until pulled in.';
