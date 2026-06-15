# Implementation Plan — Aligning the App with the "Fly On The Wall" Methodology

**Source:** `Fly On The Wall - Danielle.pdf` (Feb 5, 2026) — a first-hand account of how the paper
"Priority Manager" system is actually *used*. This plan closes the gap between the app's strong
structural foundation and the **behavioral mechanics** the document treats as the core of the system.

**Scope decisions (locked with product owner):**
- **Web UI only.** No mobile UI in this effort. Shared `types` / `db` schema / `domain` logic are written
  platform-agnostic so the Expo app can adopt them later, but no `apps/mobile` screens are built now.
- **Voice quick-capture is dropped** (was Phase 3C).
- Cycles are **completion-driven, not clock-bound** (see Phase 1A — this is what the document recommends).
- Someday items **may be project-less** (refinement exception).
- 30-day horizon = **soft visual emphasis + a default filter toggle**.
- **Priority is the primary axis** (Phase 0): Activities splits into **two nav screens — A Activities and
  B Activities**. Priority becomes **mandatory, default `B`** (existing `null` backfilled → `B`).
- **Daily Plan schedules A only** (+ meetings/appointments). A B reaches the timeline only by being
  **promoted to A**, and that path unlocks once all of the day's A's are **completed/resolved**.
- **3-A/day cap becomes a soft, override-able warning** (was a hard block). Escalating nudge: hint at 2nd–3rd
  A, stronger warning + override at 4th+.
- **Screen rationalization** (Phase 0B): trim/merge modules the methodology doesn't exercise — pending the
  goals-pillar decision (see Open decisions).

**Architectural constraints honored throughout (CLAUDE.md):**
- One activity source of truth shared by Activities / Daily Plan / Project Planner.
- All timed scheduling goes through `ScheduleInstance`. No duplicate records.
- New records cannot be created in the past; past records stay visible & read-only (except meeting takeaways).
- Schema-first: every change flows `types → Zod schema → DB migration → domain logic → tests → web UI`.
- Light mode, notebook visual language, mobile responsive (web), handwritten font for accents only.

---

## Priority ranking (by centrality in the document)

| # | Feature | Doc emphasis | Current status | Phase |
|---|---------|--------------|----------------|-------|
| 0 | **Priority-first restructure** (A/B screens, Daily Plan schedules A only, soft A-cap) | Core — A/B is the whole system | Partial | 0 |
| 0 | **Screen rationalization** (cut/merge off-methodology modules) | Lean to the system | n/a | 0 |
| 1 | **Work Cycles** (focus session + complete/next cycle + mini-breaks) | Highest — repeated p.4–16 | Missing | 1 |
| 2 | **30-day horizon + Someday list** ("Kevin list", reviewed weekly) | High — p.4, p.15 | Missing | 1 |
| 3 | **Intentional B re-dating** to a chosen future day (not push-to-tomorrow) | High — p.5 | Partial | 2 |
| 4 | **Meeting prep reminder** one day before | Medium — p.18 | Missing | 2 |
| 5 | **15-minute meeting buffer** | Medium — p.2, p.17 | Missing | 3 |
| 6 | **Self-appointment** recurring commitments (≠ A task) | Medium — p.23 | Partial | 3 |
| 7 | **Six-Time Book (tundruk)** — guilt-free mental-seed tracking | New feature (owner) | Missing | 4 |
| 8 | **Giving (90-Day Karma Scorecard)** — give-daily + keep score | New feature (owner) | Missing | 5 |

Phases are independently shippable. Recommend building Phase 1 first (highest value, self-contained).
Voice quick-capture (pocket recorder) is intentionally out of scope for this effort.

## Cross-source validation (11 testimonials at kevintrudeaufanclub.com)

Concrete numbers corroborated across multiple first-hand accounts beyond the single PDF:

- **Cycles are completion-driven, variable length** — *"sometimes only a few minutes, sometimes longer"*;
  a cycle = *"a quick task, a call, a meeting, or a focused block."* (~15 cycles in a few hours ≈ 10–20 min
  typical; one 90-min block observed.) → confirms count-up, no fixed pomodoro.
- **~20-minute energy-change cadence** — *"Every 20 minutes, I change my energy (get up, move around, or
  change tasks)."* A movement/energy rhythm, distinct from cycle completion. → Phase 1A optional nudge.
- **Cycle protection** — *"when Kevin is in a cycle nothing and no one can or should interrupt him."*
  → Phase 1A optional do-not-disturb while a cycle is active.
- **A-priority cap = 3, typically 1–2** — *"no more than three A priorities a day. Typically, it is only
  1 or 2."* → **validates the app's existing `MAX_A_PRIORITY_PER_DAY = 3`**; add a soft "typically 1–2" hint.
- **Meetings ~1 hour max** before they turn unproductive. → informs Phase 3A guidance.
- **Buffers are context-dependent** — *"Five-minute buffers between appointments"* vs. the PDF's 15-min
  "do nothing" before a meeting; *"clock set three minutes ahead."* → Phase 3A buffer must be configurable.
