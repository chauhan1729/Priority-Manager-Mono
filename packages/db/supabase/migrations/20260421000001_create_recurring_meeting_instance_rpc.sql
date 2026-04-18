-- Migration: RPC to atomically action a single occurrence of a recurring meeting.
--
-- Problem (risk 1, previous session): the client used to do two separate writes —
--   1. insert a one-time meeting record for the occurrence,
--   2. update the recurring template's date/start_at/end_at to the next occurrence.
-- If the network dropped between 1 and 2, state could drift (duplicate rows, lost
-- takeaways, series silently double-advanced).
--
-- @supabase/supabase-js has no transaction API. A plpgsql function body runs inside
-- an implicit transaction, so wrapping both statements here gives atomicity — either
-- both succeed, or neither does.
--
-- SECURITY INVOKER is intentional: the caller's RLS still applies, so a user can
-- only action their own meetings. We also guard user_id = auth.uid() in every write
-- as defence-in-depth.

create or replace function public.create_recurring_meeting_instance(
  p_recurring_id         uuid,
  p_occurrence_date      date,
  p_occurrence_start_at  timestamptz,
  p_occurrence_end_at    timestamptz,
  p_status               text,
  p_archived             boolean default false,
  p_key_takeaways        text    default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template       meetings%rowtype;
  v_next_date      date;
  v_days_diff      integer;
  v_next_start     timestamptz;
  v_next_end       timestamptz;
  v_duration_ms    bigint;
begin
  -- Validate status up front (mirrors the check constraint)
  if p_status not in ('upcoming', 'completed', 'missed', 'cancelled') then
    raise exception 'invalid meeting status: %', p_status
      using errcode = '22023';
  end if;

  -- Load the template row under RLS — returns 0 rows if not owned by caller.
  select * into v_template
  from public.meetings
  where id = p_recurring_id
    and user_id = auth.uid();

  if not found then
    raise exception 'recurring meeting % not found', p_recurring_id
      using errcode = 'P0002';
  end if;

  if v_template.recurrence_rule is null then
    raise exception 'meeting % is not a recurring series', p_recurring_id
      using errcode = 'P0001';
  end if;

  -- 1. Insert one-time occurrence record (no recurrence_rule)
  insert into public.meetings (
    user_id,
    linked_contact_id,
    linked_calendar_event_id,
    title,
    date,
    start_at,
    end_at,
    duration_minutes,
    agenda,
    key_takeaways,
    recurrence_rule,
    status,
    archived
  ) values (
    v_template.user_id,
    v_template.linked_contact_id,
    null,
    v_template.title,
    p_occurrence_date,
    p_occurrence_start_at,
    p_occurrence_end_at,
    v_template.duration_minutes,
    v_template.agenda,
    p_key_takeaways,
    null,
    p_status,
    p_archived
  );

  -- 2. Advance template to the next occurrence
  v_next_date := case v_template.recurrence_rule
    when 'daily'   then p_occurrence_date + interval '1 day'
    when 'weekly'  then p_occurrence_date + interval '7 days'
    when 'monthly' then (p_occurrence_date + interval '1 month')::date
  end;

  v_days_diff   := v_next_date - p_occurrence_date;
  v_duration_ms := extract(epoch from (p_occurrence_end_at - p_occurrence_start_at))::bigint * 1000;
  v_next_start  := p_occurrence_start_at + make_interval(days => v_days_diff);
  v_next_end    := v_next_start + (p_occurrence_end_at - p_occurrence_start_at);

  update public.meetings
     set date     = v_next_date,
         start_at = v_next_start,
         end_at   = v_next_end
   where id      = p_recurring_id
     and user_id = auth.uid();

  -- 3. Sync the linked calendar event if present
  if v_template.linked_calendar_event_id is not null then
    update public.calendar_events
       set date     = v_next_date,
           start_at = v_next_start,
           end_at   = v_next_end
     where id      = v_template.linked_calendar_event_id
       and user_id = auth.uid();
  end if;
end;
$$;

comment on function public.create_recurring_meeting_instance is
  'Atomic: inserts a one-time meeting for the occurrence and advances the recurring template to the next date. Replaces a non-atomic two-step client flow (see risk 1 notes).';

grant execute on function public.create_recurring_meeting_instance(
  uuid, date, timestamptz, timestamptz, text, boolean, text
) to authenticated;
