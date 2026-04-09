-- Migration: add hours_worked, archived, and recurrence_rule columns to activities.
-- hours_worked   — cumulative minutes logged from completed schedule blocks.
-- archived       — soft-hide completed/cancelled activities without deleting them.
-- recurrence_rule — optional repeating pattern for recurring activities.

alter table public.activities
  add column if not exists hours_worked    integer not null default 0 check (hours_worked >= 0),
  add column if not exists archived        boolean not null default false,
  add column if not exists recurrence_rule text    check (recurrence_rule in ('daily', 'weekly', 'monthly'));

comment on column public.activities.hours_worked    is 'Cumulative minutes credited from completed schedule blocks.';
comment on column public.activities.archived        is 'Soft-hide flag; set to true instead of deleting completed/cancelled activities.';
comment on column public.activities.recurrence_rule is 'Optional recurrence: daily | weekly | monthly. When set, sibling copies are created at activity-creation time.';
