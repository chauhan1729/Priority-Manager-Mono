-- Migration 006: project_milestones + project_resources
-- Spec §10.10: secondary visibility layer (not primary progress engine in v1).

create table if not exists public.project_milestones (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  title       text        not null,
  target_date date,
  status      text        not null default 'pending'
              check (status in ('pending', 'completed', 'missed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.project_resources (
  id                   uuid        primary key default gen_random_uuid(),
  project_id           uuid        not null references public.projects(id) on delete cascade,
  resource_type        text        not null
                       check (resource_type in (
                         'budget', 'employee', 'contractor', 'new_hire',
                         'tool_software', 'equipment', 'other'
                       )),
  title                text        not null,
  note                 text,
  estimated_cost       numeric(12, 2),
  status               text        not null default 'needed'
                       check (status in (
                         'needed', 'requested', 'approved', 'acquired', 'delayed', 'cancelled'
                       )),
  assigned_contact_id  uuid        references public.contacts(id) on delete set null,
  needed_by_date       date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
