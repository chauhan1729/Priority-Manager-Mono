# Mobile Rebuild Progress

Rigorous "explore web + mobile → write spec to feature.md → implement → test on device" loop applied per screen.

| # | Screen | Status | Notes |
|---|---|---|---|
| 1 | Settings | ✅ done + tested | Batch save with dirty-state detection; upsert; all 8 reminder prefs + timezone + `eod_review_time` mirror to `profiles` |
| 2 | Year at a Glance | ✅ done + tested | 1-col stacked mini-calendars; bottom-sheet day detail; availability-aware calendar overlay; birthday overlay dot; linked trip project navigable |
| 3 | Communication Planner | ✅ done + tested | Next Meeting section; tappable meeting/activity rows → planners; pre-selected contact on meeting form; count-aware delete copy; live-lookup detail (no stale data) |
| 4 | Meeting Planner | ✅ done + tested | 3-tab list with recurring-dedupe in Upcoming; past-meeting form gating (takeaways+status only); Now/in-progress badges; status/takeaway pills; agenda preview; tappable contact → Communication Planner; live-id detail lookup |
| 5 | Calendar | ✅ done | Form adapters (ISO↔Date) + onChange fix; past-event gating; timezone-aware time extraction; DetailItem union supports calendar_event / orphan_meeting / birthday / away; "Open in Meeting Planner" link; Today jump button; tap-empty-day opens form; orphan meetings surfaced + expanded |
| 6 | Expense Record | ✅ done | ISO↔Date adapters + onChange fix; Trip (year_entry) support end-to-end (form field + filter chips); date-range From/To filter; "Record this occurrence only" mode toggle + `useCreateOccurrence` mutation; linked-record chips on cards (📁/👤/✈); expanded CSV (11 columns, names not IDs); filtered-vs-unfiltered empty state |
| 7 | Project Planner | ❌ earlier shallow pass only (next-task callout + search + risk explanation added) | |
| 8 | Monthly Priorities | ❌ earlier shallow pass only | |
| 9 | Annual Strategies | ❌ earlier shallow pass only | |
| 10 | Activities | ❌ earlier shallow pass only — **load-bearing** | |
| 11 | Daily Plan | ❌ earlier shallow pass only — **load-bearing, default home** | |

## Recommended remaining order

1. **Project Planner** — full rebuild of detail tabs (Activities / Milestones / Resources / Notes), next-task callout + risk explanation already present, need to verify form adapters + cross-module links (contacts, year entries, monthly priorities, annual strategies)
2. **Monthly Priorities** — month-end review flow, linked strategy/project display
3. **Annual Strategies** — goal tracking with project link/unlink
4. **Activities** (load-bearing) — bulk mode, quick actions, archived section, carry-forward
5. **Daily Plan** (load-bearing, default home) — timeline, scheduling, block management, capacity, A-priority gate

## Conventions established

- `feature.md` at repo root = per-screen implementation plan (overwritten each pass)
- `bugs.md` at repo root = user's hints/quirks/known issues, read at the start of each pass
- Fix pre-existing errors in files we touch (runtime-breaking issues like `DatePickerField` string ↔ Date) — don't fix unrelated files
- Keep mobile UX native (bottom sheets, ActionSheetIOS + Alert, FlashList) even when web's mobile layout differs
- Invalidate cross-module query keys on mutation (e.g., `['projects']` on year entry delete)
- Use `exactOptionalPropertyTypes`-safe prop passing (conditional spread, not `?? undefined`)
- For screens with a form modal: ISO ↔ Date adapters + `onChange` (not `onSelect`) are the most common bugs to check first
- For cross-module navigation: `router.push('/path')` on tap; deep-linking to specific records deferred
