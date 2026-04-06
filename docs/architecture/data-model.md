# Data Model — Architecture Reference

## Overview

Priority Manager uses a relational Postgres schema hosted on Supabase.
The schema is designed around one core principle from the spec:

> **One source of truth per object** — no duplicate records across tabs.

All features display shared data, not disconnected copies.

---

## Entity Relationship Summary

```
profiles
  ├── annual_goals
  ├── contacts
  ├── projects ──────────────────────────────► annual_goals (optional)
  │     ├── project_milestones               ► monthly_priorities (optional, circular resolved via ALTER)
  │     └── project_resources ─────────────► contacts (optional)
  ├── year_entries ──────────────────────────► projects (optional — linked trip plan)
  ├── monthly_priorities ────────────────────► annual_goals (optional)
  │                                          ► projects (optional)
  ├── meetings ──────────────────────────────► contacts (required)
  │                                          ► calendar_events (optional, circular resolved via ALTER)
  ├── calendar_events ───────────────────────► meetings (optional, cascade delete)
  │                                          ► year_entries (optional, cascade delete — birthdays)
  │                                          ► contacts (optional)
  │                                          ► projects (optional)
  ├── activities ────────────────────────────► projects (optional, required for work section)
  │                                          ► contacts (optional, required for delegated section)
  ├── schedule_instances ────────────────────► activities (typed FK, cascade delete)
  │                                          ► meetings (typed FK, cascade delete)
  │                                          ► calendar_events (typed FK, cascade delete)
  ├── expenses ──────────────────────────────► projects (optional)
  │                                          ► contacts (optional)
  │                                          ► year_entries (optional)
  ├── reminder_preferences (1:1)
  └── reminder_instances
```

---

## Table-by-Table Notes

### profiles
- 1:1 extension of `auth.users`
- Auto-created via `handle_new_user()` trigger on `auth.users` insert
- `eod_review_time` stored as Postgres `time` type — used by notification scheduler

### annual_goals
- Manual `progress_percent` only (no auto-calc in v1)
- 3 sections: `business`, `career`, `personal`
- No direct FK to activities — only linked through projects

### contacts
- Soft-deleted via `is_deleted = false`
- Historical meeting + activity records survive contact deletion
- `on delete restrict` on `meetings.linked_contact_id` prevents orphan meetings

### projects
- **Circular FK with monthly_priorities**: created first without the FK, added via `ALTER TABLE` in migration 008
- `status` drives carry-forward eligibility checks in domain layer
- Progress computed at query time: `completed activity hours / total estimated hours`

### year_entries
- `birthday` entries are single-day (enforced by CHECK + Zod)
- `travel`/`away` entries require `availability_status`
- `create_linked_trip_plan` signals the UI to create a linked project; `linked_project_id` is set when created
- Birthday entries must not be created directly in `calendar_events` — only synced from here

### calendar_events
- **One source of truth for the calendar view**
- `source_type` prevents duplicate creation:
  - `birthday` events only from `year_entry` source
  - `meeting` events must have `linked_meeting_id`
  - `expense_recurring` events from expense recurrence
- **Circular FK with meetings**: `calendar_events.linked_meeting_id → meetings` and `meetings.linked_calendar_event_id → calendar_events`. Resolved: `meetings` table created first (no FK), then `calendar_events` with `linked_meeting_id` FK, then `ALTER TABLE meetings` adds the reverse FK in migration 011

### meetings
- Shared record regardless of creation origin (Calendar, Meeting Planner, Communication Planner)
- `linked_contact_id` is `NOT NULL` + `on delete restrict` — meetings cannot become contactless
- `key_takeaways` is the only editable field for past meetings (enforced in domain layer)
- `duration_minutes` must agree with `end_at - start_at` (DB CHECK + Zod validation)

### activities
- **Shared model used by Activities tab, Daily Plan, and Project Planner**
- `remaining_minutes` is stored (not computed). Application updates it when schedule_instances are created/modified. Trade-off: slight denormalization for query perf
- `work` section requires `linked_project_id` (DB CHECK constraint)
- `delegated` section requires `delegated_contact_id` (DB CHECK constraint)
- `moved_from_date` tracks carry-forward history (original date preserved)

### schedule_instances
- Separate from `Activity` — one activity can have many schedule instances (partial scheduling, history)
- **Polymorphic source** resolved with typed FK columns + CHECK constraint:
  - `source_activity_id` when `source_type = 'activity'`
  - `source_meeting_id` when `source_type = 'meeting'`
  - `source_event_id` when `source_type = 'appointment' | 'other'`
- `keep_as_history = true` (default): past blocks remain visible on Daily Plan as historical record
- `focus_minutes ≤ locked_minutes` enforced by CHECK + Zod
- DB trigger prevents INSERT with `start_at` in the past (application layer also checks)

### expenses
- Recurring expenses (`recurrence_rule` set) should also create `calendar_events` with `source_type = 'expense_recurring'`. This is orchestrated at the API layer.
- No computed columns; totals (today/week/month) computed at query time

### reminder_preferences
- 1:1 with profile; auto-created by `handle_new_profile()` trigger
- Notification scheduling (firing reminder_instances) is handled by a Supabase Edge Function cron job

