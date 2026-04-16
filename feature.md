# Daily Plan — Mobile parity (round 2)

## Round 2 follow-up (post device testing — bugs.md additions)

Three gaps surfaced after the first parity pass. Implementing in this pass:

### CRITICAL — early-completion data corruption
**Web** `updateScheduleBlockStatus(status='completed')` — when `now < end_at`:
- Truncates `end_at = now`, sets `locked_minutes = focus_minutes = elapsed`
- Credits ONLY elapsed to `hours_worked`
- Restores `unworked = original_focus - elapsed` to activity `remaining_minutes` (capped at estimated)

**Mobile** just sets `status='completed'` and credits FULL `focus_minutes` to `hours_worked`. For a 60-min block marked done after 25 min, mobile logs 60 min worked and loses 35 min that should go back into remaining.

Fix in [useScheduleInstances.ts](apps/mobile/src/hooks/useScheduleInstances.ts) `useUpdateScheduleBlockStatus`:
- Fetch `start_at`, `end_at`, `focus_minutes`, `locked_minutes` up front
- If status==='completed' and `now.getTime() < endMs`:
  - elapsed = `max(1, floor((now - start_at)/60_000))`
  - worked = `min(elapsed, focus_minutes)`
  - unworked = `focus_minutes - worked`
  - Update instance: `end_at=now, locked_minutes=worked, focus_minutes=worked`
  - activity: `hours_worked += worked`, `remaining_minutes = min(remaining + unworked, estimated - new_hours_worked)`
- If late completion (now >= end_at): credit full `focus_minutes` to hours_worked (current behavior, leave)

### HIGH — status buttons shown for future blocks
Web gates the status-update grid behind `isPast && status !== 'completed'`. Mobile shows all 5 buttons unconditionally, letting users mark a 3pm-tomorrow block "missed" today.

Fix in [ScheduleBlockModal.tsx](apps/mobile/src/components/daily-plan/ScheduleBlockModal.tsx): compute `isPast = new Date(block.startAt) < new Date()` and `isCompleted = block.statusSnapshot === 'completed'`. Only render the status row when `isPast && !isCompleted`. For completed, show read-only "This block is completed." For future, hide status row entirely (unschedule/postpone still visible).

### HIGH — layout divergence (user: "match web's mobile exactly")
Web mobile has NO view toggle. Single scrollable page: carry panel → **unscheduled list (collapsed by default, expand on tap)** → timeline. Unscheduled list sits ABOVE the timeline, not in a separate view.

Fix in [daily-plan.tsx](apps/mobile/app/(tabs)/daily-plan.tsx):
- Remove `view` state, toggle button, and `view === 'list'` branch
- Extract `UnscheduledPanel` inline (or new component) that shows a tappable header "Unscheduled · N" + chevron; body collapsed by default on mount, expanded on tap — body renders the same sectioned list (work/outside/unplanned/delegated) with per-row overwork, moved badge, Schedule + Move buttons
- Stack order in main scroll area: CarryPanel → UnscheduledPanel → DailyTimeline
- Keep existing header (date nav + Today link), capacity bar, A-priority banner as-is
- ScrollView container wraps everything so user can pan past timeline to reach bottom

---

## Context

