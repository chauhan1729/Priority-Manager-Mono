-- Migration 004: projects
-- Spec §10.10: project container. linked_monthly_priority_id FK added
-- in migration 009 after monthly_priorities table exists (circular dep).

create table if not exists public.projects (
  id                         uuid        primary key default gen_random_uuid(),
  user_id                    uuid        not null references public.profiles(id) on delete cascade,
  name                       text        not null,
  description                text,
  status                     text        not null default 'planned'
                             check (status in ('planned', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  start_date                 date,
  target_end_date            date,
  linked_annual_goal_id      uuid        references public.annual_goals(id) on delete set null,
  -- linked_monthly_priority_id added via alter in migration 009
  linked_monthly_priority_id uuid,
  notes                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

comment on column public.projects.linked_monthly_priority_id is 'FK constraint added in migration 009 after monthly_priorities exists.';