- **B priorities reviewed weekly**, re-dated intentionally, and **rewritten repeatedly** (*"a dozen times
  over a couple week period"*). → reinforces Phase 1B weekly review and Phase 2A re-dating.
- **"1-31" day-of-month tickler filing** → corroborates the ~30-day horizon model (Phase 1B).
- **50% planning / 50% doing** — a planning block itself counts as a completed cycle/"win." → philosophy
  reflected in the cycle acknowledgment + planning-ritual surfacing.

---

## PHASE 0 — Priority-First Restructure

> *"Everything is a B, this creates no stress"* (p.15). A = *"must be done today"*, *"no more than three…
> typically 1 or 2."* The whole system is organized around A vs B — so the app should be too. **Do this
> phase first; it reshapes the priority surfaces that Phases 1B / 2A / 3 build on.**

### 0A — Split Activities into A Activities + B Activities; Daily Plan schedules A only

**Concept.** Priority becomes the primary axis. Two nav screens. The Daily Plan timeline only accepts
**A activities** (plus meetings/appointments). B's live on the B screen as a "pick if you have time" menu and
reach the timeline only by being **promoted to A**, which unlocks once every A for the day is scheduled.
The 3-A/day cap relaxes from a hard block to a **soft, override-able warning**.

**Data model**
- `packages/types/src/entities/activity.ts`: `ActivityPriority` becomes `"A" | "B"` (**remove `null`**);
  `priority` is mandatory.
- `packages/db/src/schemas/activity.schema.ts`: `activityPrioritySchema = z.enum(["A","B"])`,
  `priority` default `"B"`, no longer `.nullable()`.
- **DB migration**: backfill `update activities set priority = 'B' where priority is null;` **then** add the
  `not null` constraint + default `'B'`. (Order matters — backfill before constraint.)
- No new table.

**Domain logic + tests** — `packages/domain/src/activity/index.ts`
- `groupActivitiesByPriority(activities): { a: Activity[]; b: Activity[] }`.
- **Soft cap:** keep `MAX_A_PRIORITY_PER_DAY = 3` but as a *recommended* threshold. Replace the hard
  `canAddAPriority` gate with `aPriorityWarningLevel(countForDay): "none" | "hint" | "warn"` —
  `hint` at 2–3, `warn` at 4+. Advisory only; never blocks.
- `promoteToA(activity)` / `demoteToB(activity)` — pure transitions.
- `canScheduleActivity(activity): boolean` = `priority === "A"` (Daily Plan eligibility guard).
- `canPromoteForScheduling(todaysActivities): boolean` — true once **no A is still open** — i.e. every A for
  the day is **completed** (or otherwise resolved: cancelled / delegated / postponed). Stricter "do your A's
  first, literally" reading. Edge: a day with zero A's satisfies this vacuously, so a B can be promoted
  immediately — desired.
- Tests: grouping; warning levels incl. the override path; schedule guard rejects B; promote gate opens only
  when all A's are completed/resolved (and vacuously when there are zero A's); promote/demote round-trip.

**Web UI**
- **Two nav items**: "A Activities", "B Activities". Each grouped by `section_type` internally
  (work/outside/delegated/unplanned invariants unchanged).
- **Promote/demote** on every row ("↑ Make A" / "↓ Make B"). Promotion routes through the warning + override
  when it would create a 4th+ A.
- **Daily Plan**: only A's are schedulable; B's are not draggable onto the timeline. Once all A's are
  **completed**, surface a "Promote a B to schedule more" affordance → opens the B screen / promote flow.
- **Escalating A nudge** (absorbs former Phase 3C): hint at 2nd–3rd A, warning + override at 4th+, same copy
  on both the A screen and the Daily Plan promote flow.

**Risks**
- Mandatory-priority migration must backfill **all** `null → B` before the not-null constraint, or the
  migration fails.
