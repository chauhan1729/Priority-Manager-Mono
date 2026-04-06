-- Migration 012: activities
-- Spec §10.5 + §9: THE shared activity model used by Activities tab,
-- Daily Plan, and Project Planner. One record, referenced everywhere.
--
-- Design decision: remaining_minutes is stored (not computed) for performance.
-- The application updates remaining_minutes when schedule_instances are created/modified.
-- An alternative (computed from estimated - sum(scheduled)) would require
-- expensive joins on every activities query.

create table if not exists public.activities (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  section_type          text        not null
                        check (section_type in ('work', 'outside', 'delegated', 'unplanned')),
  title                 text        not null,
  priority              text
                        check (priority in ('A', 'B')),
  activity_date         date        not null,
  estimated_minutes     integer     not null default 0 check (estimated_minutes >= 0),
  remaining_minutes     integer     not null default 0 check (remaining_minutes >= 0),
  status                text        not null default 'not_started'
                        check (status in (
                          'not_started', 'working', 'completed',
                          'postponed', 'delegated', 'cancelled'
                        )),
  linked_project_id     uuid        references public.projects(id) on delete set null,
  delegated_contact_id  uuid        references public.contacts(id) on delete set null,
  note                  text,
  origin_type           text
                        check (origin_type in ('manual', 'project', 'carry_forward')),
  moved_from_date       date,       -- set when activity is carried forward
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- remaining can't exceed estimated
  constraint chk_remaining_lte_estimated check (remaining_minutes <= estimated_minutes),

  -- Work activities must link to a project (spec §10.5)
  constraint chk_work_needs_project check (
    section_type != 'work' or linked_project_id is not null
  ),

  -- Delegated activities must have a delegated contact
  constraint chk_delegated_needs_contact check (
    section_type != 'delegated' or delegated_contact_id is not null
  )
);

-- Index for common query: activities for a specific user on a specific date
create index idx_activities_user_date on public.activities (user_id, activity_date);

-- Index for project-linked activities (syncing project progress)
create index idx_activities_project on public.activities (linked_project_id) where linked_project_id is not null;

comment on table public.activities is 'Single shared activity record used by Activities tab, Daily Plan, and Project Planner (spec §9).';
comment on column public.activities.remaining_minutes is 'Stored for perf. App must update when schedule_instances are created/completed/deleted.';
comment on column public.activities.moved_from_date is 'Original activity_date before carry-forward. Enables move history (spec §10.5).';
