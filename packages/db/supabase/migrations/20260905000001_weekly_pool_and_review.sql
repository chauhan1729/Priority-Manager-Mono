-- Migration: weekly pool + weekly-review stamp.
-- Adds the middle tier of the planning horizon. Previously an activity was either parked on the
-- Someday list or committed to a specific day; a weekly item is committed to a week but not yet
-- to a day, so activity_date acts as a soft week anchor. Weekly work items are exempt from the
-- work→project requirement until they're assigned to a day (enforced in app logic).
-- Also adds the last-reviewed stamp that getSomedayReviewDue() reads, so the existing
-- weekly_someday_review reminder finally has somewhere to record completion.

alter table public.activities
  add column if not exists is_weekly boolean not null default false;

-- An activity sits in exactly one horizon tier.
alter table public.activities
  drop constraint if exists activities_single_horizon_tier;

alter table public.activities
  add constraint activities_single_horizon_tier
  check (not (is_someday and is_weekly));

create index if not exists idx_activities_user_weekly
  on public.activities (user_id, is_weekly);

comment on column public.activities.is_weekly is
  'Committed to a week but not a day; activity_date is a soft week anchor. Exempt from work→project rule until assigned to a day. Mutually exclusive with is_someday.';

alter table public.profiles
  add column if not exists last_weekly_review_date date;

comment on column public.profiles.last_weekly_review_date is
  'Date the user last completed the weekly review. Feeds getSomedayReviewDue(); null means never reviewed.';
