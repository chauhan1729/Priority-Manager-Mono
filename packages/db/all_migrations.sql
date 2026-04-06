-- Migration 001: profiles
-- Extends Supabase auth.users with app-specific fields.
-- One row per authenticated user; id matches auth.users(id).

create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  name             text        not null default '',
  email            text        not null,
  auth_provider    text        not null default 'email'
                   check (auth_provider in ('email', 'google', 'apple')),
  timezone         text        not null default 'UTC',
  eod_review_time  time,       -- user-preferred end-of-day review time, e.g. '21:00'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'App-level user profile, 1-to-1 with auth.users.';
comment on column public.profiles.eod_review_time is 'Spec §13: user-configurable end-of-day review notification time.';
-- Migration 002: annual_goals
-- Spec §10.3: 3 sections — Business, Career, Personal.
-- Manual progress; no direct FK to activities.

create table if not exists public.annual_goals (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  section          text        not null
                   check (section in ('business', 'career', 'personal')),
  title            text        not null,
  description      text        not null default '',
  why_it_matters   text        not null default '',
  target_date      date,
  progress_percent integer     not null default 0
                   check (progress_percent between 0 and 100),
  status           text        not null default 'not_started'
                   check (status in ('not_started', 'active', 'on_track', 'at_risk', 'completed', 'dropped')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.annual_goals.progress_percent is 'Spec §10.3: manual — user sets directly. No auto-calc in v1.';
-- Migration 003: contacts
-- Spec §10.7: lightweight relationship memory layer.
-- Soft-deleted via is_deleted; historical records preserved.

create table if not exists public.contacts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  category   text        not null default 'other'
             check (category in ('personal', 'professional', 'family', 'client', 'vendor', 'other')),
  full_name  text        not null,
  company    text,
  role       text,
  phone      text,
  email      text,
  note       text,        -- rolling single note per contact
  is_deleted boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.contacts.is_deleted is 'Spec §10.7: soft delete — preserve historical meeting and activity records.';
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
-- Migration 008: add FK from projects → monthly_priorities
-- Resolves circular dep: projects created without FK (migration 004),
-- monthly_priorities created (migration 007), now wire the FK.

alter table public.projects
  add constraint fk_projects_monthly_priority
  foreign key (linked_monthly_priority_id)
  references public.monthly_priorities(id)
  on delete set null;
-- Migration 009: meetings
-- Spec §10.9: shared meeting record — created from Calendar, Meeting Planner, or Comm Planner.
-- linked_calendar_event_id FK added in migration 011 (circular dep with calendar_events).

create table if not exists public.meetings (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        not null references public.profiles(id) on delete cascade,
  linked_contact_id        uuid        not null references public.contacts(id) on delete restrict,
  -- linked_calendar_event_id FK added after calendar_events is created (migration 011)
  linked_calendar_event_id uuid,
  title                    text        not null,
  date                     date        not null,
  start_at                 timestamptz not null,
  end_at                   timestamptz not null,
  duration_minutes         integer     not null check (duration_minutes > 0),
  agenda                   text        not null default '',
  key_takeaways            text,       -- null until filled post-meeting
  recurrence_rule          text
                           check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  status                   text        not null default 'upcoming'
                           check (status in ('upcoming', 'completed', 'missed', 'cancelled')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- start must be before end
  constraint chk_meeting_time_order check (start_at < end_at),

  -- duration must agree with time range (within 1 min tolerance)
  constraint chk_meeting_duration check (
    abs(extract(epoch from (end_at - start_at)) / 60 - duration_minutes) < 2
  )
);

comment on table public.meetings is 'Single source of truth for all meetings regardless of creation origin (spec §10.9).';
comment on column public.meetings.linked_contact_id is 'Spec §10.9: one contact required for v1. on delete restrict prevents orphan meetings.';
comment on column public.meetings.key_takeaways is 'Spec §12.3: only this field is editable on past meetings.';
-- Migration 010: calendar_events
-- Spec §10.2: central scheduling layer. Birthdays synced from year_entries (no duplication).
-- Meetings created here cascade-link to meetings table via linked_meeting_id.

create table if not exists public.calendar_events (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  event_type            text        not null
                        check (event_type in ('meeting', 'appointment', 'birthday', 'renewal', 'other')),
  title                 text        not null,
  date                  date        not null,
  start_at              timestamptz,
  end_at                timestamptz,
  duration_minutes      integer     check (duration_minutes > 0),
  linked_contact_id     uuid        references public.contacts(id) on delete set null,
  linked_project_id     uuid        references public.projects(id) on delete set null,
  linked_meeting_id     uuid        references public.meetings(id) on delete cascade,
  linked_year_entry_id  uuid        references public.year_entries(id) on delete cascade,
  location              text,
  notes                 text,
  recurrence_rule       text
                        check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  status                text        not null default 'upcoming'
                        check (status in ('upcoming', 'completed', 'cancelled', 'missed')),
  source_type           text        not null default 'calendar'
                        check (source_type in (
                          'calendar', 'meeting_planner', 'year_entry', 'expense_recurring'
                        )),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Time-ordered when both set
  constraint chk_event_time_order check (
    start_at is null or end_at is null or start_at < end_at
  ),

  -- Birthday events must come from year_entry source and link to a year_entry
  constraint chk_birthday_source check (
    event_type != 'birthday' or (source_type = 'year_entry' and linked_year_entry_id is not null)
  ),

  -- Meeting events must link to a meeting record
  constraint chk_meeting_linked check (
    event_type != 'meeting' or linked_meeting_id is not null
  )
);

comment on column public.calendar_events.source_type is 'Prevents duplicate creation: birthday events only created via year_entry source.';
comment on column public.calendar_events.linked_meeting_id is 'on delete cascade: removing the calendar event also removes the associated meeting record linkage.';
-- Migration 011: add FK from meetings → calendar_events
-- Resolves circular dep: meetings created without FK (migration 009),
-- calendar_events created (migration 010), now wire the FK.

alter table public.meetings
  add constraint fk_meetings_calendar_event
  foreign key (linked_calendar_event_id)
  references public.calendar_events(id)
  on delete set null;
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
-- Migration 013: schedule_instances
-- Spec §9: ScheduleInstance is separate from Activity.
-- One activity can have multiple schedule instances (partial scheduling, history).
-- Polymorphic source: can reference activity, meeting, or appointment.
--
-- Design decision: we use separate nullable FK columns rather than a single
-- source_id uuid with no FK. This gives referential integrity at the DB level.
-- A CHECK constraint ensures exactly one source FK is non-null.

create table if not exists public.schedule_instances (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  source_type         text        not null
                      check (source_type in ('activity', 'meeting', 'appointment', 'other')),

  -- Typed source FKs (exactly one must be non-null based on source_type)
  source_activity_id  uuid        references public.activities(id) on delete cascade,
  source_meeting_id   uuid        references public.meetings(id) on delete cascade,
  -- 'appointment' and 'other' source types reference calendar_events
  source_event_id     uuid        references public.calendar_events(id) on delete cascade,

  schedule_date       date        not null,
  start_at            timestamptz not null,
  end_at              timestamptz not null,
  locked_minutes      integer     not null check (locked_minutes > 0),
  focus_minutes       integer     check (focus_minutes > 0),
  status_snapshot     text
                      check (status_snapshot in (
                        'upcoming', 'working', 'completed', 'postponed', 'missed'
                      )),
  keep_as_history     boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Time order
  constraint chk_schedule_time_order check (start_at < end_at),

  -- focus <= locked
  constraint chk_focus_lte_locked check (
    focus_minutes is null or focus_minutes <= locked_minutes
  ),

  -- locked_minutes matches wall-clock duration (within 1 min)
  constraint chk_locked_matches_duration check (
    abs(extract(epoch from (end_at - start_at)) / 60 - locked_minutes) < 2
  ),

  -- Exactly one source FK per source_type
  constraint chk_source_fk check (
    (source_type = 'activity'    and source_activity_id is not null and source_meeting_id is null and source_event_id is null) or
    (source_type = 'meeting'     and source_meeting_id  is not null and source_activity_id is null and source_event_id is null) or
    (source_type in ('appointment', 'other') and source_event_id is not null and source_activity_id is null and source_meeting_id is null)
  )
);

-- Index for daily-plan queries: all schedule instances for a user on a date
create index idx_schedule_instances_user_date
  on public.schedule_instances (user_id, schedule_date);

-- Index for overlap detection: fast range checks per user per date
create index idx_schedule_instances_time_range
  on public.schedule_instances (user_id, schedule_date, start_at, end_at);

comment on table public.schedule_instances is 'Timed slot on the daily timeline. Separate from activities to support partial scheduling and history (spec §9).';
comment on column public.schedule_instances.keep_as_history is 'Spec §10.6: past scheduled blocks remain visible even after completion.';
comment on column public.schedule_instances.focus_minutes is 'Spec §10.6: how long the user plans to focus on this activity in this block. Must be <= locked_minutes and <= activity.remaining_minutes.';
-- Migration 014: expenses
-- Spec §10.8: daily expense tracker. Recurring expenses sync to calendar_events.

create table if not exists public.expenses (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references public.profiles(id) on delete cascade,
  title                text        not null,
  merchant_payee       text,
  amount               numeric(12, 2) not null check (amount >= 0),
  expense_date         date        not null,
  category             text        not null default 'other'
                       check (category in (
                         'personal', 'business', 'travel', 'food',
                         'transport', 'subscriptions', 'household', 'other'
                       )),
  payment_method       text,
  note                 text,
  linked_project_id    uuid        references public.projects(id) on delete set null,
  linked_contact_id    uuid        references public.contacts(id) on delete set null,
  linked_year_entry_id uuid        references public.year_entries(id) on delete set null,
  recurrence_rule      text
                       check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_expenses_user_date on public.expenses (user_id, expense_date);

comment on column public.expenses.recurrence_rule is 'Spec §10.8: recurring subscriptions/renewals must also create calendar_events.';
-- Migration 015: reminder_preferences + reminder_instances
-- Spec §13: user-configurable notification behavior.
-- One preferences row per user; instances generated when notifications fire.

create table if not exists public.reminder_preferences (
  id                              uuid        primary key default gen_random_uuid(),
  user_id                         uuid        not null unique references public.profiles(id) on delete cascade,
  eod_review_enabled              boolean     not null default true,
  eod_review_time                 time        not null default '21:00',
  meeting_reminder_minutes_before integer     not null default 15,
  morning_summary_enabled         boolean     not null default true,
  morning_summary_time            time        not null default '08:00',
  birthday_reminder_days_before   integer     not null default 1,
  travel_reminder_days_before     integer     not null default 1,
  renewal_reminder_days_before    integer     not null default 3,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

-- Lightweight log of fired reminders (for deduplication and audit)
create table if not exists public.reminder_instances (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  reminder_type   text        not null
                  check (reminder_type in (
                    'eod_review', 'meeting_upcoming', 'meeting_passed',
                    'renewal', 'birthday', 'travel', 'morning_summary'
                  )),
  source_id       uuid,       -- optional: meeting_id, year_entry_id, expense_id, etc.
  scheduled_for   timestamptz not null,
  fired_at        timestamptz,
  dismissed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_reminder_instances_user_scheduled
  on public.reminder_instances (user_id, scheduled_for)
  where fired_at is null;

comment on table public.reminder_preferences is 'Spec §13: one row per user, controls all notification timing preferences.';
comment on table public.reminder_instances is 'Log of generated reminders. Used to prevent duplicate firing and support dismiss tracking.';
-- Migration 016: Row Level Security policies
-- All tables are owned by the authenticated user via user_id = auth.uid().
-- Sub-tables (milestones, resources) delegate to parent project ownership.

-- Enable RLS
alter table public.profiles              enable row level security;
alter table public.annual_goals          enable row level security;
alter table public.contacts              enable row level security;
alter table public.projects              enable row level security;
alter table public.year_entries          enable row level security;
alter table public.project_milestones    enable row level security;
alter table public.project_resources     enable row level security;
alter table public.monthly_priorities    enable row level security;
alter table public.meetings              enable row level security;
alter table public.calendar_events       enable row level security;
alter table public.activities            enable row level security;
alter table public.schedule_instances    enable row level security;
alter table public.expenses              enable row level security;
alter table public.reminder_preferences  enable row level security;
alter table public.reminder_instances    enable row level security;

-- profiles: own row only
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- User-owned tables: standard user_id check
create policy "annual_goals_own"         on public.annual_goals         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "contacts_own"             on public.contacts             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_own"             on public.projects             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "year_entries_own"         on public.year_entries         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "monthly_priorities_own"   on public.monthly_priorities   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meetings_own"             on public.meetings             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calendar_events_own"      on public.calendar_events      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "activities_own"           on public.activities           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "schedule_instances_own"   on public.schedule_instances   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expenses_own"             on public.expenses             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reminder_preferences_own" on public.reminder_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reminder_instances_own"   on public.reminder_instances   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sub-tables: access delegated to parent project ownership
create policy "project_milestones_own" on public.project_milestones
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_milestones.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "project_resources_own" on public.project_resources
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_resources.project_id
        and p.user_id = auth.uid()
    )
  );
-- Migration 017: triggers and utility functions

-- ============================================================
-- updated_at auto-maintenance
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql security definer as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to all tables with updated_at
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles', 'annual_goals', 'contacts', 'projects', 'year_entries',
    'project_milestones', 'project_resources', 'monthly_priorities',
    'meetings', 'calendar_events', 'activities', 'schedule_instances',
    'expenses', 'reminder_preferences'
  ] loop
    execute format(
      'create or replace trigger trg_%I_updated_at
       before update on public.%I
       for each row execute function public.set_updated_at();',
      tbl, tbl
    );
  end loop;
end;
$$;

-- ============================================================
-- Auto-create profile on auth.users insert
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, auth_provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'provider', 'email')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Auto-create reminder_preferences for new profiles
-- ============================================================
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.reminder_preferences (user_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create or replace trigger trg_on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- ============================================================
-- Enforce A-priority cap at DB level (soft guard — domain layer is primary)
-- Raises a warning log but does not hard-block (UI blocks first).
-- Hard constraint is: max 3 A priorities per user per date.
-- ============================================================
create or replace function public.check_a_priority_cap()
returns trigger language plpgsql as $$
declare
  a_count integer;
begin
  if new.priority = 'A' then
    select count(*) into a_count
    from public.activities
    where user_id = new.user_id
      and activity_date = new.activity_date
      and priority = 'A'
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and status not in ('cancelled', 'postponed');

    if a_count >= 3 then
      raise exception 'A-priority cap exceeded: max 3 A-priority activities per day (spec §10.5)'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger trg_activities_a_priority_cap
  before insert or update of priority on public.activities
  for each row execute function public.check_a_priority_cap();

-- ============================================================
-- Prevent scheduling in the past (DB-level guard)
-- Primary enforcement is in the domain layer / middleware.
-- ============================================================
create or replace function public.check_no_past_scheduling()
returns trigger language plpgsql as $$
begin
  if new.start_at < now() - interval '1 minute' then
    raise exception 'Cannot create a schedule block in the past (spec §12.1)'
      using errcode = 'P0002';
  end if;
  return new;
end;
$$;

-- Only fires on INSERT (allow updates to existing past blocks for editing/history)
create or replace trigger trg_schedule_no_past
  before insert on public.schedule_instances
  for each row execute function public.check_no_past_scheduling();
-- Migration 018: additional composite indexes for common query patterns

-- Annual goals by section (Annual Strategies page loads by section)
create index idx_annual_goals_user_section
  on public.annual_goals (user_id, section, status);

-- Monthly priorities by month_key (default view = current month)
create index idx_monthly_priorities_user_month
  on public.monthly_priorities (user_id, month_key, section);

-- Calendar events by date range (month grid)
create index idx_calendar_events_user_date
  on public.calendar_events (user_id, date);

-- Meetings by date (upcoming meetings, meeting planner view)
create index idx_meetings_user_date
  on public.meetings (user_id, date, status);

-- Meetings by contact (Communication Planner: last 3 meetings per contact)
create index idx_meetings_contact
  on public.meetings (linked_contact_id, date desc);

-- Projects by status (Project Planner filter)
create index idx_projects_user_status
  on public.projects (user_id, status);

-- Contacts: active contacts only (soft-delete filter)
create index idx_contacts_active
  on public.contacts (user_id, full_name)
  where is_deleted = false;

-- Expenses by date (daily/weekly/monthly summaries)
create index idx_expenses_user_date
  on public.expenses (user_id, expense_date desc);

-- Reminder instances: unfired reminders (background job poll)
create index idx_reminder_instances_unfired
  on public.reminder_instances (user_id, scheduled_for)
  where fired_at is null and dismissed_at is null;
