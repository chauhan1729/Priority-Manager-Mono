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
