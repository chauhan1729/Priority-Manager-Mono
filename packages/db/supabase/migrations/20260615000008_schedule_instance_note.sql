-- Migration: add schedule_instances.note (Phase 4 cycles — what this focus block is about).

alter table public.schedule_instances
  add column if not exists note text;

comment on column public.schedule_instances.note is
  'Optional free note for the block — e.g. what this focus cycle is about.';
