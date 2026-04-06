-- Migration 007: monthly_priorities
-- Spec §10.4: 2 sections, 3–5 items per section, carry-forward logic.
-- Limit enforcement is in the domain layer, not a DB constraint (to allow graceful errors).

create table if not exists public.monthly_priorities (
  id                        uuid        primary key default gen_random_uuid(),
  user_id                   uuid        not null references public.profiles(id) on delete cascade,
  section                   text        not null
                            check (section in ('business_career', 'personal')),
  title                     text        not null,
  category                  text,
  started_date              date,
  assigned_date             date,
  target_date               date,
  linked_annual_goal_id     uuid        references public.annual_goals(id) on delete set null,
  linked_project_id         uuid        references public.projects(id) on delete set null,
  progress_mode             text        not null default 'manual'
                            check (progress_mode in ('manual', 'auto_project')),
  manual_progress_percent   integer
                            check (manual_progress_percent between 0 and 100),
  status                    text        not null default 'planned'
                            check (status in ('planned', 'in_progress', 'on_hold', 'completed', 'dropped')),
  note                      text,
  pinned                    boolean     not null default false,
  month_key                 text        not null, -- 'YYYY-MM', e.g. '2026-04'
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Enforce month_key format
  constraint chk_month_key_format check (month_key ~ '^\d{4}-\d{2}$'),

  -- auto_project mode requires a linked project
  constraint chk_auto_progress_needs_project check (
    progress_mode != 'auto_project' or linked_project_id is not null
  )
);

comment on column public.monthly_priorities.progress_mode is 'auto_project: effective progress computed from linked project hours at query time. manual: stored in manual_progress_percent.';
comment on column public.monthly_priorities.month_key is 'ISO month string YYYY-MM. Used to group priorities by month without timezone issues.';