- This relaxes an existing hard invariant — update existing tests and UI copy (*"Max 3 A-priority activities
  reached"* → warn + override).
- The Daily Plan eligibility guard touches the scheduling path; ensure meetings/appointments still schedule
  (the guard applies to `source_type === "activity"` only).

### 0B — Screen rationalization (cut / merge / keep)

Trim modules the FOTW methodology doesn't exercise. **Proposed, pending the goals-pillar decision.**
This is destructive to existing modules — sequence behind data export/migration and confirm scope first.

| Module | Verdict | Rationale |
|--------|---------|-----------|
| Daily Plan, A/B Activities, Communication Planner, Meeting Planner | **Keep (core)** | The system *is* these — daily execution, per-person planners, meetings. |
| Calendar | **Keep** | Holds self-appointments, meetings, buffers — the time-blocked-but-not-A items. |
| Project Planner | **Keep (secondary)** | Projects are real in the docs; work activities link to one. |
| **Expense Record** | **Cut / repurpose** | Off-methodology. Docs show a *finance-awareness ritual* (evening bank-account review, "gratitude/abundance"; morning "these aren't big enough"), **not** expense/budget/currency tracking. Replace with a lightweight evening "confront finances" review prompt, or drop. |
| **Year at a Glance** | **Fold into Calendar** | Birthdays/travel are calendar events; CLAUDE.md already syncs birthdays to Calendar — semi-redundant. |
| **Monthly Priorities** | **Merge** into 30-day horizon + Someday (Phase 1B) | Redundant with the horizon we're building; otherwise two screens mean the same thing. |
| **Annual Strategies** | **Keep — slim & reframe** as a single **Goals / Ideal Scene** anchor *(locked)* | The visualization/ideal-scene thread *is* in the docs (*"ideal scene"* p.7, *"transmit the picture"* p.22, *"dictate the result"* p.18) and is core to the broader KT philosophy. Keep one goals layer, not two; cutting it loses the "why" behind an A. |

Net effect: ~11 screens → **~7** tightly aligned ones (Daily Plan · A Activities · B Activities ·
Communication Planner · Meeting Planner · Calendar · Project Planner · Goals/Ideal Scene).

**Goals-pillar resolution (locked):** keep a **single slim goals anchor** (reframe Annual Strategies →
"Goals / Ideal Scene"), **merge Monthly Priorities** into the 30-day horizon. It composes with the Phase 2A
"see it done" visualization — ideal-scene from top (goals) to bottom (each task).

---

## PHASE 1A — Work Cycles

> *"Finished cycle." "Starting cycle." "Cycle completed." "Next cycle."* … mini-breaks within a
> large project, a sub-minute water break to "not lose the intensity of focus" (p.7, p.16).

### Concept — completion-driven, not clock-bound
**This is what the document recommends.** Cycles in the testimonial are bounded by *finishing a unit of
work*, not by a timer: observed durations were 45 min (Communication Planner, p.8), 50 min ('Dustin' file,
p.9), 30 min ('Kevin' list, p.16), plus explicit *"short cycles"* (p.17). Large projects are broken into
**sub-cycles**, each verbally marked done — *"completed a cycle, even if it's a very small cycle"* (p.4).
Mini-breaks are deliberately **tiny** (a sub-minute water break, *"doesn't want to lose the intensity of
focus"*, p.7); longer interruptions are taken only at *"a natural pause in flow."*

Therefore a **Cycle** is a **count-up** focused session against an activity with explicit
start → (mini-break ↔ resume) → complete transitions and a verbal-style "Cycle completed / I'm ahead of
schedule" acknowledgment. There is **no countdown and no fixed pomodoro length**. `estimated_minutes`, if
present, is shown only as a *soft target* (informational), never a hard stop. It reuses the existing
`ScheduleInstance` (`focus_minutes`, `status: working`) rather than a parallel timer record — staying true
to "ScheduleInstance for all timed scheduling".

### Data model
**`packages/types/src/entities/cycle.ts`** (new)
```ts
export type CyclePhase = "focus" | "break" | "completed" | "abandoned";

export interface Cycle {
  id: string;
  user_id: string;
  activity_id: string;                 // FK → activities (shared source of truth)
  schedule_instance_id: string | null; // optional link to the timeline block
  soft_target_minutes: number | null;  // informational target from activity.estimated_minutes; null if none
  elapsed_focus_minutes: number;        // count-up actual focus time
  break_count: number;                  // mini-breaks taken
  phase: CyclePhase;
  started_at: string;                   // ISO datetime
  completed_at: string | null;
  note: string | null;                  // optional "what I got done" acknowledgment
  created_at: string;
  updated_at: string;
}
```
- Add `Cycle` to `packages/types/src/index.ts`.

**`packages/db/src/schemas/cycle.schema.ts`** (new) — mirror with Zod: `insertCycleSchema`,
`updateCycleSchema`. Constraints: `elapsed_focus_minutes >= 0`, `soft_target_minutes` nullable & `>= 1`
when present, `completed_at` required iff `phase === "completed"`. Register in
`packages/db/src/schemas/index.ts`.

**DB migration** (Supabase) — new `cycles` table, RLS by `user_id`, FK to `activities` (cascade delete),
nullable FK to `schedule_instances`. Index on `(user_id, activity_id)`.

### Domain logic — `packages/domain/src/cycle/index.ts` (new)
Pure functions (no UI), with tests:
- `startCycle(activity, now): Cycle` — sets `soft_target_minutes = activity.estimated_minutes || null` (no
  fixed default), `phase: "focus"`, `elapsed_focus_minutes: 0`. Rejects if `activity.activity_date` is in the past (reuse `isDateInPast`).
- `takeMiniBreak(cycle): Cycle` — `phase: "break"`, increments `break_count`. (Models the "<1-minute water break".)
- `resumeCycle(cycle, now): Cycle` — back to `phase: "focus"` (re-anchors the count-up segment to `now`).
- `completeCycle(cycle, now, note?): Cycle` — `phase: "completed"`, sets `completed_at`, finalizes accumulated `elapsed_focus_minutes`. **User-driven** — never auto-completed by elapsing a timer.
- `elapsedFocusMinutes(cycle, now): number` — derives live elapsed from `started_at`/segment anchors (UI reads this; never trusts an in-memory counter).
- `shouldPromptEnergyChange(cycle, now, intervalMin = 20): boolean` — true once the current focus segment has
  run ≥ `intervalMin` since start/last resume. Drives the **~20-min "change your energy" nudge** (validated:
  *"Every 20 minutes, I change my energy"*). A gentle prompt only — it never pauses or completes the cycle.
- `acknowledgmentMessage(cyclesCompletedToday): string` — returns the "Cycle completed — you're ahead of schedule" style line (data for UI; no I/O).
- `aheadOfScheduleCount(activitiesToday): number` — completed vs. planned, drives the "I'm ahead of schedule" affordance.

**Tests** — `packages/domain/src/__tests__/cycle.test.ts`: start→break→resume→complete happy path;
past-date rejection; soft-target derivation incl. the no-estimate (`null`) case; break counter; elapsed
accumulation across break/resume; user-driven completion (no auto-complete); acknowledgment text.

### Web UI — `apps/web/src/components/cycles/`
- `CyclePanel.tsx` — a focus-session card launched from an activity row in Daily Plan / Activities. "Start
  cycle" → **count-up** focus display with the soft target shown as a quiet "/ ~45m target" label (only when
  an estimate exists) → "Mini-break" / "Resume" / "Complete cycle". No countdown, no forced stop.
- **~20-min energy-change nudge**: when `shouldPromptEnergyChange` flips true, show a quiet, dismissible
  "Change your energy — stand up, move, or switch tasks" hint. Informational; does not interrupt the cycle.
- **Optional cycle do-not-disturb**: while a cycle is `focus`, suppress non-critical in-app reminder toasts
  (validated: *"when Kevin is in a cycle nothing should interrupt him"*). Gated behind a user setting,
  default OFF. Time-sensitive reminders (meeting starting) still show.
- On complete: notebook-style stamp accent (handwritten font) "Cycle completed ✓" + optional one-line "what got done".
- Daily Plan header gains a subtle "N cycles completed today · ahead of schedule" line.
- Must remain mobile-responsive (web), per UI rules.

### Edge cases / risks
- Elapsed time across reload/tab-switch → derive from `started_at` + break/resume anchors via
  `elapsedFocusMinutes`, never trust an in-memory counter.
- Don't let a cycle write `hours_worked` twice — accumulate into `activity.hours_worked` only on
  `completeCycle`, reusing the existing schedule-instance completion path.
- Offline: cycle mutations must enqueue through the existing sync queue (`packages/domain/src/sync`).

---

## PHASE 1B — 30-Day Horizon + Someday List

> *"He only keeps the next 30 days in his Priority Manager"* (p.4). *"A list of things for him to do
> that don't fit into the next 30 days … he looks at this list once a week"* (p.15).

### Concept
Two linked ideas:
1. A **rolling 30-day horizon** that the planning surfaces emphasize (not a hard block — past records
   and far-future scheduling still allowed, per existing rules).
2. A **Someday list** — items intentionally parked outside the 30-day window, reviewed weekly.

### Data model
Extend `Activity` (no new entity — keeps the single source of truth):
- `packages/types/src/entities/activity.ts`: add `is_someday: boolean` (default `false`). A someday item
  has `is_someday = true` and `activity_date` acts as a soft "review on/after" date rather than a commitment.
- `packages/db/src/schemas/activity.schema.ts`: add `is_someday: z.boolean().default(false)` to
  `activityBaseSchema`. **Decision (locked): someday items may be project-less.** Update the existing
  `superRefine` so the "work activities require a `linked_project_id`" rule is **skipped when
  `is_someday === true`** (they're parked, not yet committed). When an item is pulled into the horizon
  (`is_someday → false`) and is a `work` activity, the project requirement re-applies at that point.
- **DB migration**: `alter table activities add column is_someday boolean not null default false;`

Add a horizon helper rather than a column (horizon is derived, not stored):
- `packages/domain/src/activity/index.ts`:
  - `HORIZON_DAYS = 30`
  - `isWithinHorizon(activity, todayISO): boolean`
  - `partitionByHorizon(activities, todayISO): { withinHorizon, beyondHorizon, someday }`

### Domain logic + tests
- `getSomedayReviewDue(activities, lastReviewedISO, todayISO): boolean` — true when ≥7 days since last weekly review.
- Tests in `activity.test.ts`: horizon partition boundaries (day 0, 30, 31), someday inclusion/exclusion.

### Reminder integration
- Add `weekly_someday_review` to `ReminderType` (`reminder-preference.ts`) + prefs
  `someday_review_enabled` / `someday_review_day` ("MON".."SUN") / `someday_review_time`.
- New `computeSomedayReviewReminder(prefs, todayISO)` in `notification/index.ts`, wired into
  `computeAllReminders`. Tests in `notification.test.ts`.

### Web UI
- New **Someday** view (a tab/filter within Activities): lists `is_someday` items; "Pull into the next
  30 days" action sets a concrete `activity_date` and flips `is_someday = false` (and enforces the project
  rule at that moment for work items).
- **Decision (locked): horizon = soft emphasis + default filter toggle.** Daily Plan / Activities show a
  "Horizon: next 30 days" framing with a toggle (default ON) that filters to within-horizon items; items
  beyond the horizon are visually de-emphasized rather than hidden when the toggle is OFF. Not a hard block —
  far-future scheduling and past records still work per existing rules.
- Weekly review affordance: a guided "Review your Someday list" entry point triggered by the reminder.
- Mobile-responsive (web) per UI rules.

### Risks
- The project-rule exception must be enforced in **both** directions: skip on someday-create, re-apply on
  pull-into-horizon. Cover both with schema tests.

---

## PHASE 2A — Intentional B Re-dating

> *"I quite often was just pushing my B's to the next day … rather than putting thought into assigning
> them to a different day"* + *"see them completed"* (p.5). Non-A items go *"at least 1 week out"* (p.10).

### Concept
Replace the push-to-tomorrow default with a **"choose the day" reschedule flow** that nudges thoughtful
future-dating, and record full movement history (today the app only stores `moved_from_date` = origin).

### Data model
- Keep `moved_from_date` for backward-compat, but add a lightweight movement log:
  `packages/types/src/entities/activity-move.ts` (new): `{ id, activity_id, from_date, to_date, reason, moved_at }`.
- Zod schema + `activity_moves` table (RLS by user via activity FK). This satisfies CLAUDE.md "keep movement
  history: originally planned date, moved to date" without bloating the activity row.

### Domain logic + tests
- `packages/domain/src/activity/index.ts`:
  - `rescheduleActivity(activity, toDateISO, todayISO): { activity, move }` — rejects past target (reuse
    `canCreateActivityOnDate`), sets `moved_from_date`, emits an `ActivityMove`.
  - `suggestRedate(activity, todayISO): string` — for non-A items, suggests today+7 (the "1 week out" rule);
    for A items suggests today+1. UI pre-fills but never forces.
- Tests: past rejection, suggestion math for A vs B, move-log emission.

### Web UI
- The carry-forward / overdue flow (`CarryForwardPanel.tsx`) gains a **date picker** defaulting to the
  `suggestRedate` value, with quick chips ("+1 day", "+1 week", "Pick a day").
- Optional "see it done" micro-affordance: a checkbox/visualization prompt on reschedule (lightweight,
  notebook-styled) reflecting the doc's "visualize it completed" practice. Cosmetic, no schema cost.
- Mobile-responsive (web) per UI rules.

---

## PHASE 2B — Meeting Prep Reminder (one day before)

> *"Kevin … writes down in his Priority Manager one day before the meeting to prepare for the meeting"* (p.18).

### Concept
When a meeting is scheduled, optionally auto-surface a **"Prepare for: {meeting}"** reminder one day prior.
Driven from the shared `Meeting` record (no duplicate task), consistent with the existing reminder architecture.

### Data model
- `ReminderType` += `meeting_prep`. Prefs += `meeting_prep_enabled: boolean`, `meeting_prep_days_before: number` (default 1).

### Domain logic + tests
- `computeMeetingPrepReminders(meetings, daysBefore, todayISO)` in `notification/index.ts` — fires at 09:00 on
  `meeting.date - daysBefore` for `status === "upcoming"` meetings. Wire into `computeAllReminders`.
- Tests in `notification.test.ts`: fires exactly one day before; suppressed for completed/cancelled; respects toggle.

### UI
- Settings (web reminder preferences screen): toggle + days-before stepper, matching existing reminder rows.

---

## PHASE 3 — Polish layer (lower priority)

### 3A — Meeting buffer (configurable)
- `packages/domain/src/schedule/index.ts`: add `hasPreMeetingBuffer(instances, meetingStart, bufferMin)` and
  surface a soft warning (not a hard block) when scheduling a block that ends < buffer min before a meeting.
- **Buffer is context-dependent in the source** — 15-min "do nothing" before a meeting vs. 5-min between
  back-to-back appointments. So make it a pref `meeting_buffer_minutes` (default **15**) rather than hard-coding.
- Optional: a "show clock N minutes ahead" display preference (validated: *"clock set three minutes ahead"*).
  Cosmetic, display-only; default OFF. Cheap to add alongside the buffer pref.
- Tests for the overlap-with-buffer check at the boundary.

### 3B — Self-appointment recurring commitments
> *"reading a book everyday … shouldn't be an 'A' task, instead a calendar appointment with yourself"* (p.23).
- Leverage existing `CalendarEvent` (`event_type: "appointment"`, `recurrence_rule`). Add a web UI "Commitment
  with myself" creation shortcut and, when a user tries to mark a recurring activity as `A`, a gentle nudge to
  model it as a self-appointment instead. No schema change — purely UI guidance + a preset.

### 3C — "Typically 1–2 A's" soft guidance
> **Moved into Phase 0A.** The escalating A-priority nudge (hint at 2nd–3rd, warning + override at 4th+) is
> now part of the soft-cap work in the priority-first restructure, since it shares the same code path.

> **Out of scope:** Voice quick-capture (pocket recorder) is dropped for this effort.

---

## PHASE 4 — Six-Time Book (tundruk)  *(new feature, independent of Phases 0–3)*

> A continuous, **guilt-free** self-tracking practice (Tibetan *tundruk*): pause ~every 2 hours to log a
> success (+), a slip (−), and a small symbolic game-plan (to-do) against one of your 3 biggest problems,
> cycling through the 3 problems twice a day, then a nightly best-3 / worst-3 review before sleep. Mindset is
> *"tracking, not judging"* — *"a cold and calculating attempt to adjust your upcoming reality."* Entries are
> **short and sweet** and **specific** (*"At 3:15 I thanked Susan,"* not *"I was nice today"*).
>
> This is a **net-new screen** (an 8th module on top of the rationalized 7). It complements the
> Goals / Ideal Scene anchor (Phase 0B) and the intention/visualization thread — mental seeds at the
> mindset layer, A/B execution at the daily layer.

### Concept & structure
- **3 focus problems** (positions 1–3): each has a problem, its behavioral solution, and a short reminder
  phrase (the slot header). **Swappable** — when a problem fades, retire it and add the next biggest at the
  same position. Exactly **3 active** at all times.
- **6 daily slots**, prompted ~every 2 hours (3 before lunch, 3 after). Each slot maps to one problem via the
  cycle `position = ((slot − 1) mod 3) + 1` → slots 1/4 → P1, 2/5 → P2, 3/6 → P3. Each slot logs **+ / − /
  to-do** for that problem.
- **Nightly review**: a separate end-of-day entry — top **3 best** and top **3 worst** things, focus on the
  good before sleep, no self-judgment.

### Data model
**`packages/types/src/entities/six-time-problem.ts`** (new)
```ts
export type SixTimeProblemStatus = "active" | "retired";
export interface SixTimeProblem {
  id: string; user_id: string;
  position: 1 | 2 | 3;              // focus slot
  problem: string;                 // the problem
  solution: string;                // targeted behavioral solution
  reminder_phrase: string;         // short header shown on each slot
  status: SixTimeProblemStatus;
  created_at: string; retired_at: string | null; updated_at: string;
}
```
**`packages/types/src/entities/six-time-entry.ts`** (new) — the 6 daily slots
```ts
export interface SixTimeEntry {
  id: string; user_id: string;
  entry_date: string;              // ISO date YYYY-MM-DD
  slot_index: number;              // 1..6
  problem_id: string;              // FK → six_time_problems (resolved via the cycle)
  plus: string | null;            // a recent success (thought/said/did)
  minus: string | null;           // something done not-so-well
  todo: string | null;            // brief symbolic game-plan
  logged_at: string | null;
  created_at: string; updated_at: string;
}
```
**`packages/types/src/entities/six-time-nightly.ts`** (new)
```ts
export interface SixTimeNightlyReview {
  id: string; user_id: string;
  review_date: string;             // ISO date
  best: string[];                  // up to 3, short
  worst: string[];                 // up to 3, short
  logged_at: string | null;
  created_at: string; updated_at: string;
}
```
**`packages/types/src/entities/six-time-config.ts`** (new, per-user singleton)
```ts
export interface SixTimeConfig {
  id: string; user_id: string;
  enabled: boolean;
  slot_times: string[];            // exactly 6 "HH:MM", default ["08:00","10:30","12:30","15:00","18:00","21:30"]
  nightly_time: string;            // "HH:MM", default "22:30"
  created_at: string; updated_at: string;
}
```
- Add all four to `packages/types/src/index.ts`.

**Zod schemas** (`packages/db/src/schemas/six-time-*.schema.ts`, registered in `schemas/index.ts`):
- Problem: `position` ∈ {1,2,3}; non-empty `problem`/`solution`/`reminder_phrase` with **max ~120 chars**.
- Entry: `slot_index` 1–6; `plus`/`minus`/`todo` nullable, **max ~140 chars** (enforces brevity).
- Nightly: `best`/`worst` arrays `.max(3)`, each item short (max ~140).
- Config: `slot_times.length === 6`, each `HH:MM`; `nightly_time` `HH:MM`.

**DB migration** — four tables, RLS by `user_id`. Uniqueness: `(user_id, entry_date, slot_index)` on entries;
`(user_id, review_date)` on nightly; one config row per user; partial unique so only **3 active** problems
per user (e.g. unique `(user_id, position) where status = 'active'`).

### Domain logic — `packages/domain/src/six-time/index.ts` (new), pure + tested
- `slotToPosition(slotIndex): 1|2|3` = `((slotIndex - 1) % 3) + 1`.
- `resolveSlotProblem(slotIndex, activeProblems): SixTimeProblem` — slot → active problem at that position.
- `buildDayScaffold(date, activeProblems): SixTimeEntry[]` — the 6 empty slots wired to their problems.
- `swapProblem(position, newFields, problems)` — retire the active problem at `position`, add a new active one.
- `assertExactlyThreeActive(problems)` — invariant guard.
- Brevity helpers / validation surfaced from the Zod schemas.
- **Reminders**: `computeSixTimeSlotReminders(config, problems, todayISO, now)` (fires each of the 6 slot
  times, body = that slot's reminder phrase) and `computeSixTimeNightlyReminder(config, todayISO)`. Add
  `six_time_slot` + `six_time_nightly` to `ReminderType`; wire both into `computeAllReminders`. Gated on
  `config.enabled`.
- **Tests** (`__tests__/six-time.test.ts`): slot→problem cycle incl. wrap (slots 4–6); swap retires + adds and
  preserves the 3-active invariant; brevity max-length rejection; 6-per-day uniqueness; nightly best/worst
  capped at 3; reminder firing times; disabled-config emits nothing.

### Web UI — `apps/web/src/app/(app)/six-time-book/` + `components/six-time/`
- **Setup / onboarding**: capture the 3 problems + solutions + reminder phrases; a "swap a problem" flow.
- **Today screen**: the 6 slots in order, each showing its problem header and **+ / − / to-do** fields, with
  the current slot highlighted (based on `slot_times` vs. now). Cycles through the 3 problems twice.
- **Brevity-first UX**: tight `maxlength`, single-line-ish inputs, specificity placeholders
  (*"Be specific: 'At 3:15 I thanked Susan'"*), no long-form text areas.
- **Nightly review**: a distinct end-of-day screen — 3 best / 3 worst, with the "focus on the good before
  sleep" framing.
- **Settings**: enable + edit the 6 slot times + nightly time; matches existing reminder-preference rows.
- Light/notebook styling, mobile-responsive (web), handwritten accents on headings only.

### Past-time behavior & risks
- Today's slots are editable as the day progresses; **past-day** entries are **read-only** (view history),
  consistent with "past records remain visible." No creating entries dated in the past.
- The 3-active invariant is the main integrity risk — enforce in both Zod (per-write) and the DB partial
  unique index (per-user), and cover swap in tests.
- `slot_times` must stay length-6 and ordered; validate on save. Lunch split (3 before / 3 after) is guidance
  in copy, not a hard constraint — users may shift times.

---

## PHASE 5 — Giving (90-Day Karma Scorecard)  *(new feature, independent of Phases 0–4)*

> *"The secret of living is giving."* A 90-day practice: **give something every day** (words, thoughts,
> deeds, or things/money), and **keep score** — log what you gave and, beside it, what you received, plus any
> **cognitions** (realizations). Give cheerfully, ideally in secret, surrendering expectation of return. On
> Day 91 the tracker locks and a review asks: *"Look at the magic that happened. Do you want to continue?"* —
> yes flips it into a continuous lifestyle mode.
>
> A **net-new screen** (a 9th module). Complements the gratitude/abundance thread in the FOTW finance review
> and the manifestation / ideal-scene layer.

### Concept & structure
- A **90-day challenge** with a prominent **Day N of 90** progress tracker.
- **Daily entry = three fields**: **Outflow** (what I gave, with quick-tags Words / Thoughts / Deeds /
  Things·Money + the hint *"Did you give cheerfully and in secret?"*), **Inflow** (what I received), and
  **Cognitions** (inner shifts / "magic").
- **Score visualization**: Given vs. Received balanced over the 90 days (side-by-side list + a simple
  balance-scale visual).
- **Day-91 review**: aggregate the score, prompt to continue → **continuous mode** (no end, never locks).

### Data model
**`packages/types/src/entities/giving-challenge.ts`** (new)
```ts
export type GivingMode = "challenge" | "continuous";
export type GivingStatus = "active" | "completed" | "abandoned";
export interface GivingChallenge {
  id: string; user_id: string;
  start_date: string;              // ISO date; challenge window = start .. start+89
  mode: GivingMode;
  status: GivingStatus;
  reviewed_at: string | null;
  continue_decision: boolean | null; // answer to the Day-91 prompt
  created_at: string; updated_at: string;
}
```
**`packages/types/src/entities/giving-entry.ts`** (new)
```ts
export type GivingCategory = "words" | "thoughts" | "deeds" | "things_money";
export interface GivingEntry {
  id: string; user_id: string; challenge_id: string;
  entry_date: string;              // ISO date
  given: string;                   // outflow (required)
  given_categories: GivingCategory[];
  given_in_secret: boolean;        // reflects the "in secret" ideal
  received: string | null;         // inflow / harvest
  cognition: string | null;        // realization
  created_at: string; updated_at: string;
}
```
- Add both to `packages/types/src/index.ts`.

**Zod schemas** (`packages/db/src/schemas/giving-*.schema.ts`, registered in `schemas/index.ts`):
- Challenge: `start_date` not in the past (reuse time-rules); `mode`/`status` enums.
- Entry: `given` non-empty (max ~200); `given_categories` ⊆ the 4, `.min(1)`; `received`/`cognition` nullable
  (max ~200). Keep entries reasonably brief but less terse than Six-Time (these can be a sentence).

**DB migration** — two tables, RLS by `user_id`. **At most one active challenge per user**
(partial unique `(user_id) where status = 'active'`). **One entry per day per challenge**
(unique `(user_id, challenge_id, entry_date)`).

### Domain logic — `packages/domain/src/giving/index.ts` (new), pure + tested
- `challengeDayNumber(challenge, todayISO): number` — 1-based; for `challenge` mode caps the *window* at 90.
- `isChallengeComplete(challenge, todayISO): boolean` — true once day > 90 in `challenge` mode (never in
  `continuous`).
- `canEditEntries(challenge, todayISO): boolean` — **locks the daily tracker on Day 91** for `challenge`
  mode until review; `continuous` never locks.
- `aggregateScore(entries): { givenCount; receivedCount; byCategory; cognitionsCount; daysLogged }` — drives
  the review + visualization.
- `givingStreak(entries, todayISO): number` — consecutive days given.
- `completeReview(challenge, continueDecision): GivingChallenge` — sets `status: "completed"`,
  `reviewed_at`; if `continueDecision`, the caller starts a fresh `continuous` challenge.
- **Reminder**: `computeGivingReminder(prefs, activeChallenge, todayISO)` — a daily "give something / log your
  score" nudge. Add `giving_daily` to `ReminderType`; add `giving_reminder_enabled` + `giving_reminder_time`
  to `ReminderPreference`; wire into `computeAllReminders` (only while a challenge is `active`).
- **Tests** (`__tests__/giving.test.ts`): day-number math incl. the Day-90/91 boundary; lock on Day 91
  (challenge) vs. never (continuous); aggregate counts incl. per-category; one-active-challenge invariant;
  start-not-in-past; reminder fires only with an active challenge; review→continue spawns continuous mode.

### Web UI — `apps/web/src/app/(app)/giving/` + `components/giving/`
- **Onboarding**: *"The Secret of Living is Giving"* intro → start the 90-day challenge.
- **Daily scoreboard**: prominent **Day N of 90**; the three fields (Outflow + 4 category quick-tags +
  secret/cheerful hint, Inflow, Cognitions).
- **Score dashboard**: Given vs. Received balanced across the 90 days (list + balance-scale visual).
- **Day-91 review screen**: aggregate score + the *"Do you want to continue?"* prompt → continuous mode.
- **Settings**: giving reminder enable + time.
- Light/notebook styling, mobile-responsive (web), handwritten accents on headings only.

### Past-time behavior & risks
- Today's entry editable; **past-day** entries **read-only** (history). No entries dated in the past; a
  challenge can't start in the past.
- Main integrity risks: the **one-active-challenge** invariant (Zod + DB partial unique) and the **Day-91
  lock** transition (cover both in tests). The continue→continuous handoff must not orphan or duplicate the
  active challenge.

---

## Cross-cutting deliverables (every phase)
- **Types + Zod + DB migration** updated together (schema-first).
- **Domain tests** for new rules; extend sync-rule / past-time / recurrence / overlap tests where touched.
- **Docs**: update the spec doc and `screens.md` feature status; CLAUDE.md delivery rule — end each phase with
  a changed-files / domain-rules / tests / remaining-risks summary.
- **Sync**: all new mutations route through the offline sync queue.
- **Web only** (Next.js). Shared `types` / `db` / `domain` stay platform-agnostic so the Expo app can adopt
  them later, but **no mobile screens are built in this effort**.

## Suggested sequencing
1. **Phase 0A (Priority-first restructure)** — ✅ **BUILT & RISK-RESOLVED** (web). A/B screens,
   mandatory-priority (null dropped, DB NOT NULL), soft cap, Daily Plan A-only scheduling, **one-tap
   promote/demote** (click the priority badge), and the **in-Daily-Plan promote-to-schedule** affordance
   (`promoteActivityToA` action; button appears on B rows once all A's are completed). All activity inserts
   write explicit A/B, so the app is forward-compatible with or without the migration deployed. Web/mobile/
   domain typecheck clean; 414 domain tests pass. **Only remaining external step:** deploy the migration
   (`packages/db/supabase/migrations/20260615000001_*.sql`) to the hosted DB via `supabase db push` — backfills
   legacy nulls + hardens the NOT NULL constraint (validated against the live schema; can't be applied from
   here without project credentials).
2. **Phase 0B (Screen rationalization)** — ✅ **BUILT** (web, surface-level). Nav trimmed: removed Year at a
   Glance + Expense Record (routes redirect to /calendar and /daily-plan); Annual Strategies reframed →
   **Goals / Ideal Scene**; Monthly Priorities removed + redirected to /someday (merged into 1B horizon).
   Underlying pages/components/tables for the cut modules remain (full code+table deletion deferred behind a
   data-export step). Web typechecks clean.
3. **Phase 1A (Cycles)** — ✅ **BUILT** (web). Count-up completion-driven cycles reusing focus time:
   new `cycles` table (migration `20260615000002`) + `Cycle` type + Zod + `database.types` entry;
   `packages/domain/src/cycle` (start/break/resume/complete/abandon, `elapsedFocusMinutes`,
   `shouldPromptEnergyChange` ~20-min nudge, acknowledgments) with **19 tests**; web cycle server actions +
   `CyclePanel` (count-up timer, energy nudge, completion stamp) launched from a **◷ Focus** button on each
   A/B activity row; completing a cycle credits `activity.hours_worked`. Types/db/web/mobile typecheck clean;
   433 domain tests pass. Deferred polish: launch from Daily Plan rows + "N cycles completed today" header.
   Needs migration `20260615000002` deployed (app degrades gracefully until then).
4. **Phase 1B (Horizon + Someday)** — ✅ **BUILT** (web). `activities.is_someday` (migration `20260615000003`,
   type/Zod/database.types; work→project rule exempt while someday); domain horizon helpers (`HORIZON_DAYS=30`,
   `isWithinHorizon`, `partitionByHorizon`, `getSomedayReviewDue`) + tests; weekly Someday-review reminder
   (`weekly_someday_review` type + prefs + migration `20260615000004` + `computeSomedayReviewReminder` wired
   into `computeAllReminders`, made optional so mobile still compiles) + tests; **Someday screen** (`/someday`)
   with quick-add + "Pull into the next 30 days" (date-guarded) + a **☾ Move to Someday** action on activity
   cards; Monthly Priorities merged in (nav removed, route redirected). Note: the 30-day "filter toggle"
   adapts to a dedicated Someday surface since the Activities view is date-scoped (one day at a time), so a
   per-day horizon toggle would be a no-op. 441 domain tests pass; all 5 packages typecheck clean.
   Deferred: a Settings UI toggle for the someday-review reminder (functional now via DB defaults: Sunday 09:00).
5. **Phase 2A/2B** — ✅ **BUILT** (web). 2A: `activity_moves` table (migration `…0005`) + `suggestRedate`
   (B→+7, A→+1) / `buildActivityMove` / `canRedateTo` + tests; **📅 reschedule picker** on activity cards
   (chips +1 day / +1 week / pick-a-day, defaulting to the smart suggestion; records move history + sets
   `moved_from_date`). 2B: `meeting_prep` reminder full stack (type/prefs/migration `…0006`/
   `computeMeetingPrepReminders` wired in, optional for mobile-compat) + tests; web reminder fetch widened to
   the prep window so it actually fires.
6. **Phase 3** — ✅ **BUILT** (web, polish). 3A: `meeting_buffer_minutes` pref (migration `…0007`) +
   `violatesMeetingBuffer` / `nextMeetingGapMinutes` domain helpers + tests *(buffer-warning UI wiring into
   the schedule modal deferred — domain + pref ready)*. 3B: self-appointment nudge in the add form (recurring
   commitments → "calendar appointment with yourself"). (3C absorbed into 0A.)
7. **Phase 4 (Six-Time Book)** — ✅ **BUILT** (web). 4 entities (problems/entries/nightly/config) + Zod +
   migration `…0009` + database.types; domain `six-time` module (slot→problem cycle, buildDaySlots, setup
   invariants) + 8 tests; `six_time_slot`/`six_time_nightly` reminders (compute + wired optional for mobile) +
   3 tests; `/six-time-book` screen (3-problem setup/swap, 6 daily slots with +/−/to-do, nightly best-3/worst-3)
   + actions + nav item. 465 domain tests pass; all 5 packages typecheck clean. Needs migration `…0009`
   deployed. Deferred: a slot-time editing UI in settings (defaults used: 08:00/10:30/12:30/15:00/18:00/21:30,
   nightly 22:30).
8. **Phase 5 (Giving)** — ✅ **BUILT** (web). 2 entities (`giving_challenges`/`giving_entries`) + Zod +
   migration `…0010` + database.types; domain `giving` module (`challengeDayNumber`, `isChallengeComplete`,
   `canEditEntries` Day-91 lock, `needsReview`, `aggregateScore`, `givingStreak`, `completeReview`) + 16 tests;
   `giving_daily` reminder (compute + wired optional) ; `/giving` screen (onboarding → daily scoreboard with
   Day N/90, give/receive/cognition + category tags + "in secret", streak/score, → Day-91 review with
   continue→continuous) + actions + nav. 481 domain tests pass; all 5 packages typecheck clean. Needs
   migration `…0010`.

**ALL PLANNED PHASES (0A, 0B, 1A, 1B, 2A, 2B, 3, 4, 5) ARE BUILT.** Remaining: deploy migrations; deferred
polish (settings UIs for the new reminders/slot-times, buffer-warning UI in the schedule modal).

## Decisions — resolved
1. **Cycle length:** completion-driven / count-up, no fixed length. `estimated_minutes` is a soft target
   only (this is what the document recommends; durations there ran 30–50 min and were task-bounded). ✓
2. **Someday items project-less:** yes — refinement exception, re-applied on pull-into-horizon. ✓
3. **30-day horizon:** soft visual emphasis + default filter toggle (not a hard block). ✓
4. **Voice capture:** dropped from scope. ✓
5. **Mobile UI:** out of scope; shared packages remain platform-agnostic for later adoption. ✓
6. **Activities split:** two separate nav screens — A Activities + B Activities. ✓
7. **Priority mandatory:** default `B`, backfill existing `null → B`. ✓
   *(Implemented: `ActivityPriority` is now `"A" | "B"` (null fully dropped); enforced at the DB
   (NOT NULL DEFAULT 'B') + Zod + all activity inserts across web & mobile write explicit A/B. Web, mobile,
   and domain all typecheck clean.)*
8. **Daily Plan scheduling:** A only (+ meetings/appointments); B reaches the timeline only via promote-to-A,
   which unlocks once all A's are **completed/resolved**. ✓
9. **3-A cap:** soft warning with override (was a hard block); escalating nudge absorbs old Phase 3C. ✓
10. **Promote-a-B gate:** opens only after the day's A's are **completed** (stricter "A's first" reading);
    cancelled/delegated/postponed also satisfy it; zero-A days satisfy it vacuously. ✓
11. **Goals pillar:** keep a **single slim "Goals / Ideal Scene" anchor** (reframe Annual Strategies; merge
    Monthly Priorities into the 30-day horizon). Final screen set ≈ **7**. ✓

## Added features (both captured)
- ✅ **Feature 1 — Six-Time Book (tundruk):** **Phase 4**.
- ✅ **Feature 2 — Giving (90-Day Karma Scorecard):** **Phase 5**.

Final module set ≈ **9 screens**: the rationalized 7 (Daily Plan · A Activities · B Activities ·
Communication Planner · Meeting Planner · Calendar · Project Planner · Goals/Ideal Scene) **+ Six-Time Book
+ Giving**. (Goals/Ideal Scene replaces Annual Strategies, so it's within the 7.)
