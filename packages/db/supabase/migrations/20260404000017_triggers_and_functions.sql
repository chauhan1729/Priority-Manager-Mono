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