---

## Circular Dependency Resolution

Two circular FK pairs exist and are resolved by deferred `ALTER TABLE`:

| Pair | Resolution |
|---|---|
| `projects ↔ monthly_priorities` | `projects` created without FK in M004, `monthly_priorities` created in M007, FK added via `ALTER TABLE` in M008 |
| `meetings ↔ calendar_events` | `meetings` created without FK in M009, `calendar_events` created in M010, FK added via `ALTER TABLE` in M011 |

---

## Key Invariants (tested in `@pm/domain`)

| Rule | Source | Enforced in |
|---|---|---|
| No new activities in the past | Spec §12.1 | Domain `canCreateActivityOnDate`, DB trigger |
| No new schedule blocks in the past | Spec §12.1 | Domain `canScheduleAt`, DB trigger |
| No new meetings in the past | Spec §12.1 | Domain `canCreateMeetingAt` |
| Max 3 A-priority activities per day | Spec §10.5 | Domain `canAddAPriority`, DB trigger |
| Work activities require linked project | Spec §10.5 | DB CHECK, Zod schema |
| Delegated activities require contact | Spec §10.5 | DB CHECK, Zod schema |
| Past meetings: only takeaways editable | Spec §12.3 | Domain `getMeetingEditableFields` |
| Monthly priorities: max 5 per section | Spec §10.4 | Domain `canAddPriority` (not DB) |
| Carry-forward requires linked project | Spec §10.4 | Domain `isEligibleForCarryForward` |
| Birthday = year_entry source only | Spec §11.2 | DB CHECK, Zod schema |
| Meeting event must link to meeting record | Spec §11.1 | DB CHECK, Zod schema |
| focus_minutes ≤ locked_minutes | Spec §10.6 | DB CHECK, Zod schema, domain |
| Schedule overlap prevention | Spec §10.6 | Domain `checkScheduleOverlap` |
| remaining_minutes ≤ estimated_minutes | Spec §10.5 | DB CHECK, Zod schema |

---

## Ambiguous Decisions Made

These required a judgment call. Document here in case requirements change.

### 1. `remaining_minutes` stored vs computed
**Decision**: stored.
**Reason**: Computing it at query time requires `SUM(schedule_instances.locked_minutes)` joined on every activities query — expensive on the daily plan. Stored value is updated by the API layer when schedule instances are created/completed/deleted.
**Risk**: can drift if a schedule instance is deleted without updating the activity. Add server-side function for recalculation if this becomes an issue.

### 2. Polymorphic `schedule_instances.source_id`
**Decision**: use three nullable FK columns (`source_activity_id`, `source_meeting_id`, `source_event_id`) + CHECK constraint.
**Reason**: Single `source_id UUID` with no FK sacrifices referential integrity. Three typed columns give FK cascade deletes and type-safe queries.
**Alternative rejected**: a joining table. Too complex for v1.

### 3. `activities` A-priority cap enforcement
**Decision**: DB trigger (hard block) + domain layer (pre-validation).
**Reason**: Domain layer catches it before the network call; DB trigger is the safety net for direct DB writes. Double enforcement is intentional.
**Risk**: DB trigger raises an exception with custom error code `P0001` — API layer must catch and surface this to the user.

### 4. Monthly priority carry-forward — requires linked project
**Decision**: `isEligibleForCarryForward` returns false when `linked_project_id` is null, even if status is `in_progress`.
**Reason**: Spec §10.4 says carry-forward is only allowed "if linked project is still in progress". Without a linked project, there is no project to check. In practice, the UI should guide users to link a project before carrying forward.

### 5. `progress_mode = auto_project` — progress computed at query time
**Decision**: do not store `effective_progress_percent`. Compute it when fetching the priority.
**Reason**: Storing it would require re-computing on every activity update. Computed-at-query-time keeps data consistent without background jobs.

### 6. `ReminderPreference` vs notification service
**Decision**: `reminder_preferences` table + `reminder_instances` log, fired by an Edge Function cron.
**Reason**: Spec §13 says "can be modeled either as user settings plus generated reminders, or using your chosen notification service directly." User settings + Edge Function keeps it self-contained within Supabase for v1.

---

## Migration Order

```
001 profiles
002 annual_goals
003 contacts
004 projects                     (no monthly_priority FK yet)
005 year_entries
006 project_milestones + project_resources
007 monthly_priorities
008 ALTER projects → monthly_priorities FK
009 meetings                     (no calendar_event FK yet)
010 calendar_events
011 ALTER meetings → calendar_events FK
012 activities
013 schedule_instances
014 expenses
015 reminder_preferences + reminder_instances
016 RLS policies
017 triggers + functions
018 indexes
```

---

## Running Migrations

```bash
# Prerequisite: Supabase CLI installed and project linked
supabase link --project-ref <your-project-ref>

# Apply all migrations
supabase db push

# Or run against local Supabase
supabase start
supabase db reset   # applies all migrations from scratch
```

Alternatively, paste the contents of `packages/db/supabase/migrations/` files
in order into the Supabase Dashboard SQL Editor.