The web Daily Plan is the most interactive screen in the app. Core shape:
- 24-hour timeline grid (0–24h, 64px/hour, hour + half-hour gridlines, current-time red dot+line)
- Scheduled blocks positioned by wall-clock time, 4 source types: **activity** (blue), **meeting** (violet), **appointment** (emerald), **other** (gray)
- Unscheduled activities list grouped by section (work/outside/unplanned/delegated), with per-activity **Schedule** and **Move to date** actions
- Carry-forward panel (previous day's incomplete)
- A-priority gate (blocks B/none scheduling while any A-priority is unscheduled)
- Three modals: ScheduleModal, SlotScheduleModal, ScheduleBlockModal + CompletionCelebrationModal
- Past-time gates, running-block split, early completion, first-move-wins postpone

Mobile already has: timeline component, 3 modals, postpone modal, view toggle (Timeline/List), A-priority banner, capacity text, carry-forward panel. But several features are missing or diverge from web.

### Key web file references
- page.tsx — server data fetch
- actions.ts — `scheduleActivity`, `unscheduleActivity`, `updateScheduleBlockStatus`, `unscheduleRunningBlock`, `postponeFromDailyPlan`
- DailyPlanView.tsx — state & handler orchestration
- DailyTimeline.tsx — grid + block rendering (PX_PER_HOUR=64, 1440 px/day)
- ScheduleBlock.tsx — activity block card
- UnscheduledList.tsx — sections + A-priority gate + Move button
- SlotScheduleModal.tsx, ScheduleModal.tsx — identical time/duration pickers
- ScheduleBlockModal.tsx — status update + unschedule + split + postpone
- CarryForwardPanel.tsx — amber panel with "Move All to Today"
- `packages/domain/src/schedule` — `intervalsOverlap`, `checkScheduleOverlap`, `validateFocusMinutes`, `validateLockedMinutes`

---

## Behavior spec (web → mobile mapping)

### 1. Data model
`ScheduleInstance` fields: `id, user_id, source_type, source_activity_id, source_meeting_id, source_event_id, schedule_date, start_at, end_at, locked_minutes, focus_minutes, status_snapshot, keep_as_history, created_at, updated_at`
- Exactly one of `source_*_id` is non-null per `source_type`
- `start_at`/`end_at` are ISO datetimes in UTC
- `locked_minutes` = wall-clock duration; `focus_minutes` ≤ `locked_minutes`
- `status_snapshot`: `upcoming | working | completed | postponed | missed | null`

### 2. Timeline grid
- 24 hours × 64 px/hr = **1536 px tall**; fixed `PX_PER_MIN = 64/60`
- 25 hour lines (0–24), 24 half-hour lines
- Current-time indicator: red dot + horizontal line, rendered only when `selectedDate === todayISO()`
- Block positioning: `top = minutesToPx(startLocalMin)`, `height = max(locked_minutes × PX_PER_MIN, 24)`

### 3. Block rendering (4 variants)
| source_type | Bg | Border | Content |
|-------------|----|----|-----|
| activity | status color (blue/amber/green/orange/gray) | match | priority badge, title, start time, project, duration; "needs update" amber ring if past & `upcoming` |
| meeting | violet-100 | violet-200 | title, start time |
| appointment | emerald-50 | emerald-200 | title, start time |
| other | gray-50 | gray-200 | title, start time |

Compact mode when `locked_minutes < 30`: hide detail row.

Status colors for activity blocks:
- `upcoming` → blue-50/200
- `working` → amber-50/200
- `completed` → green-50/200 (title strike-through)
- `postponed` → orange-50/200
- `missed` → gray-50/200

### 4. Tap-to-schedule (empty slot)
- Compute Y → minutes → snap to 15-min (`Math.round(rawMin / 15) * 15`), clamp to `[0, 23*60+45]`
- Pass `"HH:MM"` to `SlotScheduleModal`
- Ignore tap if Y lands on an existing block (check via hit-test or `e.target.closest('button')` equivalent)
- Disabled (`canSchedule=false`) for past dates (cursor: default vs crosshair)

### 5. SlotScheduleModal (pick activity + time + duration)
Sections:
1. Activity picker (scrollable list of unscheduled, auto-select if only 1)
2. Start time (`type=time`, 15-min step, prefilled from slot)
3. Duration range slider (15 → `remaining_minutes`, step 15)
4. Summary box: `HH:MM – HH:MM · Xh Ym` + partial-schedule hint (`… X stays unscheduled` amber) when `focus < max`
5. Error banner on overlap/past-time
6. Cancel / Schedule buttons

Validation: `focusMinutes > 0`, valid datetime, server does overlap + past-time checks.

### 6. ScheduleModal (from unscheduled row — activity pre-selected)
Identical to SlotScheduleModal except:
- No activity picker (activity is fixed)
- Default `startTime` = next 15-min tick from now (or `initialStartTime` override)
- Default `focusMinutes` = `snapTo15(remaining_minutes)`

### 7. ScheduleBlockModal (manage existing block)
Content varies by state (`isPast`, `isRunning`, `isEnded`, `status_snapshot`, `source_type`):

**Header:** title, "Meeting" pill if meeting, time range + duration, project link, agenda (if meeting), "Currently running" label

**Status update grid** (only if past & not completed): 2×2 grid of buttons — Completed / Working / Postponed / Missed
- Disabled when current status === target

**Unschedule** (future, non-completed, `source_type === 'activity'`):
- If not running: single button "↩ Move back to unscheduled"
- If running: amber card shows elapsed estimate + 2 choices:
  - "Mark elapsed ({elapsed}) as completed, return {remaining} to unscheduled" → `mode='split'`
  - "Move entire block ({focus}) to unscheduled" → `mode='full'`

**Postpone** (activity blocks, not completed):
- Collapsed button → expands date input (`min=todayISO()`)
- Submit → `postponeFromDailyPlan(activityId, toDate, currentDate, linkedProjectId)`

**Dismiss** button at bottom.

### 8. Unscheduled list (grouped by section)
Sections ordered `work → outside → unplanned → delegated`.

Per-row:
- Priority badge (A red / B blue)
- Title (truncated)
- Project link (blue) if set
- **Remaining time**: computed `max(0, estimated - hours_worked)`; if `0` show amber **"Extra time (overwork)"**
- `↷ moved` amber badge if `moved_from_date`
- Schedule button (disabled when A-priority gate blocks or past date)
- Move button → expands date input (min=today) → calls `onMoveToDate`

Empty state: "All activities scheduled or complete."
Past-date note: "Past date — view only" footer if `!canSchedule` and activities exist.

A-priority gate banner at top (red): "Schedule your A-priority activities first before scheduling others." — shown only when `canSchedule && hasUnscheduledA`.

### 9. Carry-forward panel
Amber panel when previous day has `status IN ['not_started', 'postponed']` activities.
- Header: "Carry Forward from {date}" + count
- "Move All to Today" bulk button
- Per-row: priority, title, project, duration, `Move →` button
- Each carry forward must pass `linkedProjectId` for project cache invalidation

### 10. Server actions / mutations matrix
| Action | Validation | Mutation | Cache invalidation |
|--------|-----------|----------|--------------------|
| scheduleActivity | canScheduleAt(startAt), validateLockedMinutes, validateFocusMinutes, checkScheduleOverlap | insert ScheduleInstance; decrement remaining_minutes (unless overwork) | activities, projects, schedule_instances |
| unscheduleActivity | canScheduleAt(start_at) (future only) | delete instance; restore remaining capped at estimated | activities, projects, schedule_instances |
| updateScheduleBlockStatus (`completed`) | — | truncate end_at to now if early; add focus to hours_worked; restore unworked to remaining; activity→completed if remaining=0 | all |
| updateScheduleBlockStatus (working/postponed/missed) | — | map to activity status | all |
| unscheduleRunningBlock mode=`full` | must be running | delete; restore focus to remaining | all |
| unscheduleRunningBlock mode=`split` | must be running | truncate end_at=now, focus=locked=elapsed, status=completed; hours_worked += elapsed; remaining += unelapsed | all |
| postponeFromDailyPlan | canCreateActivityOnDate(toDate) | activity_date=toDate, status=postponed, moved_from_date first-move-wins | all |
| carryForwardActivity | — | activity_date=toDate, origin_type=carry_forward, moved_from_date first-move-wins | activities, projects, schedule_instances |

### 11. Overlap detection
`checkScheduleOverlap(existing, proposedStart, proposedEnd, excludeId?)` using half-open intervals `[start, end)`. Returns count + list of conflicting instances — error toast should state the count.

### 12. Past-time handling
- Cannot **create** a block where `start_at < now` → "Cannot schedule in the past"
- Cannot **unschedule** past block → "Cannot remove a past scheduled block (kept as history)"
- Can update status for past blocks (upcoming → completed/missed/etc.)
- Past block with `status === 'upcoming'` shows **"needs update"** amber ring + label

### 13. Early completion
When marking a running block complete before `end_at`:
- `elapsed = max(1, floor((now - start_at) / 60_000))`
- `worked = min(elapsed, focusMinutes)`
- `unworked = focusMinutes - worked`
- Update block: `end_at = now, locked_minutes = worked, focus_minutes = worked`
- Activity: `hours_worked += worked`; `remaining_minutes += unworked` (capped at estimated - new_hours_worked)
- If `remaining_minutes === 0` after, mark activity `completed`

### 14. Celebration modal
When any block transitions to `completed`, show `CompletionCelebrationModal` (already exists on mobile as `CompletionCelebrationModal`).

### 15. Responsive / layout
- Mobile view is already stacked (no side-by-side). Keep.
- Modals: already bottom sheets. Keep.
- Keep view toggle (Timeline/List) — mobile-only UX addition.

### 16. PDF export
Web has `/daily-plan/print?date=…` route. Mobile: **out of scope** — no print context on device (matches plan).

---

## Bugs / gaps table

### CRITICAL

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| C1 | Carry-forward on Daily Plan doesn't pass `linkedProjectId` (stale project progress) | `app/(tabs)/daily-plan.tsx` handleCarryForward (115-123) | Pass `linkedProjectId: activity.linked_project_id` |
| C2 | Completion celebration modal never renders (just a toast) | `daily-plan.tsx` line 323, needs `CompletionCelebrationModal` mount | Mount celebration modal; trigger via `onCompleted` callback from ScheduleBlockModal |
| C3 | No "Move All to Today" on carry-forward panel | `daily-plan.tsx` carryPanel (134-153) | Add button that loops `handleCarryForward` for all `prevIncomplete` |

### HIGH

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| H1 | Unscheduled list is a flat list — not grouped by section (work/outside/unplanned/delegated) | `daily-plan.tsx` list view (217-298) | Replace flat SectionList `unscheduled` row with section-grouped sub-render using `groupActivitiesBySection()` |
| H2 | Unscheduled rows missing "Move to date" action (only Postpone + Schedule exist) | `daily-plan.tsx` unscheduledActions (250-267) | Add "Move" button that opens a date picker bottom sheet (matches web); calls postpone/move mutation |
| H3 | Remaining time shown as `remaining_minutes / 60` not the web formula `max(0, estimated - hours_worked)` — missing "Extra time (overwork)" label | `daily-plan.tsx` unscheduledMeta (242-247) | Use web formula; show "Extra time (overwork)" when computed===0 |
| H4 | `↷ moved` badge missing on unscheduled rows | `daily-plan.tsx` unscheduled row | Show amber badge if `activity.moved_from_date` set |
| H5 | Timeline doesn't mount `CompletionCelebrationModal` | `daily-plan.tsx` | Add visible state + mount component |
| H6 | Past-time slot taps don't show visual feedback — modal opens then server rejects | `DailyTimeline.tsx` | For `selectedDate === today`, disable tap on slots where Y < `minutesToPx(nowMinutes)` |
| H7 | Capacity bar lacks visual progress (just text `Xh scheduled · Yh planned`); no over-capacity color | `daily-plan.tsx` capacityBar (182-189) | Add a ProgressBar showing `totalScheduledMin/480` with amber/red when ≥100% |

### MEDIUM

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| M1 | A-priority banner doesn't list which activities are blocking (no highlight) | `daily-plan.tsx` aPriorityBanner (192-198) | Append count; list A-priority titles inline or highlight them with border in the list |
| M2 | No pull-to-refresh on List view or Timeline | `daily-plan.tsx` | Wrap in RefreshControl |
| M3 | Empty timeline shows nothing — no hint to tap or schedule | `DailyTimeline.tsx` | Show "No scheduled blocks. Tap a time to add." message over empty grid |
| M4 | Overlap error doesn't state the count of conflicting blocks | `useScheduleInstances.ts` scheduleActivity | Use `checkScheduleOverlap()` return and include count in error |
| M5 | ScheduleBlockModal missing "Meeting" pill in header when block is a meeting | `ScheduleBlockModal.tsx` | Show violet "Meeting" pill when `sourceType === 'meeting'` |
| M6 | ScheduleBlockModal doesn't show agenda for meeting blocks | `ScheduleBlockModal.tsx` | If meeting linked, show agenda below header |
| M7 | Activity block missing "needs update" amber ring for past blocks still `upcoming` | `ScheduleBlock.tsx` | Ring when `isPast && statusSnapshot === 'upcoming'` |
| M8 | Haptic feedback missing on block complete, slot tap, carry-forward | various | `Haptics.selectionAsync()` on slot tap + carry; `Haptics.notificationAsync(Success)` on completion |

### LOW

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| L1 | Icons in list view (📅 / +) differ from web (text "Schedule" / "Move"); acceptable | `daily-plan.tsx` | Keep icons (mobile-appropriate) |
| L2 | View toggle is mobile-only; fine | `daily-plan.tsx` | Keep |
| L3 | Slot-snap to 15-min happens silently (no vibration) | `DailyTimeline.tsx` | `Haptics.selectionAsync()` on slot tap before opening modal |
| L4 | No pinch-to-zoom on timeline | `DailyTimeline.tsx` | Defer — not in web either |
| L5 | PDF export missing | — | Out of scope (per plan) |

---

## Files to change

1. **`apps/mobile/app/(tabs)/daily-plan.tsx`**
   - `handleCarryForward`: accept+pass `linkedProjectId`
   - Add "Move All to Today" button to `carryPanel`
   - Group unscheduled activities by section in List view
   - Replace remaining-time text with `max(0, estimated - hours_worked)` + overwork label
   - Add `↷ moved` badge to unscheduled rows
   - Add "Move to date" action (bottom-sheet date picker) to unscheduled rows
   - Add `CompletionCelebrationModal` + `showCelebration` state; trigger from ScheduleBlockModal's `onCompleted`
   - Add capacity ProgressBar with color thresholds
   - Pull-to-refresh on both views (`RefreshControl`)

2. **`apps/mobile/src/components/daily-plan/DailyTimeline.tsx`**
   - Disable slot taps that resolve to a past time on today
   - Empty state overlay when no blocks
   - `Haptics.selectionAsync()` on slot tap

3. **`apps/mobile/src/components/daily-plan/ScheduleBlock.tsx`**
   - Amber ring when `isPast && status === 'upcoming'`
   - "needs update" label in compact row

4. **`apps/mobile/src/components/daily-plan/ScheduleBlockModal.tsx`**
   - "Meeting" violet pill in header for meeting source
   - Show `meeting.agenda` if present
   - `Haptics.notificationAsync(Success)` on complete

5. **`apps/mobile/src/hooks/useScheduleInstances.ts`**
   - Overlap error: include count from `checkScheduleOverlap` result
   - Cache invalidation: ensure `['activities']`, `['projects']`, `['schedule_instances']`, `['calendar_events']` all hit on mutations

6. **New helper (inline or small util)**
   - A date-picker bottom sheet for "Move to date" on unscheduled rows (can reuse existing PostponeModal pattern; add separate "Move" that calls the postpone mutation but doesn't set status=postponed — actually, for mobile parity with web's Move button, web calls postpone with different semantics. Recheck: web's `onMoveToDate` in UnscheduledList calls `postponeActivity` which sets `status='postponed'`. So **Move == Postpone but with custom date**; we can reuse PostponeModal.)

---

## Reusable / keep as-is

- `ScheduleModal`, `SlotScheduleModal` — UI shape matches web; verify date/time conversion stays in local time (wraps via `new Date(`${date}T${time}`)` → `toISOString()`) and keeps web parity
- `useScheduleInstancesForDate`, `useMeetingsForDate`, `useCalendarEventsForDate` hooks — correct
- `useActiveProjects`, `useContacts` — correct
- `DailyTimeline` base rendering (PX_PER_HOUR constants, hour labels, current-time line) — correct
- `PostponeModal` — reuse for Move-to-date
- View toggle (Timeline/List) — mobile-only bonus; keep
- Date navigation + Today link — correct
- Block tap → modal flow — correct

---

## Verification

1. Switch to List view → unscheduled activities grouped by Work / Outside / Unplanned / Delegated with section headers
2. Unscheduled row shows computed remaining (estimated − hours_worked); overwork shows amber "Extra time (overwork)"
3. Unscheduled row tap Move → date picker sheet → pick future date → activity disappears from today
4. `↷ moved` badge visible on rows where `moved_from_date` set
5. Carry-forward panel "Move All to Today" → every listed activity moved + project progress refreshes
6. Complete a scheduled block → celebration modal appears (once), haptic success
7. Timeline tap on past hour (today) → no modal (feedback haptic optional)
8. Timeline with 0 blocks → "No scheduled blocks. Tap a time to add." hint
9. Past block stuck on `upcoming` → amber ring + "needs update" label
10. Tap a meeting block → modal shows violet "Meeting" pill + agenda if present
11. Capacity bar: scheduled=4h shows ~50%, scheduled=8h shows 100%, scheduled=9h shows red
12. Bulk carry-forward: pending → all moved → toast count reflects moved items
13. Overlap error message includes conflict count
14. Pull-to-refresh on both views re-fetches activities + instances + calendar + meetings

---

## Out of scope

- PDF export (no mobile print context)
- Drag-to-reschedule (web doesn't support either)
- Drag-to-resize blocks
- Multi-day timeline view
- Pinch-to-zoom
- Section-ordered status updates (keep existing)
- Inline block editing (time edits require unschedule + reschedule, matches web)
