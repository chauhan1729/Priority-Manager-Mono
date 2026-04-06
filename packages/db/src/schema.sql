-- Priority Manager — Postgres schema for Supabase
-- All tables use UUID primary keys and include RLS policies.
-- Run this in the Supabase SQL editor to initialize.

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- USERS (mirrors Supabase auth.users, extended via profiles)
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null default '',
  email        text not null,
  auth_provider text not null default 'email',
  timezone     text not null default 'UTC',
  eod_review_time time,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- YEAR ENTRIES (travel, away, birthdays)
-- ============================================================
create table if not exists public.year_entries (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  type                  text not null check (type in ('travel', 'away', 'birthday')),
  title                 text not null,
  start_date            date not null,
  end_date              date,
  location              text,
  note                  text,
  availability_status   text check (availability_status in ('available', 'away', 'partial')),
  create_linked_trip_plan boolean not null default false,
  linked_project_id     uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- ANNUAL GOALS
-- ============================================================
create table if not exists public.annual_goals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  section          text not null check (section in ('business', 'career', 'personal')),
  title            text not null,
  description      text not null default '',
  why_it_matters   text not null default '',
  target_date      date,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  status           text not null default 'not_started'
                   check (status in ('not_started', 'active', 'on_track', 'at_risk', 'completed', 'dropped')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- CONTACTS
-- ============================================================
create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  category   text not null default 'other'
             check (category in ('personal', 'professional', 'family', 'client', 'vendor', 'other')),
  full_name  text not null,
  company    text,
  role       text,
  phone      text,
  email      text,
  note       text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists public.projects (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  name                     text not null,
  description              text,
  status                   text not null default 'planned'
                           check (status in ('planned', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  start_date               date,
  target_end_date          date,
  linked_annual_goal_id    uuid references public.annual_goals(id) on delete set null,
  linked_monthly_priority_id uuid,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Add FK back from year_entries to projects
alter table public.year_entries
  add constraint fk_year_entries_project
  foreign key (linked_project_id) references public.projects(id) on delete set null;

-- ============================================================
-- PROJECT MILESTONES
-- ============================================================
create table if not exists public.project_milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null,
  target_date date,
  status      text not null default 'pending'
              check (status in ('pending', 'completed', 'missed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- PROJECT RESOURCES
-- ============================================================
create table if not exists public.project_resources (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  resource_type        text not null
                       check (resource_type in ('budget', 'employee', 'contractor', 'new_hire', 'tool_software', 'equipment', 'other')),
  title                text not null,
  note                 text,
  estimated_cost       numeric(12, 2),
  status               text not null default 'needed'
                       check (status in ('needed', 'requested', 'approved', 'acquired', 'delayed', 'cancelled')),
  assigned_contact_id  uuid references public.contacts(id) on delete set null,
  needed_by_date       date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ============================================================
-- MONTHLY PRIORITIES
-- ============================================================
create table if not exists public.monthly_priorities (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles(id) on delete cascade,
  section                   text not null check (section in ('business_career', 'personal')),
  title                     text not null,
  category                  text,
  started_date              date,
  assigned_date             date,
  target_date               date,
  linked_annual_goal_id     uuid references public.annual_goals(id) on delete set null,
  linked_project_id         uuid references public.projects(id) on delete set null,
  progress_mode             text not null default 'manual'
                            check (progress_mode in ('manual', 'auto_project')),
  manual_progress_percent   integer check (manual_progress_percent between 0 and 100),
  status                    text not null default 'planned'
                            check (status in ('planned', 'in_progress', 'on_hold', 'completed', 'dropped')),
  note                      text,
  pinned                    boolean not null default false,
  month_key                 text not null, -- e.g. '2026-04'
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Add FK from projects to monthly_priorities (circular, done after both tables exist)
alter table public.projects
  add constraint fk_projects_monthly_priority
  foreign key (linked_monthly_priority_id) references public.monthly_priorities(id) on delete set null;

-- ============================================================
-- MEETINGS
-- ============================================================
create table if not exists public.meetings (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  linked_contact_id        uuid not null references public.contacts(id) on delete restrict,
  linked_calendar_event_id uuid,
  title                    text not null,
  date                     date not null,
  start_at                 timestamptz not null,
  end_at                   timestamptz not null,
  duration_minutes         integer not null,
  agenda                   text not null default '',
  key_takeaways            text,
  recurrence_rule          text check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  status                   text not null default 'upcoming'
                           check (status in ('upcoming', 'completed', 'missed', 'cancelled')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
create table if not exists public.calendar_events (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  event_type            text not null
                        check (event_type in ('meeting', 'appointment', 'birthday', 'renewal', 'other')),
  title                 text not null,
  date                  date not null,
  start_at              timestamptz,
  end_at                timestamptz,
  duration_minutes      integer,
  linked_contact_id     uuid references public.contacts(id) on delete set null,
  linked_project_id     uuid references public.projects(id) on delete set null,
  linked_meeting_id     uuid references public.meetings(id) on delete cascade,
  linked_year_entry_id  uuid references public.year_entries(id) on delete cascade,
  location              text,
  notes                 text,
  recurrence_rule       text check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  status                text not null default 'upcoming'
                        check (status in ('upcoming', 'completed', 'cancelled', 'missed')),
  source_type           text not null default 'calendar'
                        check (source_type in ('calendar', 'meeting_planner', 'year_entry', 'expense_recurring')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Add FK from meetings to calendar_events
alter table public.meetings
  add constraint fk_meetings_calendar_event
  foreign key (linked_calendar_event_id) references public.calendar_events(id) on delete set null;

-- ============================================================
-- ACTIVITIES
-- ============================================================
create table if not exists public.activities (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  section_type          text not null
                        check (section_type in ('work', 'outside', 'delegated', 'unplanned')),
  title                 text not null,
  priority              text check (priority in ('A', 'B')),
  activity_date         date not null,
  estimated_minutes     integer not null default 0,
  remaining_minutes     integer not null default 0,
  status                text not null default 'not_started'
                        check (status in ('not_started', 'working', 'completed', 'postponed', 'delegated', 'cancelled')),
  linked_project_id     uuid references public.projects(id) on delete set null,
  delegated_contact_id  uuid references public.contacts(id) on delete set null,
  note                  text,
  origin_type           text check (origin_type in ('manual', 'project', 'carry_forward')),
  moved_from_date       date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- SCHEDULE INSTANCES
-- ============================================================
create table if not exists public.schedule_instances (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  source_type     text not null
                  check (source_type in ('activity', 'meeting', 'appointment', 'other')),
  source_id       uuid not null,
  schedule_date   date not null,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  locked_minutes  integer not null,
  focus_minutes   integer,
  status_snapshot text check (status_snapshot in ('upcoming', 'working', 'completed', 'postponed', 'missed')),
  keep_as_history boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- EXPENSES
-- ============================================================
create table if not exists public.expenses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  merchant_payee      text,
  amount              numeric(12, 2) not null,
  expense_date        date not null,
  category            text not null default 'other'
                      check (category in ('personal', 'business', 'travel', 'food', 'transport', 'subscriptions', 'household', 'other')),
  payment_method      text,
  note                text,
  linked_project_id   uuid references public.projects(id) on delete set null,
  linked_contact_id   uuid references public.contacts(id) on delete set null,
  linked_year_entry_id uuid references public.year_entries(id) on delete set null,
  recurrence_rule     text check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply trigger to all tables
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles', 'year_entries', 'annual_goals', 'contacts', 'projects',
    'project_milestones', 'project_resources', 'monthly_priorities',
    'meetings', 'calendar_events', 'activities', 'schedule_instances', 'expenses'
  ]
  loop
    execute format(
      'create or replace trigger set_updated_at
       before update on public.%I
       for each row execute function public.set_updated_at();', tbl
    );
  end loop;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Enable RLS on all tables and restrict access to the owning user.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles', 'year_entries', 'annual_goals', 'contacts', 'projects',
    'project_milestones', 'project_resources', 'monthly_priorities',
    'meetings', 'calendar_events', 'activities', 'schedule_instances', 'expenses'
  ]
  loop
    execute format('alter table public.%I enable row level security;', tbl);
  end loop;
end;
$$;

-- Profiles: user can only see and edit their own row
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id);

-- Generic user_id-based policy for all other tables
create policy "year_entries_own"        on public.year_entries        for all using (auth.uid() = user_id);
create policy "annual_goals_own"        on public.annual_goals        for all using (auth.uid() = user_id);
create policy "contacts_own"            on public.contacts            for all using (auth.uid() = user_id);
create policy "projects_own"            on public.projects            for all using (auth.uid() = user_id);
create policy "monthly_priorities_own"  on public.monthly_priorities  for all using (auth.uid() = user_id);
create policy "meetings_own"            on public.meetings            for all using (auth.uid() = user_id);
create policy "calendar_events_own"     on public.calendar_events     for all using (auth.uid() = user_id);
create policy "activities_own"          on public.activities          for all using (auth.uid() = user_id);
create policy "schedule_instances_own"  on public.schedule_instances  for all using (auth.uid() = user_id);
create policy "expenses_own"            on public.expenses            for all using (auth.uid() = user_id);

-- Sub-tables (project_milestones, project_resources) — allow if user owns the parent project
create policy "project_milestones_own" on public.project_milestones
  for all using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

create policy "project_resources_own" on public.project_resources
  for all using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );
