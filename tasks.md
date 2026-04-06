# Priority Manager — Build Task List

Status key: ✅ Done · 🔄 In progress · ⬜ Pending

---

## Phase 0 — Infrastructure (complete)

- ✅ Turborepo + pnpm monorepo scaffold
- ✅ Next.js 15 web app shell (App Router, sidebar, 10 nav stubs)
- ✅ Expo SDK 51 mobile shell
- ✅ Tooling: TypeScript, ESLint, Prettier configs
- ✅ `packages/types` — 12 entity interfaces
- ✅ `packages/domain` — business rules + 6 vitest test files
- ✅ `packages/db` — 18 Supabase migrations applied, database.types.ts, 14 Zod schemas
- ✅ Supabase project connected, migrations applied
- ✅ `apps/web/.env.local` with credentials

---

## Phase 1 — Core execution layer

### 1.1 Authentication
- 🔄 Auth callback route (`/auth/callback`)
- 🔄 Server actions: sign-in (email), sign-up, OAuth (Google, Apple), sign-out
- 🔄 LoginForm client component (email + OAuth buttons)
- 🔄 SignUpForm client component
- 🔄 AuthProvider + useUser hook
- 🔄 App layout: user display + sign-out button
- 🔄 `docs/architecture/auth.md`

### 1.2 Daily Plan (home screen — spec §10.6)
- ⬜ Design system: shared Card, Button, Badge, Drawer components in `packages/ui`
- ⬜ Daily Plan page layout: date header, timeline column, unscheduled list
- ⬜ Timeline component: 15-min slots, current-time strip
- ⬜ ScheduleBlock component (activity): title, project, focus duration, priority badge
- ⬜ ScheduleBlock component (meeting): title, contact, time range, status
- ⬜ Unscheduled list: grouped by section (Work, Outside, Delegated, Unplanned)
- ⬜ Schedule activity modal: date/time picker, focus duration, validation (no past, no overlap)
- ⬜ Carry-forward tray for yesterday's unfinished items
- ⬜ Status prompt after time passes (completed / postponed / working / move)
- ⬜ Daily Plan API: GET schedule instances for date, POST schedule instance
- ⬜ Sync: status update → activities table + project planner
- ⬜ Mobile-responsive layout (bottom sheet for schedule modal)

### 1.3 Activities (spec §10.5)
- ⬜ Activities page layout: 4 sections (Work, Outside, Delegated, Unplanned)
- ⬜ ActivityCard component: title, priority badge, status, project link, duration
- ⬜ Quick Add bar (title + section + priority)
- ⬜ Full Add modal: all fields including delegated contact, linked project, note
- ⬜ A-priority guard: block if > 3 per day (domain rule already exists)
- ⬜ Edit activity: preserve existing values correctly
- ⬜ Reschedule history: moved_from_date / moved_to_date
- ⬜ Carry-forward panel: yesterday's tasks
- ⬜ Activities API: CRUD endpoints with RLS
- ⬜ Sync: project linkage bidirectional with Project Planner
- ⬜ Desktop layout: status + project + time on right, not stacked

### 1.4 Calendar (spec §10.2)
- ⬜ Calendar page: month grid, day names, notebook style
- ⬜ Day cell: compact event badges (meeting, birthday, renewal, away)
- ⬜ Event detail popup (not full-page navigation)
- ⬜ Create event modal: type selector, date/time picker, linked contact/project
- ⬜ Recurrence support: daily, weekly, monthly
- ⬜ Birthday sync: read from year_entries (source_type = 'year_entry'), no duplicate
- ⬜ Meeting creation from Calendar → auto-creates Meeting record
- ⬜ Recurring subscription/renewal → visible in Calendar
- ⬜ Time rules: no past event creation
- ⬜ Away period warnings when scheduling over travel entry
- ⬜ Monthly notes area at bottom
- ⬜ Calendar API: CRUD for calendar_events

### 1.5 Meeting Planner (spec §10.9)
- ⬜ Meeting Planner page: meeting cards list
- ⬜ Meeting card: title, contact, date/time, status, "needs takeaway" indicator
- ⬜ Create meeting modal: contact picker (from Communication Planner), date/time, duration, agenda
- ⬜ Past meeting: only key_takeaways editable
- ⬜ Post-meeting prompt: update status + add takeaway
- ⬜ Recurrence: daily / weekly / monthly
- ⬜ Sync: Meeting ↔ CalendarEvent ↔ ScheduleInstance (Daily Plan)
- ⬜ Recurring meeting edit: this occurrence vs future
- ⬜ Meeting API: CRUD for meetings

