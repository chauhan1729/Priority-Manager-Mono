-- Migration 005: year_entries
-- Spec §10.1: travel, away, birthday entries for Year at a Glance.
-- linked_project_id is nullable; travel entries can spawn a trip project.

create table if not exists public.year_entries (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references public.profiles(id) on delete cascade,
  type                    text        not null
                          check (type in ('travel', 'away', 'birthday')),
  title                   text        not null,
  start_date              date        not null,
  end_date                date,       -- null for single-day entries
  location                text,
  note                    text,
  availability_status     text
                          check (availability_status in ('available', 'away', 'partial')),
  create_linked_trip_plan boolean     not null default false,
  linked_project_id       uuid        references public.projects(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Birthday entries should not have an end_date
  constraint chk_birthday_no_end_date check (
    type != 'birthday' or end_date is null
  ),
  -- Travel/away entries must have an availability_status
  constraint chk_travel_has_availability check (
    type = 'birthday' or availability_status is not null
  )
);

comment on column public.year_entries.create_linked_trip_plan is 'Spec §10.1: when true, a linked project was or should be created for this travel entry.';
