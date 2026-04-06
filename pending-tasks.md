# Authentication
**Google OAuth**: Supabase Dashboard → Auth → Providers → Google → paste Client ID + Secret
**Apple OAuth**: Supabase Dashboard → Auth → Providers → Apple → configure (requires Apple Developer account + HTTPS domain)

# Project Planner
**estimated_cost precision** — returned from Supabase as a JS number (from numeric(12,2)); toLocaleString() will show it correctly, but insertion doesn't enforce currency rounding — could add Zod refinement later
**Activity section constraint on edit** — if someone edits an activity via Activities tab and removes the linked_project_id, the project won't know; progress metrics will silently drop. Needs a shared edit form with guard in a future pass.
**Delegated activities** — excluded from the in-project activity form (needs contact picker from Communication Planner, not yet built)
**No pagination** — large activity lists load entirely; add limit+cursor when counts grow

# Activities
**Carry-forward from page that isn't "today"**: the panel fetches previousDate relative to selectedDate, so navigating to a past date shows that date's prior day — could confuse users, but is correct behavior
**No pagination**: fetches all activities for a date. Fine for a personal app; worth revisiting if someone accumulates 100+ activities per day
**Postpone target is always +1 day from selectedDate** — the spec mentions "move to date" as a future option; the edit modal's date field serves that purpose for now
**remaining_minutes sync**: on edit, remaining is reset to new estimated value. Once scheduling (ScheduleInstance) is built, this logic needs to account for already-scheduled minutes
**Delegated activity creation**: fully blocked until Communication Planner is built.
**Amount of hours worked**: add this field to the activity table. It should be a number and should be used to calculate the progress of the activity. 

# Daily Plan
**Remaining time**: When a user schedule an activity for a certain time, it should be added to the timeline. And the amount of time the user kept it scheduled should be added to the activity's amount of hours worked. 