### 1.6 Communication Planner (spec §10.7)
- ⬜ Communication Planner page: contact cards list
- ⬜ ContactCard: name, company, next meeting, last 3 meetings, note, delegated count
- ⬜ Contact detail drawer: full fields + meeting list + delegated activities
- ⬜ Search: name, company, email, note text
- ⬜ Filter: personal, professional, family, client, vendor, other
- ⬜ Create/edit contact modal
- ⬜ Delete contact: safe options (keep history vs unlink)
- ⬜ Delegated activities displayed on contact card
- ⬜ Contacts API: CRUD for contacts

---

## Phase 2 — Strategy and project layers

### 2.1 Project Planner (spec §10.10)
- ⬜ Project list page: cards with status, progress, hours, linked strategy
- ⬜ Project detail page: Overview / Activities / Resources / Milestones / Notes tabs
- ⬜ Progress: completed hours / total estimated hours
- ⬜ Milestone list (secondary layer)
- ⬜ Resource list: type, title, note, cost, status, assigned contact
- ⬜ Quick add activity from project
- ⬜ Filters: status, linked goal, linked priority, date
- ⬜ Delete flow: delete project + linked activities or cancel
- ⬜ Sync: Project activities ↔ Activities tab ↔ Daily Plan

### 2.2 Monthly Priorities (spec §10.4)
- ⬜ Monthly Priorities page: 2 sections (Business/Career, Personal)
- ⬜ Section counter: `3/5 used`
- ⬜ Hard block: > 5 priorities per section
- ⬜ Priority card: title, status, progress, linked goal/project
- ⬜ Carry-forward logic: only if linked project in_progress, requires user confirmation
- ⬜ Month navigation: previous/next
- ⬜ Month-end review flow: complete / carry forward / drop / rewrite
- ⬜ Inline status update (no popup)
- ⬜ Monthly Priorities API: CRUD

### 2.3 Annual Strategies (spec §10.3)
- ⬜ Annual Strategies page: 3 sections (Business, Career, Personal)
- ⬜ Strategy card: title, progress %, status, why it matters, linked project
- ⬜ Manual progress update
- ⬜ Status: not started / active / on track / at risk / completed / dropped
- ⬜ Archive completed/dropped from active view
- ⬜ Annual Strategies API: CRUD

### 2.4 Year at a Glance (spec §10.1)
- ⬜ Year view: 12 compact month cards
- ⬜ Entry types: travel/away, birthday
- ⬜ Color-coded categories
- ⬜ Inline editing from yearly view
- ⬜ Travel entry → option to create linked trip plan (project)
- ⬜ Birthday entries sync to Calendar (no duplicate)
- ⬜ Away period warnings in Calendar + Meeting Planner
- ⬜ Year at a Glance API: CRUD for year_entries

---

## Phase 3 — Supporting systems

### 3.1 Expense Record (spec §10.8)
- ⬜ Expense page: daily card list + monthly summary strip
- ⬜ Quick-add bar: amount, category, merchant
- ⬜ Recurring expenses: subscription / renewal → sync to Calendar
- ⬜ Filters: category, project, trip, payment method, date range
- ⬜ Link to: project, contact, travel entry
- ⬜ Summary: today / this week / this month totals
- ⬜ Expense API: CRUD for expenses

### 3.2 Notifications / Reminders (spec §13)
- ⬜ User-configurable end-of-day review time (stored in profiles.eod_review_time)
- ⬜ Reminder types: EOD review, upcoming meeting, post-meeting takeaway, birthday, renewal, travel
- ⬜ Reminder preferences UI in settings

### 3.3 Export (spec §15)
- ⬜ PDF daily plan export
- ⬜ CSV expense export
- ⬜ Project summary export

### 3.4 Offline-first (spec §14)
- ⬜ React Query optimistic updates (web)
- ⬜ Expo SQLite local cache (mobile)
- ⬜ Background sync queue
- ⬜ Conflict resolution: last-write-wins for low-risk fields

---

## Cross-cutting concerns (ongoing)

- ⬜ Design system (`packages/ui`): Card, Button, Badge, Chip, Modal, Drawer, DatePicker, TimePicker
- ⬜ Mobile responsiveness audit for every screen
- ⬜ React Query setup: query client, hooks per entity
- ⬜ Supabase Realtime subscriptions for live sync
- ⬜ Mobile auth (Expo): Supabase + Expo SecureStore session
- ⬜ Google OAuth configured in Supabase dashboard
- ⬜ Apple OAuth configured in Supabase dashboard
- ⬜ NEXTAUTH_SECRET / NEXT_PUBLIC_SITE_URL in production env
