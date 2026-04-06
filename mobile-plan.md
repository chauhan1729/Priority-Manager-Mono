# Priority Manager — Mobile App Implementation Plan

## Executive Summary

The Priority Manager mobile app can be built with **high confidence and low risk** on top of the existing architecture. The monorepo already provides:

- **All entity types** in `@pm/types` — zero changes needed
- **All business logic** in `@pm/domain` — pure TypeScript, no web dependencies, importable directly
- **Zod validation schemas** in `@pm/db` — usable for response validation
- **React Query client** in `@pm/api` — usable with one mobile override (`refetchOnWindowFocus: false`)
- **Offline sync adapter** in `apps/mobile/src/lib/sync/async-storage-sync.ts` — fully implemented with conflict resolution
- **Mobile scaffold** in `apps/mobile/` — Expo 55, Expo Router, 5-tab layout, placeholder screens

The core work is:
1. Build a **React Query hook layer** that converts the web's server actions into direct Supabase calls
2. Build **React Native UI components** matching the web's notebook aesthetic
3. Wire **auth, sync, and notifications** using Expo SDK libraries

Estimated scope: **7 build phases, 13 modules, ~70 screens/modals**.

---

## 1. Current Architecture Assessment

### 1.1 Repo Structure

```
Priority Manager App/
├── apps/
│   ├── web/            Next.js 15, React 19, Tailwind — fully implemented
│   └── mobile/         Expo 55, React Native 0.83 — scaffold only
├── packages/
│   ├── types/          All entity TypeScript types (Activity, Project, Meeting, etc.)
│   ├── domain/         Pure business logic (time rules, validation, sync, etc.)
│   ├── db/             Supabase client factory + Zod schemas + migrations
│   ├── api/            React Query client singleton
│   └── ui/             Tailwind utils (web-only)
└── tooling/
    ├── tsconfig/       Includes react-native.json preset
    ├── eslint/         Shared config
    └── prettier/       Shared config
```

### 1.2 Reusable Shared Logic (No Changes Needed)

| Package | What It Provides | Mobile Reuse |
|---------|-----------------|--------------|
| `@pm/types` | All entity interfaces, enums, type guards | Direct import — all types are platform-agnostic |
| `@pm/domain` | Time rules, activity validation (A-priority cap, capacity), project progress, calendar expansion, contact filtering, expense calculations, meeting management, monthly priority limits, notification scheduling, schedule overlap detection, offline sync queue + conflict resolution | Direct import — zero web dependencies |
| `@pm/db` | `createSupabaseClient()`, Zod schemas for all entities | Schemas usable directly. Client factory works but mobile needs `expo-secure-store` for auth storage — create client directly instead |
| `@pm/api` | React Query `queryClient` with defaults (staleTime 1min, gcTime 10min) | Direct import — override `refetchOnWindowFocus: false` at provider level |

### 1.3 Web-Only Logic (Must Be Ported, Not Extracted)

The web's **server actions** (`apps/web/src/app/(app)/*/actions.ts`) contain the exact Supabase queries for every mutation. These cannot be extracted to a shared package because:
- They use Next.js `"use server"` directive
- They call `revalidatePath()` (Next.js cache invalidation)
- They use `createSupabaseServerClient()` (cookie-based server auth)

**Mobile approach**: Port the Supabase queries from server actions into React Query mutation hooks. The queries are identical — only the auth mechanism and cache invalidation differ.

### 1.4 Blockers for Mobile Reuse

| Blocker | Resolution |
|---------|-----------|
| `@pm/db` client doesn't accept custom auth storage | Create Supabase client directly in mobile with `expo-secure-store` adapter |
| `@pm/ui` is Tailwind-only (web) | Build mobile UI components separately using `StyleSheet.create` |
| Web server actions use Next.js features | Port Supabase queries to React Query hooks |
| Web sync uses `localStorage` | Mobile adapter already exists using `AsyncStorage` |

---

## 2. Mobile Architecture Proposal

### 2.1 App Structure

```
apps/mobile/
  app/                              # Expo Router file-based routing
    _layout.tsx                     # Root: providers + font loading + auth guard
    (auth)/
      _layout.tsx                   # Auth group layout
      login.tsx                     # Login screen (email, Google, Apple)
    (tabs)/
      _layout.tsx                   # Bottom tab bar (5 tabs)
      daily-plan.tsx                # Tab 1: Daily Plan (home)
      activities.tsx                # Tab 2: Activities
      calendar.tsx                  # Tab 3: Calendar
      meeting-planner.tsx           # Tab 4: Meetings
      more.tsx                      # Tab 5: Hub for remaining modules
    year-at-a-glance.tsx            # Stack screen from More
    annual-strategies.tsx           # Stack screen from More
    monthly-priorities.tsx          # Stack screen from More
    communication-planner.tsx       # Stack screen from More
    project-planner/
      index.tsx                     # Project list
      [id].tsx                      # Project detail
    expense-record.tsx              # Stack screen from More
    settings.tsx                    # Stack screen from More
  src/
    components/
      ui/                           # Design system primitives
      providers/                    # AuthProvider, SyncProvider, NotificationProvider
      daily-plan/                   # DailyTimeline, ScheduleBlock, etc.
      activities/                   # ActivityCard, AddActivityModal, etc.
      calendar/                     # MonthGrid, EventCard, etc.
      meetings/                     # MeetingCard, MeetingFormModal, etc.
      communication/                # ContactCard, ContactDetailScreen, etc.
      projects/                     # ProjectCard, ProjectDetail tabs, etc.
      expenses/                     # ExpenseCard, SummaryStrip, etc.
      year-at-a-glance/             # YearGrid, EntryCard, etc.
      annual-strategies/            # GoalCard, GoalFormModal, etc.
      monthly-priorities/           # PriorityCard, MonthEndReview, etc.
      settings/                     # SettingsRows, TimePicker, etc.
    hooks/                          # React Query hooks (data layer)
      useActivities.ts
      useScheduleInstances.ts
      useMeetings.ts
      useCalendarEvents.ts
      useContacts.ts
      useProjects.ts
      useExpenses.ts
      useYearEntries.ts
      useAnnualGoals.ts
      useMonthlyPriorities.ts
      useReminderPreferences.ts
      useProfile.ts
    lib/
      supabase/client.ts            # Supabase client with SecureStore
      auth/oauth.ts                 # OAuth helpers (expo-auth-session)
      sync/async-storage-sync.ts    # Already exists — upgrade to real AsyncStorage
      notifications/mobile-notifications.ts  # expo-notifications bridge
    theme/
      colors.ts                     # Design tokens
      typography.ts                 # Font families + sizes
      spacing.ts                    # Spacing scale + border radii
```

### 2.2 Provider Stack (Root Layout)

```
QueryClientProvider (from @pm/api queryClient)
  └── AuthProvider (Supabase auth state + session refresh)
       └── SyncProvider (NetInfo connectivity + queue drain)
            └── NotificationProvider (local notification scheduling)
                 └── <Stack> navigation
```

### 2.3 Service/Data Layer Strategy

- **Server state**: React Query for all Supabase reads and writes
- **Client state**: React `useState`/`useReducer` for UI state (modals, selected date, form inputs)
- **Auth state**: Context provider wrapping `supabase.auth.onAuthStateChange`
- **Sync state**: Context provider exposing `{ isOnline, pendingCount, isSyncing, hasErrors }`
- **No Redux/Zustand/MobX** — React Query + Context is sufficient

### 2.4 Auth/Session Approach

| Method | Implementation |
|--------|---------------|
| Email/password | `supabase.auth.signInWithPassword()` / `signUp()` |
| Google OAuth | `expo-auth-session` + `expo-web-browser` with scheme `priority-manager` |
| Apple OAuth | `expo-auth-session` Apple provider |
| Token storage | `expo-secure-store` (encrypted native keychain) |
| Session refresh | `autoRefreshToken: true` + `AppState` listener to refresh on foreground |

### 2.5 API/Backend Integration

Mobile calls Supabase directly via the JS client SDK — no API server, no BFF layer. The Supabase client handles auth headers, RLS enforcement, and realtime subscriptions. This is identical to the web's browser client approach, with the only difference being token storage (SecureStore vs cookies).

### 2.6 Offline/Sync Integration

The offline sync adapter is **already built** at `apps/mobile/src/lib/sync/async-storage-sync.ts`:
- Queue operations: `enqueueOfflineOperation`, `markSynced`, `markRetryFailed`
- Drain: `drainQueue(supabase)` processes all retryable items with conflict resolution
- Conflict resolution: Uses `resolveConflict` from `@pm/domain` (last-write-wins)

Remaining work:
1. Install `@react-native-async-storage/async-storage` (currently uses in-memory fallback)
2. Wire `@react-native-community/netinfo` to trigger drain on reconnect
3. Wire `AppState` to trigger drain on foreground

---

## 3. Mobile Navigation Proposal

### 3.1 Bottom Tabs (5 Primary Destinations)

| Tab | Screen | Icon | Rationale |
|-----|--------|------|-----------|
| Daily Plan | Timeline + unscheduled list | Calendar/clock | Default home (spec §10.6) |
| Activities | Section-grouped activity list | Checklist | Most-used daily module |
| Calendar | Month grid + events | Calendar | Quick date-based access |
| Meetings | Meeting list + detail | People/chat | High-frequency daily use |
| More | Hub for 6 remaining modules + Settings | Grid/dots | Access to strategic planning, contacts, expenses |

### 3.2 Stack Flows (From Each Tab)

**Daily Plan tab stack:**
- ScheduleModal (bottom sheet: pick time for unscheduled activity)
- ScheduleBlockModal (bottom sheet: status change, unschedule, split)
- PostponeModal (bottom sheet: date picker)
- ActivityDetailScreen (pushed: full activity view/edit)

**Activities tab stack:**
- AddActivityModal (full-screen modal)
- EditActivityModal (full-screen modal)
- ProjectDetailScreen (pushed when tapping linked project name)

**Calendar tab stack:**
- EventDetailSheet (bottom sheet: event details + actions)
- AddEventModal (full-screen modal: create calendar event)
- MeetingDetailScreen (pushed: if event is a meeting)

**Meetings tab stack:**
- MeetingDetailScreen (pushed: agenda, takeaways, edit)
- AddMeetingModal (full-screen modal)
- ContactPickerSheet (bottom sheet: searchable contact list)

**More tab → stack screens:**
- Year at a Glance → YearEntryFormModal
- Annual Strategies → GoalDetailScreen → GoalFormModal, ProjectLinkModal
- Monthly Priorities → PriorityFormModal, MonthEndReviewModal
- Communication Planner → ContactDetailScreen → ContactFormModal
- Project Planner → project list → project detail [id] → add activity, milestones, resources
- Expense Record → ExpenseFormModal
- Settings

### 3.3 Drawers / Modals / Bottom Sheets

| Pattern | Used For |
|---------|----------|
| **Bottom sheet** (via `@gorhom/bottom-sheet`) | Quick actions: status change, date picker, contact picker, schedule time picker, event detail |
| **Full-screen modal** (`presentation: 'modal'`) | Create/edit forms (activities, meetings, events, expenses, goals, priorities, contacts, year entries) |
| **Pushed stack screen** | Detail views (project detail, contact detail, goal detail, meeting detail) |
| **Action sheet** | Destructive confirmations (delete), multi-option choices |

### 3.4 Module → Navigation Mapping

| Module | Navigation Location | Entry Point |
|--------|-------------------|-------------|
| Daily Plan | Tab 1 (home) | Bottom tab |
| Activities | Tab 2 | Bottom tab |
| Calendar | Tab 3 | Bottom tab |
| Meeting Planner | Tab 4 | Bottom tab |
| Year at a Glance | Stack from More | More list row |
| Annual Strategies | Stack from More | More list row |
| Monthly Priorities | Stack from More | More list row |
| Communication Planner | Stack from More | More list row |
| Project Planner | Stack from More | More list row |
| Expense Record | Stack from More | More list row |
| Settings | Stack from More | More list row |

---

## 4. UI Parity Strategy

### 4.1 Visual Parity Approach

The mobile app should look like the **same planner on a smaller screen**, not a different app. Strategy:

1. **Extract exact design tokens** from the web Tailwind config into `src/theme/`
2. **Match the card-based layout** — every web card becomes a mobile card with identical colors, borders, and typography
3. **Preserve the notebook aesthetic** — paper background (#FAFAF8), blue accents, Patrick Hand headings, Inter body text
4. **Adapt layout, not design** — 1-column where web uses 2-3 columns, but same cards, same badges, same status pills

### 4.2 Design Token Extraction

```
Web Tailwind → Mobile Theme
-------------------------------
paper: #FAFAF8        → colors.paper
ink.DEFAULT: #1A1A2E  → colors.ink
ink.light: #4A4A6A    → colors.inkLight
blue.50-900           → colors.blue50 through colors.blue900
font-handwriting       → fonts.heading (PatrickHand, loaded via expo-font)
font-sans              → fonts.body (Inter, loaded via expo-font)
rounded-xl             → borderRadius: 16
rounded-lg             → borderRadius: 12
border-blue-100        → borderColor: colors.blue100
```

### 4.3 UI Patterns That Can Be Reused Conceptually

| Web Pattern | Mobile Equivalent |
|-------------|------------------|
| Card with blue-50 border | `View` with `borderWidth: 1, borderColor: blue50, borderRadius: 16, backgroundColor: white` |
| Status badge (colored pill) | Same — `View` with colored background + `Text` |
| Priority badge (A/B) | Same — compact `View` with red/blue background |
| Section headers (Work, Outside, etc.) | `SectionList` section headers with notebook-ruled-line styling |
| Tab bar (Active/Delegated/Archived) | `SegmentedControl` or custom tab row |
| Empty state (dashed border + message) | Same — dashed border + centered text |
| Date navigation (← date →) | Same — horizontal row with arrow buttons + date text |
| Summary strip (totals) | Horizontal `ScrollView` with stat cards |

### 4.4 Interactions That Must Change for Mobile

| Web Interaction | Mobile Adaptation |
|----------------|------------------|
| Hover states | Pressed/active states via `Pressable` |
| Right-click context menu | Long-press action sheet |
| Sidebar navigation | Bottom tabs + More screen |
| Click-to-edit inline | Tap to open edit modal/bottom sheet |
| Drag-and-drop (Daily Plan timeline) | Tap unscheduled → pick time in bottom sheet |
| HTML `<select>` dropdowns | Custom picker bottom sheets or `ActionSheet` |
| Browser date/time pickers | `@react-native-community/datetimepicker` |
| Tooltip/hover popups | Tap to show info bottom sheet |
| Calendar event hover popup | Tap day → show event list below grid |
| Text area auto-resize | `TextInput multiline` with dynamic height |

### 4.5 Typography Strategy

| Usage | Font | Size |
|-------|------|------|
| Screen titles | Patrick Hand | 24-30 |
| Section headers | Patrick Hand | 18-20 |
| Card titles | Inter SemiBold | 15-17 |
| Body text | Inter Regular | 14-15 |
| Metadata (dates, times, estimates) | Inter Regular | 12-13 |
| Badges/pills | Inter Medium | 11-12 |
| Form labels | Inter Medium | 13 |
| Form inputs | Inter Regular | 15 |

### 4.6 Form Handling

| Web | Mobile |
|-----|--------|
| HTML `<form>` + `formAction` + `useActionState` | `useState` per field + mutation `onSubmit` handler |
| `<input type="date">` | `DateTimePicker` component (wrapping native picker) |
| `<input type="time">` | `DateTimePicker mode="time"` |
| `<input type="number">` | `TextInput keyboardType="decimal-pad"` |
| `<select>` | Custom picker bottom sheet or segmented control |
| Form validation errors | Inline error text below fields (same as web) |

### 4.7 Timeline Handling (Daily Plan)

The web's daily timeline uses CSS absolute positioning within a scrollable container. Mobile approach:
- `ScrollView` with hour markers (00:00-23:59, 24 hours × 60px = 1440px)
- Schedule blocks positioned absolutely within the scroll container
- Current time indicator line (positioned by offset from 00:00)
- Tap empty slot → open schedule modal pre-filled with that time
- Tap occupied block → open block detail/action sheet

### 4.8 Calendar Handling

The web builds a custom month grid. Mobile approach:
- Custom 7-column grid (not `react-native-calendars` — maintain visual parity)
- Day cells: number + colored dots for events
- Tap day: highlight + show events in a list below the grid
- Swipe left/right for month navigation
- Month notes editable at bottom

---

## 5. Feature Build Order

### Phase 0 — Foundation (Prerequisites)
**Goal**: Working app shell with auth, navigation, providers, theme, base UI components.

| Step | Task | Depends On |
|------|------|-----------|
| 0.1 | Install dependencies (AsyncStorage, NetInfo, bottom-sheet, reanimated, gesture-handler, expo-notifications, expo-auth-session, datetimepicker, haptics, flash-list) | — |
| 0.2 | Create `src/theme/` design tokens (colors, typography, spacing) | — |
| 0.3 | Create `src/components/ui/` base components (Card, Button, TextInput, ScreenHeader, Badge, SectionHeader, EmptyState, Toast, ProgressBar, DatePicker, TimePicker, SelectPicker) | 0.2 |
| 0.4 | Create Supabase client with SecureStore session adapter | 0.1 |
| 0.5 | Create AuthProvider + wire login screen with real auth | 0.4 |
| 0.6 | Create SyncProvider (NetInfo + AsyncStorage drain) | 0.1, 0.4 |
| 0.7 | Wire root layout (providers, font loading, auth guard) | 0.3-0.6 |

### Phase 1 — Daily Plan + Activities (Core Daily Workflow)
**Goal**: Users can manage activities and execute their daily plan.

| Step | Task | Depends On |
|------|------|-----------|
| 1.1 | Create activity hooks (queries + mutations) | Phase 0 |
| 1.2 | Build Activities screen (sections, cards, add/edit modals) | 1.1 |
| 1.3 | Create schedule instance hooks (queries + mutations) | 1.1 |
| 1.4 | Build Daily Plan screen (timeline, unscheduled list, carry-forward, schedule modal) | 1.1, 1.3 |

### Phase 2 — Calendar + Meetings
**Goal**: Calendar view and meeting management functional.

| Step | Task | Depends On |
|------|------|-----------|
| 2.1 | Create calendar event + meeting hooks | Phase 0 |
| 2.2 | Build Calendar screen (month grid, event list, event forms) | 2.1 |
| 2.3 | Build Meeting Planner screen (meeting list, detail, forms) | 2.1 |

### Phase 3 — Communication Planner + Project Planner
**Goal**: Contact management and project tracking.

| Step | Task | Depends On |
|------|------|-----------|
| 3.1 | Create contact + project hooks | Phase 0 |
| 3.2 | Build Communication Planner (contact list, detail, forms) | 3.1 |
| 3.3 | Build Project Planner (project list, detail with tabs, forms) | 3.1, Phase 1 |

### Phase 4 — Year at a Glance + Annual Strategies + Monthly Priorities
**Goal**: Strategic planning modules.

| Step | Task | Depends On |
|------|------|-----------|
| 4.1 | Create year entry + annual goal + monthly priority hooks | Phase 0 |
| 4.2 | Build Year at a Glance (year grid, entry forms) | 4.1 |
| 4.3 | Build Annual Strategies (section tabs, goal cards, forms, project linking) | 4.1, Phase 3 |
| 4.4 | Build Monthly Priorities (month nav, priority cards, forms, carry-forward, month-end review) | 4.1, Phase 3 |

### Phase 5 — Expense Record + Settings
**Goal**: Remaining modules.

| Step | Task | Depends On |
|------|------|-----------|
| 5.1 | Create expense + settings hooks | Phase 0 |
| 5.2 | Build Expense Record (summary, list, forms, recurring panel) | 5.1, Phase 2 |
| 5.3 | Build Settings screen (reminder preferences, timezone, sign-out) | 5.1 |

### Phase 6 — Notifications + Polish
**Goal**: Push notifications, performance, final polish.

| Step | Task | Depends On |
|------|------|-----------|
| 6.1 | Build NotificationProvider (local push notifications for all 7 reminder types) | All phases |
| 6.2 | Performance optimization (FlashList, React.memo, loading skeletons) | All phases |
| 6.3 | Haptic feedback, pull-to-refresh, completion celebration | All phases |
| 6.4 | Navigation polish (deep linking, back button behavior, sync badge) | All phases |

### Parallelization Opportunities

- Phase 2 and Phase 3 can run in parallel (no dependencies between them)
- Within Phase 4, steps 4.2, 4.3, and 4.4 can run in parallel
- Phase 5 steps 5.2 and 5.3 can run in parallel

### Audit Checkpoints

After each phase, verify:
1. All mutations correctly invalidate dependent query keys
2. Offline enqueue/drain works for all operations in the phase
3. Data appears correctly after creation, editing, and deletion
4. Navigation back/forward works from all screens in the phase
5. Loading and empty states display correctly

---

## 6. Module-by-Module Mobile Adaptation Plan

### 6.1 Authentication

**Reuse opportunities**: `@pm/db` Supabase client factory (concept), auth state pattern from web's `AuthProvider.tsx`

**UI adaptation**: Login screen already scaffolded with correct styling. Wire buttons to real auth calls. Add email/password input fields (not just buttons). Add loading spinner during auth. Add error display for failed attempts.

**Mobile-specific interactions**: OAuth opens system browser via `expo-web-browser`, returns via deep link (scheme: `priority-manager`). Biometric unlock could be added later via `expo-local-authentication`.

**Sync risks**: None — auth is a prerequisite, not a synced entity.

**Testing**: Sign in with all 3 methods. Verify session persists across app kill. Verify token refresh after 1hr+ background.

---

### 6.2 Daily Plan

**Reuse opportunities**: `@pm/domain` — `canScheduleAt`, `checkScheduleOverlap`, `validateFocusMinutes`, `validateLockedMinutes`, `getCarryForwardEligible`, `intervalsOverlap`

**UI adaptation**: 
- Web's server component pre-fetches 6 parallel queries → mobile uses 6 `useQuery` hooks
- Web's sidebar unscheduled list → mobile shows unscheduled as a collapsible section above the timeline
- Web's drag-and-drop slot scheduling → mobile uses tap → bottom sheet with time picker
- Web's current-time indicator → same approach with absolute positioning

**Mobile-specific interactions**: 
- Pull down to refresh activities/schedule
- Haptic feedback on status changes
- Swipe left/right for date navigation
- Long-press schedule block for quick actions (complete, postpone, unschedule)

**Sync risks**: Schedule instances must be created atomically — if the activity create syncs but the schedule insert fails, the timeline will be inconsistent. Mitigate by bundling related mutations.

**Testing**: Schedule/unschedule, carry-forward, postpone, date navigation, overlap prevention, past-time blocking.

---

### 6.3 Activities

**Reuse opportunities**: `@pm/domain` — `canAddAPriority`, `MAX_A_PRIORITY_PER_DAY`, `exceedsDailyCapacity`, `groupActivitiesBySection`, `canCreateActivityOnDate`, `getCarryForwardEligible`

**UI adaptation**:
- Web's section-grouped card grid → `SectionList` with section headers
- Web's `useActionState` + `formAction` → `useMutation` + form state management
- Web's inline status dropdown → long-press action sheet or bottom sheet picker

**Mobile-specific interactions**:
- Swipe-to-delete (with confirmation)
- Pull-to-refresh
- Tap linked project name navigates to project detail
- FAB (floating action button) for quick add

**Sync risks**: Activity mutations are the most frequent — the sync queue must handle create → update → status change sequences correctly. The existing FIFO queue handles this.

**Testing**: Create in each section, A-priority cap, work requires project, delegated requires contact, carry-forward, postpone, archive.

---

### 6.4 Calendar

**Reuse opportunities**: `@pm/domain` — `expandRecurringCalendarEvents`, `isCalendarEventPast`, `canCreateCalendarEventAt`, `isDateInAwayPeriod`, `getAwayEntryForDate`, month navigation utilities

**UI adaptation**:
- Web's custom `MonthGrid` → custom RN grid (7 columns, touchable day cells)
- Web's hover popup per event → tap day shows event list below grid
- Web's `EventPopup` → bottom sheet

**Mobile-specific interactions**:
- Swipe left/right for month navigation
- Color-coded dots per event type in day cells
- Tap day → highlight + scroll to event list
- Long-press day → quick-add event

**Sync risks**: Calendar event creation from meeting must create 3 records (CalendarEvent + Meeting + ScheduleInstance). If partial sync occurs, data will be inconsistent. Perform all 3 inserts in one batch and enqueue as atomic group.

**Testing**: Month navigation, event dots, create/edit/delete events, recurring expansion, meeting sync, monthly notes.

---

### 6.5 Meeting Planner

**Reuse opportunities**: `@pm/domain` — `isMeetingPast`, `isMeetingRunning`, `needsStatusUpdatePrompt`, `getMeetingEditableFields`, `needsTakeawayPrompt`, `expandRecurringMeetings`

**UI adaptation**:
- Web's split list+detail → single list with tap-to-detail
- Web's status tabs (Upcoming/Past) → segmented control at top
- Web's meeting form → full-screen modal with scrollable form

**Mobile-specific interactions**:
- Contact picker via searchable bottom sheet (not dropdown)
- Time duration picker (preset options: 15/30/45/60/90 min)
- Past meetings: only key takeaways text area editable
- "Needs takeaway" indicator badge on meeting card

**Sync risks**: Meeting ↔ CalendarEvent ↔ ScheduleInstance three-way sync. Same atomic batch approach as calendar.

**Testing**: Create with contact, edit future (all fields), past (takeaways only), delete, archive, calendar sync, recurring expansion.

---

### 6.6 Communication Planner

**Reuse opportunities**: `@pm/domain` — `sortContacts`, `filterContactsBySearch`, `filterContactsByCategory`, `getDelegatedActivitiesForContact`, `buildDelegatedMap`, `getContactDeletionInfo`

**UI adaptation**:
- Web's card grid + right drawer → contact list with tap-to-push detail screen
- Web's `ContactDrawer` → full-screen detail with sections (Info, Notes, Meetings, Delegated)
- Web's delete modal (soft/hard delete options) → action sheet with 2 options

**Mobile-specific interactions**:
- Search bar with real-time filtering
- Category filter chips (horizontal scroll)
- Swipe-to-call/email on contact card
- Tap meeting reference navigates to meeting detail

**Sync risks**: Soft delete (`is_deleted` flag) must sync correctly. Delegated activities reference contact IDs — if contact delete syncs before delegated activity update, FK constraint may fail. Queue ordering (FIFO) handles this.

**Testing**: Create in each category, edit, soft delete, rolling notes, meeting history display, delegated activities display.

---

### 6.7 Project Planner

**Reuse opportunities**: `@pm/domain` — `calcProjectProgress`, `getProjectMetrics`, `isProjectAtRisk`

**UI adaptation**:
- Web's project list page → `FlatList` with project cards showing progress bars
- Web's project detail page with tabs → pushed screen with tab bar or collapsible sections (Activities, Milestones, Resources, Notes)
- Web's add activity form within project → modal

**Mobile-specific interactions**:
- Tap project → push detail screen
- Tab bar within detail for Activities/Milestones/Resources/Notes
- Inline milestone completion toggle (checkbox)
- Resource status change via picker
- Notes: auto-saving text area

**Sync risks**: Project deletion cascades to activities. If project delete syncs before activity deletes, the server cascades automatically (DB `ON DELETE CASCADE` for milestones/resources, manual delete for activities in the server action). Mobile must replicate the "delete activities first, then project" pattern.

**Testing**: Create, edit, delete (verify cascade), add activities, milestone toggle, resource status, progress calculation, notes.

---

### 6.8 Year at a Glance

**Reuse opportunities**: `@pm/domain` — `isBirthdayEntry`, `isTravelOrAway`, `entrySpansDate`, `birthdayDateForYear`, `buildLinkedProjectName`, `canCreateLinkedTripPlan`, `entryOverlapsYear`

**UI adaptation**:
- Web's horizontal 12-month grid → vertical 2-column grid (scrollable)
- Web's inline entry editing → tap month → expand entries → tap entry to edit via modal
- Web's color-coded categories → same colors, compact format

**Mobile-specific interactions**:
- Year selector at top (prev/next arrows)
- Each month cell shows mini indicators (colored dots for entry types)
- Tap month cell → expand to show entry list
- "Create linked trip plan" toggle in form creates a project

**Sync risks**: Birthday → Calendar sync (year_entry creates calendar_event). Ensure atomic creation.

**Testing**: Create birthday (single day), travel (range + linked plan), edit, delete, calendar sync for birthdays.

---

### 6.9 Annual Strategies

**Reuse opportunities**: `@pm/domain` — `isArchivedGoal`, `isActiveGoal`, `canLinkProject`, `isValidProgress`, `groupGoalsBySection`, `filterActive`, `filterArchived`, section/status constants

**UI adaptation**:
- Web's 3-column layout (Business, Career, Personal) → segmented control or horizontal tabs to switch sections
- Web's goal cards → full-width cards in a scrollable list
- Web's `ProjectLinkModal` → bottom sheet with searchable project list

**Mobile-specific interactions**:
- Swipe between sections or use segmented control
- Progress slider for manual progress update
- Tap goal → push detail screen with full info + linked projects
- Archive completed/dropped goals (filter toggle)

**Sync risks**: Goal ↔ Project linking is a simple FK update — low risk.

**Testing**: Create in each section, edit, delete, progress update, link/unlink project, archive filter.

---

### 6.10 Monthly Priorities

**Reuse opportunities**: `@pm/domain` — `MAX_PRIORITIES_PER_SECTION`, `countBySection`, `canAddPriority`, `getEffectiveProgress`, `isStale`, `isEligibleForCarryForward`, `getCurrentMonthKey`, `getNextMonthKey`, `getPrevMonthKey`, `formatMonthLabel`, `groupBySection`

**UI adaptation**:
- Web's month navigator → horizontal prev/next with month label
- Web's 2-section layout → vertical sections in ScrollView
- Web's `MonthEndReviewModal` → full-screen modal

**Mobile-specific interactions**:
- Section counter badge ("3/5 used")
- Pin toggle on priority card
- Long-press for quick status change
- Carry-forward button per eligible priority
- Month-end review flow as guided modal

**Sync risks**: 5-per-section cap is enforced client-side. If two devices add priorities simultaneously, the cap could be exceeded. Add server-side check in the mutation or use a DB constraint.

**Testing**: Create in each section, enforce 5-per-section cap, status changes, pin/unpin, progress (manual vs auto), carry-forward, month navigation.

---

### 6.11 Expense Record

**Reuse opportunities**: `@pm/domain` — `sumExpenses`, `filterExpensesForDate/Week/Month`, `applyExpenseFilters`, `isRecurringExpense`, `getNextOccurrenceDate`, `getUpcomingOccurrences`, `groupExpensesByDate`, `formatExpenseAmount`, `formatExpenseDate`, category/recurrence constants

**UI adaptation**:
- Web's summary strip → horizontal `ScrollView` with stat cards (today, week, month totals)
- Web's expense list → `FlashList` with expense cards
- Web's filter bar → horizontal chip row (category, month, recurring)
- Web's `UpcomingRecurringPanel` → collapsible section

**Mobile-specific interactions**:
- Amount input with `keyboardType: 'decimal-pad'`
- Category picker as chip grid or bottom sheet
- Quick-add: tap "+" → pre-filled with today's date and last-used category
- Swipe-to-delete with confirmation

**Sync risks**: Recurring expense creation must also create a calendar event (for calendar sync). Same atomic batch approach.

**Testing**: Create one-time, create recurring (verify calendar sync), edit recurrence, delete, filter, summary totals.

---

### 6.12 Notifications / Reminders

**Reuse opportunities**: `@pm/domain` — `computeAllReminders`, `computeEodReminder`, `computeMorningSummaryReminder`, `computeMeetingUpcomingReminders`, `computeMeetingPassedReminders`, `computeRenewalReminders`, `computeBirthdayReminders`, `computeTravelReminders`, `filterUnfiredReminders`

**UI adaptation**: No web UI to replicate — notifications are system-level on mobile.

**Mobile-specific implementation**:
- Use `expo-notifications` for local push notifications
- Schedule notifications using the `computeAllReminders` domain function
- Re-schedule when preferences change (Settings screen)
- Handle notification tap → navigate to relevant screen
- Fallback: in-app polling if push permission denied

**Sync risks**: Reminder preferences sync between devices. If preferences are updated on web, mobile should pick up changes on next query refresh.

**Testing**: Toggle each reminder type, verify notifications fire at correct times, verify tap navigates correctly, verify graceful degradation if permission denied.

---

### 6.13 Offline Behavior

**Reuse opportunities**: `@pm/domain` — `createQueue`, `enqueue`, `dequeue`, `incrementRetry`, `getRetryable`, `getExhausted`, `resolveConflict`, `mergePayload`, `isSafeUpdate`. Mobile adapter already exists at `apps/mobile/src/lib/sync/async-storage-sync.ts`.

**UI adaptation**:
- Web's `SyncStatusIndicator` → floating badge near bottom tab bar
- Show pending count on badge
- Error state: show retry prompt

**Mobile-specific implementation**:
- `@react-native-community/netinfo` for connectivity events (replaces `navigator.onLine`)
- `AppState` listener to drain on foreground
- Queue persisted in `AsyncStorage` (survives app kill)
- Drain on: reconnect, app foreground, manual pull-to-refresh

**Sync risks**: See Risk Register (Section 8).

**Testing**: Go airplane mode, create/edit/delete entities, reconnect, verify sync. Simultaneous web+mobile edit, verify last-write-wins.

---

## 7. Shared Logic Extraction Plan

### 7.1 What Needs to Move

**Almost nothing needs to be extracted.** The shared packages are already well-structured:

| Logic | Current Location | Status |
|-------|-----------------|--------|
| Entity types | `@pm/types` | Ready — import directly |
| Business rules | `@pm/domain` | Ready — import directly |
| Zod schemas | `@pm/db` | Ready — import for validation |
| Sync queue | `@pm/domain` | Ready — mobile adapter exists |
| Conflict resolution | `@pm/domain` | Ready — used by mobile adapter |
| Query client | `@pm/api` | Ready — override one default |

### 7.2 What Should Stay Platform-Specific

| Logic | Web Location | Mobile Location | Why Not Shared |
|-------|-------------|----------------|---------------|
| Server actions (mutations) | `apps/web/src/app/(app)/*/actions.ts` | `apps/mobile/src/hooks/*.ts` | Web uses `"use server"` + `revalidatePath`; mobile uses React Query mutations + `invalidateQueries` |
| Auth client | `apps/web/src/lib/supabase/server.ts` + `client.ts` | `apps/mobile/src/lib/supabase/client.ts` | Web uses SSR cookies; mobile uses SecureStore |
| Sync storage | `apps/web/src/lib/sync/web-sync-store.ts` | `apps/mobile/src/lib/sync/async-storage-sync.ts` | Web uses localStorage; mobile uses AsyncStorage |
| UI components | `apps/web/src/components/` (Tailwind/React DOM) | `apps/mobile/src/components/` (StyleSheet/React Native) | Fundamentally different rendering targets |

### 7.3 Optional Future Extraction

If a pattern emerges where the same Supabase query logic is duplicated between web server actions and mobile hooks, consider extracting a `@pm/queries` package with platform-agnostic query builders:

```ts
// packages/queries/src/activities.ts
export function buildActivitiesForDateQuery(supabase: SupabaseClient, userId: string, date: string) {
  return supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('activity_date', date)
    .order('created_at', { ascending: true });
}
```

**Recommendation**: Don't do this upfront. Port the queries first, then extract if duplication becomes a maintenance burden. Premature abstraction here would slow down the build.

---

## 8. Risk Register

### High Impact Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **Auth token expiry while backgrounded** — tokens expire while app is in background for hours, user sees auth errors on resume | High | High | Configure `autoRefreshToken: true` (already set). Add `AppState` foreground listener to call `supabase.auth.refreshSession()`. Show re-login prompt only if refresh fails. |
| 2 | **OAuth deep link failure** — Google/Apple OAuth doesn't return to app correctly | Medium | High | Test scheme `priority-manager` thoroughly. Use `expo-web-browser` `maybeCompleteAuthSession()`. Register scheme in OAuth provider console. Test on both platforms. |
| 3 | **Offline mutation ordering** — dependent mutations (create activity → schedule it) may arrive at server out of order | Medium | High | Existing FIFO queue handles this. Add monotonic timestamps. Consider adding dependency markers for critical sequences. |
| 4 | **Three-way sync failures** — Meeting creation requires 3 records (Meeting + CalendarEvent + ScheduleInstance); partial sync leaves inconsistent state | Medium | High | Enqueue all 3 as a batch with shared timestamp. Process them sequentially in drain. Add rollback on partial failure. |

### Medium Impact Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 5 | **Calendar grid performance** — 42 day cells with event queries per month | Medium | Medium | `React.memo` on day cells. Pre-fetch adjacent months. Batch event queries per month, not per day. |
| 6 | **Timeline layout complexity** — overlapping schedule blocks need pixel-precise positioning | Medium | Medium | Use absolute positioning (same as web). Pre-compute layout with `checkScheduleOverlap`. Cap visible hours to reduce layout calculations. |
| 7 | **Simultaneous web+mobile edits** — same entity edited on both platforms while one is offline | Medium | Medium | Already handled by `resolveConflict` in `@pm/domain` (last-write-wins using `updated_at`). |
| 8 | **Expo Router navigation edge cases** — deep linking + tab preservation + modal stacks | Medium | Medium | Thorough navigation testing. Use `router.push` consistently. Test back button from every modal. |
| 9 | **Large list performance** — activities and expenses can grow to hundreds of items | Medium | Medium | Use `@shopify/flash-list` instead of `FlatList`. Paginate queries. |

### Low Impact Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 10 | **Font loading failure** — Patrick Hand fails to load on first install | Low | Medium | Bundle fonts as assets. Use `SplashScreen.preventAutoHideAsync()`. Fallback to system font. |
| 11 | **Platform date picker differences** — iOS inline vs Android dialog | High | Low | Wrap `@react-native-community/datetimepicker` in consistent `DatePicker` component. |
| 12 | **Push notification permission denied** | High | Low | Gracefully degrade to in-app polling. Show settings prompt. Never block app usage. |
| 13 | **React Query cache memory on mobile** | Low | Medium | 10min gcTime is reasonable. Reduce to 5min if memory issues appear. |
| 14 | **Monthly priority cap race condition** — two devices add 5th priority simultaneously | Low | Medium | Add server-side count check in mutation before insert. |

---

## 9. Implementation Prompt Roadmap

Each prompt below is a self-contained task for Claude Code. The prompts are dependency-ordered — each prompt can be given after the previous one is complete.

### Phase 0: Foundation

---

**Prompt 0.1 — Dependencies and Theme**

> Install the following dependencies in apps/mobile: `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`, `expo-notifications`, `expo-auth-session`, `expo-web-browser`, `@react-native-community/datetimepicker`, `expo-haptics`, `@shopify/flash-list`.
>
> Then create the theme files:
> - `apps/mobile/src/theme/colors.ts` — extract exact colors from `apps/web/tailwind.config.ts` (paper, ink, inkLight, full blue palette, plus red/green/amber/purple/gray utility colors used in status badges)
> - `apps/mobile/src/theme/typography.ts` — font families (PatrickHand for headings, Inter for body), font size scale (xs:11, sm:13, base:15, lg:17, xl:20, 2xl:24, 3xl:30), font weight mappings
> - `apps/mobile/src/theme/spacing.ts` — spacing scale (xs:4, sm:8, md:12, lg:16, xl:20, 2xl:24, 3xl:32), border radii (sm:8, md:12, lg:16, xl:20, full:9999)
>
> Update `apps/mobile/app.json` plugins array to include new Expo plugins that need it. Update `babel.config.js` or `app.json` to include `react-native-reanimated/plugin`.

---

**Prompt 0.2 — Base UI Components**

> Create the base UI component library at `apps/mobile/src/components/ui/`. Build these components using the theme tokens from `src/theme/` and matching the web app's notebook/planner aesthetic (paper background, blue accents, rounded cards, blue-100 borders):
>
> 1. `Card.tsx` — white card with blue-50 border, rounded-xl, optional shadow
> 2. `Button.tsx` — primary (blue-600 bg, white text), secondary (white bg, blue border), danger (red), text-only variants. Include loading state with ActivityIndicator.
> 3. `TextInput.tsx` — styled input with blue-100 border, rounded-lg, placeholder styling. Support multiline prop.
> 4. `ScreenHeader.tsx` — title bar with optional back button (left), optional right action button. Patrick Hand font for title.
> 5. `Badge.tsx` — compact pill for priority (A=red bg, B=blue bg) and status (not_started=gray, working=blue, completed=green, postponed=amber, delegated=purple, cancelled=red). Use the exact color mappings from `apps/web/src/components/project/ActivitiesTab.tsx` ACTIVITY_STATUS_CLASSES.
> 6. `SectionHeader.tsx` — notebook ruled-line divider with section title (Patrick Hand font), optional count badge
> 7. `EmptyState.tsx` — centered view with dashed blue-100 border, message text, optional action button
> 8. `Toast.tsx` — in-app toast notification (success=green, error=red). Appears at top, auto-dismisses.
> 9. `ProgressBar.tsx` — horizontal progress bar (blue-600 fill on gray-100 track), accepts percent prop
> 10. `DatePickerField.tsx` — touchable field that opens native date picker, displays selected date
> 11. `TimePickerField.tsx` — touchable field that opens native time picker, displays selected time
> 12. `SelectPickerField.tsx` — touchable field that opens a bottom sheet with option list
>
> Export all from an `index.ts` barrel file.

---

**Prompt 0.3 — Supabase Client + Auth Provider**

> Create the mobile Supabase client at `apps/mobile/src/lib/supabase/client.ts`. Use `createClient` from `@supabase/supabase-js` directly (not the `@pm/db` factory) because we need to pass `expo-secure-store` as the auth storage adapter. The env vars are `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Export a singleton `supabase` instance and a `useSupabase()` hook via context.
>
> Then create `apps/mobile/src/components/providers/AuthProvider.tsx` that:
> 1. Listens to `supabase.auth.onAuthStateChange` for sign-in/sign-out/token-refresh events
> 2. Exposes `{ user, loading }` via context and `useAuth()` hook
> 3. Handles `AppState` changes — calls `supabase.auth.refreshSession()` when app returns to foreground
>
> Then update the root `apps/mobile/app/_layout.tsx` to:
> 1. Wrap with `QueryClientProvider` using the `queryClient` from `@pm/api` (override `refetchOnWindowFocus: false`)
> 2. Wrap with `AuthProvider`
> 3. Load fonts (PatrickHand, Inter, Inter-Medium, Inter-SemiBold) via `expo-font`
> 4. Keep splash screen visible via `SplashScreen.preventAutoHideAsync()` until fonts loaded + auth state resolved
> 5. Add auth guard: if user → navigate to `(tabs)`, if not → navigate to `(auth)`

---

**Prompt 0.4 — Auth Screens**

> Wire the login screen at `apps/mobile/app/(auth)/login.tsx` with real Supabase authentication:
>
> 1. **Email sign-in**: Add email + password TextInput fields. Add "Sign In" button calling `supabase.auth.signInWithPassword()`. Add "Create Account" link that shows signup fields (name + email + password) calling `supabase.auth.signUp()`.
> 2. **Google OAuth**: Use `expo-auth-session` + `expo-web-browser`. Configure with Google provider URL from Supabase. Use scheme `priority-manager` for redirect. Call `supabase.auth.signInWithIdToken()` with the token from the OAuth response.
> 3. **Apple OAuth**: Use `expo-auth-session` Apple provider. Same flow — get token, pass to Supabase.
>
> Add proper error handling (show error message below form), loading states (disable buttons + show spinner), and keyboard avoidance. Match the existing login screen styling.
>
> Ensure the auth guard in `_layout.tsx` redirects authenticated users to `(tabs)` and unauthenticated users to `(auth)/login`.

---

**Prompt 0.5 — Sync Provider**

> First, upgrade `apps/mobile/src/lib/sync/async-storage-sync.ts`:
> - Replace the `InMemoryStore` fallback with direct `@react-native-async-storage/async-storage` imports
> - Remove the `getStorage()` runtime check — just import and use AsyncStorage directly
>
> Then create `apps/mobile/src/components/providers/SyncProvider.tsx`:
> 1. Use `@react-native-community/netinfo` `addEventListener` to detect connectivity changes
> 2. On reconnect (`isConnected: true`), call `drainQueue(supabase)` from the async-storage-sync adapter
> 3. Listen to `AppState` — drain queue when app comes to foreground and is online
> 4. Expose `{ isOnline, pendingCount, isSyncing, hasErrors }` via context and `useSyncState()` hook
> 5. Build a `SyncIndicator` component: floating badge showing offline/syncing/error state
>
> Wire `SyncProvider` into the root layout provider stack (after AuthProvider).

---

### Phase 1: Daily Plan + Activities

---

**Prompt 1.1 — Activity Hooks**

> Create `apps/mobile/src/hooks/useActivities.ts` with React Query hooks that replicate the exact Supabase queries from `apps/web/src/app/(app)/activities/actions.ts`. The hooks must:
>
> **Query key factory:**
> ```ts
> export const activityKeys = {
>   all: ['activities'] as const,
>   forDate: (date: string) => ['activities', 'date', date] as const,
>   forProject: (projectId: string) => ['activities', 'project', projectId] as const,
>   previousDayIncomplete: (date: string) => ['activities', 'carry-forward', date] as const,
> };
> ```
>
> **Query hooks:**
> - `useActivitiesForDate(date)` — fetch activities for a date, ordered by created_at
> - `useActivitiesForProject(projectId)` — fetch activities linked to a project
> - `usePreviousDayIncomplete(previousDate)` — fetch not_started/postponed activities from previous date (for carry-forward)
>
> **Mutation hooks** (port exact logic from web server actions):
> - `useCreateActivity()` — validate with `canCreateActivityOnDate`, `MAX_A_PRIORITY_PER_DAY`, work requires project, delegated requires contact. Insert into `activities` table. Invalidate `activityKeys.all` + `['projects']`.
> - `useUpdateActivity()` — validate same rules + A-priority cap excluding self. Update activity row. Invalidate relevant keys.
> - `useUpdateActivityStatus(activityId, status)` — update status. Invalidate keys.
> - `usePostponeActivity()` — validate `canCreateActivityOnDate(toDate)`. Fetch existing `moved_from_date` for first-move-wins. Update date + status + moved_from_date. Invalidate keys.
> - `useCarryForwardActivity()` — same first-move-wins pattern. Update date + origin_type='carry_forward' + moved_from_date. Invalidate keys.
> - `useDelegateActivity()` — verify contact belongs to user. Update status='delegated', section_type='delegated', delegated_contact_id, linked_project_id=null. Invalidate keys.
> - `useArchiveActivity()` — set archived=true. Invalidate keys.
> - `useDeleteActivity()` — delete row. Invalidate keys.
>
> All mutations must get user from AuthProvider context and add `.eq('user_id', user.id)` to queries. Use the Supabase client from `src/lib/supabase/client.ts`.

---

**Prompt 1.2 — Activities Screen**

> Build the Activities tab screen at `apps/mobile/app/(tabs)/activities.tsx` and supporting components. Replicate the web's `ActivitiesView.tsx` behavior:
>
> 1. **Date navigation bar** at top: left arrow, date display (Today/Tomorrow/formatted date), right arrow. Use same `addDays` and `formatHeaderDate` logic as web.
> 2. **Carry-forward panel** (collapsible): if previous day has incomplete activities, show a panel with "Carry Forward" button per item. Use `usePreviousDayIncomplete` hook and `useCarryForwardActivity` mutation.
> 3. **Section-grouped activity list** using `SectionList`: sections = Work, Outside, Unplanned, Delegated. Each section header shows section name + activity count + total hours. Use `groupActivitiesBySection` from `@pm/domain`.
> 4. **ActivityCard component** at `src/components/activities/ActivityCard.tsx`: shows priority badge (A/B), title (with strikethrough if completed/cancelled), section label, date, estimated hours, linked project name (tappable → navigates to project), delegated contact name (purple), note (italic), status badge. Right side: status text + edit button + delete button.
> 5. **Inline status change**: tap status badge → open bottom sheet with all status options. Use `useUpdateActivityStatus`.
> 6. **Add Activity**: FAB button → opens `AddActivityModal` (full-screen modal). Form fields: title, section type (segmented control), priority (segmented: None/A/B), date (DatePickerField), estimated hours (numeric input), linked project (SelectPickerField with project list — required for Work section), delegated contact (SelectPickerField — required for Delegated section), note. Use `useCreateActivity` mutation.
> 7. **Edit Activity**: tap edit button on card → opens `EditActivityModal` (same form, pre-filled). Use `useUpdateActivity` mutation.
> 8. **Delete**: tap delete button → confirmation alert → `useDeleteActivity`.
> 9. **Archive button**: show "Archive" text button on completed/cancelled activities → `useArchiveActivity`.
> 10. **Daily capacity warning**: if total estimated hours exceed 8, show amber warning text.
> 11. **A-priority cap**: if 3 A-priorities exist for date, disable A option in form and show message.
>
> Use hooks from `useActivities.ts` and `useProjects.ts` (create a minimal `useProjects` query for the project picker: just fetch `id, name, status` for active projects).

---

**Prompt 1.3 — Schedule Instance Hooks**

> Create `apps/mobile/src/hooks/useScheduleInstances.ts` with React Query hooks porting the exact Supabase logic from `apps/web/src/app/(app)/daily-plan/actions.ts`:
>
> **Query key factory:**
> ```ts
> export const scheduleKeys = {
>   all: ['scheduleInstances'] as const,
>   forDate: (date: string) => ['scheduleInstances', 'date', date] as const,
> };
> ```
>
> **Query hooks:**
> - `useScheduleInstancesForDate(date)` — fetch schedule_instances for date with activity/meeting joins
>
> **Mutation hooks:**
> - `useScheduleActivity()` — validate `canScheduleAt`, `validateLockedMinutes`, `validateFocusMinutes`, `checkScheduleOverlap` (all from `@pm/domain`). Insert schedule_instance. Update activity `remaining_minutes -= focus_minutes`. Invalidate schedule + activity keys.
> - `useUnscheduleActivity()` — delete schedule_instance. Restore activity `remaining_minutes += focus_minutes`. Invalidate keys.
> - `useUnscheduleRunningBlock(mode: 'full' | 'split')` — full: delete block, restore minutes. Split: mark block `keep_as_history=true`, credit `hours_worked`, update activity remaining. Invalidate keys.
> - `useUpdateScheduleBlockStatus()` — update schedule_instance status. If completed: set activity status to completed, credit hours_worked. If postponed: set activity status to postponed. Sync activity status with schedule status. Invalidate keys.

---

**Prompt 1.4 — Daily Plan Screen**

> Build the Daily Plan tab screen at `apps/mobile/app/(tabs)/daily-plan.tsx` and supporting components. This is the default home screen (spec §10.6):
>
> 1. **Date navigation bar**: same as Activities screen (prev/next arrows + date).
> 2. **Carry-forward panel**: same pattern, collapsible at top.
> 3. **Unscheduled activities section**: list of activities for the date that have no schedule_instance. Each item shows title, priority, estimated time, project name. Tap item → open `ScheduleModal` bottom sheet.
> 4. **ScheduleModal** at `src/components/daily-plan/ScheduleModal.tsx`: bottom sheet with start time picker, end time picker, focus minutes input (defaults to activity remaining). Validates no overlap, not in past, focus ≤ remaining. Uses `useScheduleActivity` mutation.
> 5. **Daily Timeline** at `src/components/daily-plan/DailyTimeline.tsx`: `ScrollView` with hour markers (6AM-11PM). Positioned schedule blocks. Current time indicator (red line). Auto-scroll to current time on load for today.
> 6. **ScheduleBlock** at `src/components/daily-plan/ScheduleBlock.tsx`: absolutely positioned within timeline. Shows title, time range, status badge, priority badge, project name (for activities) or contact name (for meetings). Tap → open `ScheduleBlockModal`.
> 7. **ScheduleBlockModal** at `src/components/daily-plan/ScheduleBlockModal.tsx`: bottom sheet showing block details + actions: change status (complete/postpone/working), unschedule, unschedule running block (full/split options).
> 8. **PostponeModal**: bottom sheet with date picker for postponing activities to a future date.
> 9. **Meeting blocks**: meetings with schedule_instances appear on timeline alongside activities. Show meeting title, contact name, time. Tap → view meeting detail.
> 10. **Capacity summary**: at top or bottom, show "X of Y hours scheduled" for the day.
>
> Use hooks from `useActivities`, `useScheduleInstances`, `useMeetings` (create minimal meeting query for Daily Plan).

---

### Phase 2: Calendar + Meetings

---

**Prompt 2.1 — Calendar Event + Meeting Hooks**

> Create `apps/mobile/src/hooks/useCalendarEvents.ts` porting from `apps/web/src/app/(app)/calendar/actions.ts`:
> - `useCalendarEventsForMonth(monthKey)` — fetch events for month range, expand recurring via `expandRecurringCalendarEvents` from `@pm/domain`
> - `useMonthNote(monthKey)` — fetch calendar_month_notes for month
> - `useCreateCalendarEvent()` — including the `_createMeetingEvent` flow: when type='meeting', atomically create Meeting + CalendarEvent + ScheduleInstance
> - `useUpdateCalendarEvent()`, `useDeleteCalendarEvent()`, `useUpsertMonthNote()`
>
> Create `apps/mobile/src/hooks/useMeetings.ts` porting from `apps/web/src/app/(app)/meeting-planner/actions.ts`:
> - `useMeetings()` — all meetings ordered by date
> - `useMeetingsForDate(date)` — meetings for a specific date
> - `useMeetingsForContact(contactId)` — meetings linked to a contact
> - `useCreateMeeting()` — create Meeting + CalendarEvent + ScheduleInstance atomically. Use `localTimeToUTC` from `@pm/domain` for timezone conversion.
> - `useUpdateMeeting()` — past meetings: only key_takeaways + status editable (use `getMeetingEditableFields` from `@pm/domain`). Future meetings: all fields. Update linked CalendarEvent + ScheduleInstance.
> - `useDeleteMeeting()` — delete meeting + linked calendar event + schedule instance
> - `useArchiveMeeting()` — set archived=true

---

**Prompt 2.2 — Calendar Screen**

> Build the Calendar tab screen at `apps/mobile/app/(tabs)/calendar.tsx`:
>
> 1. **Month navigation**: prev/next arrows + "April 2026" label. Swipe gesture for month change.
> 2. **Month grid** at `src/components/calendar/MonthGrid.tsx`: custom 7-column grid (S M T W T F S headers). Day cells show day number + colored dots (blue=meeting, green=appointment, pink=birthday, amber=renewal, gray=other). Today highlighted with blue circle. Tapped day highlighted with blue background.
> 3. **Selected day event list**: below the grid, show events for the tapped day. Each item: time, title, type badge, contact name (if meeting). Tap → open EventDetailSheet.
> 4. **EventDetailSheet** (bottom sheet): event details (title, type, date, time, location, notes, linked contact, linked project). Actions: edit, delete. For meetings: show agenda + key takeaways + link to full meeting detail.
> 5. **CalendarEventFormModal** (full-screen modal): type selector (meeting/appointment/birthday/renewal/other), title, date, start time, end time, duration, contact picker (for meetings), location, notes, recurrence rule. When type=meeting, creating the event also creates a Meeting record (use the atomic create from hooks).
> 6. **Away period indicators**: highlight days that fall within Year at a Glance travel/away entries (use `isDateInAwayPeriod` from `@pm/domain`). Show warning when creating events during away periods.
> 7. **Monthly notes** at bottom: editable text area with auto-save (debounced `useUpsertMonthNote`).

---

**Prompt 2.3 — Meeting Planner Screen**

> Build the Meeting Planner tab at `apps/mobile/app/(tabs)/meeting-planner.tsx`:
>
> 1. **Tab toggle**: Upcoming / Past (segmented control at top). Upcoming = future meetings with status 'upcoming'. Past = meetings where date has passed or status is completed/missed/cancelled.
> 2. **MeetingCard** at `src/components/meetings/MeetingCard.tsx`: title, contact name, date + time, duration, status badge, "needs takeaway" indicator (amber dot if `needsTakeawayPrompt` returns true).
> 3. **Tap meeting card** → push `MeetingDetailScreen`: full detail view with agenda (editable for future), key takeaways (editable always), status control, edit/delete/archive actions. For past meetings, only key_takeaways + status are editable (per spec §10.9).
> 4. **"+" button** → open `MeetingFormModal` (full-screen modal): title, contact picker (searchable bottom sheet from contacts list), date, start time, duration picker (preset chips: 15/30/45/60/90 min + custom), agenda (multiline text), recurrence rule picker. Uses `useCreateMeeting` which atomically creates Meeting + CalendarEvent + ScheduleInstance.
> 5. **Recurring meetings**: expand via `expandRecurringMeetings` from `@pm/domain`. Show recurrence indicator on card.

---

### Phase 3: Communication + Projects

---

**Prompt 3.1 — Contact Hooks + Communication Planner Screen**

> Create `apps/mobile/src/hooks/useContacts.ts` porting from `apps/web/src/app/(app)/communication-planner/actions.ts`:
> - `useContacts()` — all non-deleted contacts
> - `useCreateContact()`, `useUpdateContact()`, `useUpdateContactNote()` (rolling note)
> - `useDeleteContact(mode: 'soft' | 'hard')` — soft: set is_deleted=true. Hard: delete row (with cascade warning).
>
> Build Communication Planner at `apps/mobile/app/communication-planner.tsx`:
> 1. **Search bar** + **category filter chips** (horizontal scroll: All, Personal, Professional, Family, Client, Vendor, Other). Use `filterContactsBySearch` and `filterContactsByCategory` from `@pm/domain`.
> 2. **Contact list** (FlatList): `ContactCard` showing full_name, category badge, company, role. Sort via `sortContacts` from `@pm/domain`.
> 3. **Tap contact** → push `ContactDetailScreen` at `src/components/communication/ContactDetailScreen.tsx`:
>    - Info section: name, company, role, phone (tappable to call), email (tappable to email)
>    - Rolling notes: editable text area, auto-save with `useUpdateContactNote`
>    - Meeting history: query `useMeetingsForContact(contactId)`, show last 3 meetings as cards
>    - Delegated activities: query activities where `delegated_contact_id = contactId` and not completed/cancelled, show as list
>    - Quick actions: "Schedule Meeting" button, "Add Delegated Activity" button
> 4. **"+" button** → `ContactFormModal`: full_name, category picker, company, role, phone, email, note.
> 5. **Delete**: long-press contact → action sheet with "Delete contact (keep history)" / "Delete and unlink all" / Cancel.

---

**Prompt 3.2 — Project Hooks + Project Planner Screens**

> Create `apps/mobile/src/hooks/useProjects.ts` porting from `apps/web/src/app/(app)/project-planner/actions.ts`:
> - `useProjects()` — all projects ordered by updated_at
> - `useProjectById(id)` — single project with full details
> - `useMilestones(projectId)`, `useResources(projectId)`
> - `useCreateProject()`, `useUpdateProject()`, `useDeleteProject()` (delete linked activities first, then project — same pattern as web)
> - `useCreateProjectActivity()` — create activity linked to project
> - `useCreateMilestone()`, `useUpdateMilestoneStatus()`, `useDeleteMilestone()`
> - `useCreateResource()`, `useUpdateResourceStatus()`, `useDeleteResource()`
> - `useUpdateProjectNotes()` — inline notes update
>
> Build Project Planner:
> 1. **List screen** at `apps/mobile/app/project-planner/index.tsx`: FlatList of `ProjectCard` components showing name, status badge, progress bar (from `calcProjectProgress`), metrics (X tasks, Y hours). Filter by status (chip row).
> 2. **Detail screen** at `apps/mobile/app/project-planner/[id].tsx`: header with project name + status. Tab bar or collapsible sections:
>    - **Activities tab**: same as web's `ActivitiesTab.tsx` — Active/Delegated/Archived sub-tabs, activity cards, add activity form, inline status change, archive button, edit/delete buttons. Show delegated contact name.
>    - **Milestones tab**: milestone list with status toggle (pending/completed/missed), add form, delete.
>    - **Resources tab**: resource list with status picker, add form (type, title, cost, status, needed_by_date), delete.
>    - **Notes tab**: auto-saving text area using `useUpdateProjectNotes`.
> 3. **Project metrics banner**: total tasks, completed, total hours, completed hours, progress percent. Use `getProjectMetrics` from `@pm/domain`.

---

### Phase 4: Strategic Planning

---

**Prompt 4.1 — Year at a Glance**

> Create `apps/mobile/src/hooks/useYearEntries.ts` porting from `apps/web/src/app/(app)/year-at-a-glance/actions.ts`:
> - `useYearEntries(year)` — all entries for a year
> - `useCreateYearEntry()` — validate birthday rules (single day, no end_date), travel rules (require availability_status). Optionally create linked project for trips (use `buildLinkedProjectName` from `@pm/domain`). Create CalendarEvent for birthdays.
> - `useUpdateYearEntry()`, `useDeleteYearEntry()`
>
> Build screen at `apps/mobile/app/year-at-a-glance.tsx`:
> 1. **Year selector**: prev/next arrows + year number.
> 2. **Year grid**: 12-month vertical grid (2 columns, 6 rows). Each month cell: month name + mini colored indicators for entries (travel=blue, away=amber, birthday=pink). Use `entryOverlapsYear` and `birthdayDateForYear`.
> 3. **Tap month** → expand to show entry list for that month.
> 4. **Entry cards**: type icon, title, date range, availability badge.
> 5. **"+" button** → `YearEntryFormModal`: type picker (travel/away/birthday), title, start date, end date (hidden for birthday), location, availability status (hidden for birthday), "Create linked trip plan" toggle (hidden for birthday), notes.

---

**Prompt 4.2 — Annual Strategies**

> Create `apps/mobile/src/hooks/useAnnualGoals.ts` porting from `apps/web/src/app/(app)/annual-strategies/actions.ts`:
> - `useAnnualGoals(year)` — all goals, grouped by section via `groupGoalsBySection`
> - `useCreateAnnualGoal()`, `useUpdateAnnualGoal()`, `useDeleteAnnualGoal()`
> - `useLinkProjectToGoal(goalId, projectId)`, `useUnlinkProjectFromGoal(goalId)`
>
> Build screen at `apps/mobile/app/annual-strategies.tsx`:
> 1. **Year selector** + **section tabs** (segmented control: Business / Career / Personal).
> 2. **Active/Archived toggle**: filter using `filterActive`/`filterArchived` from `@pm/domain`.
> 3. **GoalCard**: title, progress bar, status badge, target date, "why it matters" preview (1 line), linked projects count.
> 4. **Tap goal** → push detail screen: full description, why_it_matters, progress slider (manual, 0-100), status picker, linked projects list (tap to navigate), notes.
> 5. **"+" button** → `GoalFormModal`: section, title, description, why_it_matters, target_date, status, notes.
> 6. **Link project**: button on detail screen → `ProjectLinkModal` bottom sheet with searchable project list.

---

**Prompt 4.3 — Monthly Priorities**

> Create `apps/mobile/src/hooks/useMonthlyPriorities.ts` porting from `apps/web/src/app/(app)/monthly-priorities/actions.ts`:
> - `useMonthlyPriorities(monthKey)` — priorities for month, grouped by section
> - `useCreateMonthlyPriority()` — validate `canAddPriority` (5 per section max). Use `countBySection` from `@pm/domain`.
> - `useUpdateMonthlyPriority()`, `useDeleteMonthlyPriority()`
> - `useCarryForwardPriority(priorityId, nextMonthKey)` — check `isEligibleForCarryForward`
>
> Build screen at `apps/mobile/app/monthly-priorities.tsx`:
> 1. **Month navigator**: prev/next arrows + formatted month label (use `formatMonthLabel` from `@pm/domain`). Navigate via `getPrevMonthKey`/`getNextMonthKey`.
> 2. **Two sections**: Business & Career (header + cards), Personal (header + cards). Each section header shows "X/5 used" counter.
> 3. **PriorityCard**: title, category, progress bar (use `getEffectiveProgress`), status badge, pinned indicator, linked goal badge, linked project badge, stale indicator (use `isStale`).
> 4. **Long-press** → action sheet for quick status change.
> 5. **"+" button** → `PriorityFormModal`: section picker, title, category, started_date, target_date, linked_annual_goal picker, linked_project picker, progress_mode (manual/auto), manual progress slider, status, note.
> 6. **Carry-forward button**: shown on eligible priorities (status = in_progress with linked project still active). Uses `useCarryForwardPriority`.
> 7. **Month-end review modal**: shown when navigating away from a past month. Lists each priority with Complete/Carry Forward/Drop actions.

---

### Phase 5: Expenses + Settings

---

**Prompt 5.1 — Expense Record**

> Create `apps/mobile/src/hooks/useExpenses.ts` porting from `apps/web/src/app/(app)/expense-record/actions.ts`:
> - `useExpenses(monthKey)` — expenses for a month
> - `useCreateExpense()` — including calendar sync for recurring expenses (create CalendarEvent with source_type='expense_recurring')
> - `useUpdateExpense()`, `useDeleteExpense()` — including calendar event cleanup for recurring changes
>
> Build screen at `apps/mobile/app/expense-record.tsx`:
> 1. **Summary strip**: horizontal scroll showing Today total, This Week total, This Month total. Use `sumExpenses`, `filterExpensesForDate/Week/Month` from `@pm/domain`.
> 2. **Filter chips**: month selector, category filter, "Recurring only" toggle. Use `applyExpenseFilters`.
> 3. **Expense list** (FlashList): `ExpenseCard` showing title, formatted amount, date, category badge, merchant, payment method, recurrence indicator. Use `groupExpensesByDate` for date headers.
> 4. **"+" FAB** → `ExpenseFormModal`: title, amount (decimal-pad keyboard), date, category picker (chip grid), merchant, payment method, linked project picker, linked contact picker, recurrence rule picker, note.
> 5. **Upcoming recurring panel** (collapsible section): show next 5 occurrences across all recurring expenses. Use `getUpcomingOccurrences` from `@pm/domain`.

---

**Prompt 5.2 — Settings Screen**

> Create `apps/mobile/src/hooks/useSettings.ts`:
> - `useReminderPreferences()` — fetch reminder_preferences for user
> - `useUpdateReminderPreferences()` — update preferences
> - `useProfile()` — fetch user profile
> - `useUpdateProfile()` — update timezone and other profile fields
>
> Build screen at `apps/mobile/app/settings.tsx`:
> 1. **Notification section** (grouped rows, iOS settings style):
>    - Morning summary: toggle + time picker (default 08:00)
>    - End-of-day review: toggle + time picker (default 21:00)
>    - Meeting reminder: minutes-before picker (options: 5/10/15/30/60)
>    - Birthday reminder: days-before picker (options: 0/1/3/7)
>    - Travel reminder: days-before picker
>    - Renewal reminder: days-before picker
> 2. **Display section**:
>    - Timezone: searchable list picker
> 3. **Account section**:
>    - Email display (read-only)
>    - Sign out button (red, with confirmation)
>
> Wire the More screen (`apps/mobile/app/(tabs)/more.tsx`) to navigate to this screen and all other stack screens using `router.push()`.

---

### Phase 6: Notifications + Polish

---

**Prompt 6.1 — Push Notifications**

> Create `apps/mobile/src/lib/notifications/mobile-notifications.ts` and `apps/mobile/src/components/providers/NotificationProvider.tsx`:
>
> 1. Request notification permission on first launch using `expo-notifications`.
> 2. Implement `scheduleAllReminders(prefs, meetings, yearEntries, expenses)` that:
>    - Uses `computeAllReminders` from `@pm/domain` to generate reminder schedules
>    - Cancels all existing scheduled notifications
>    - Schedules local notifications for each computed reminder
> 3. Handle notification response (tap) to navigate to relevant screen:
>    - Meeting reminder → Meeting Planner
>    - EOD review → Daily Plan
>    - Morning summary → Daily Plan
>    - Birthday/travel → Year at a Glance
>    - Renewal → Expense Record
> 4. Re-schedule when preferences change (listen to reminder preferences query).
> 5. Wire `NotificationProvider` into root layout (after SyncProvider).

---

**Prompt 6.2 — Polish and Performance**

> Polish the entire mobile app:
> 1. Add `expo-haptics` selection feedback on: status changes, completions, deletions, swipe actions.
> 2. Replace `FlatList` with `@shopify/flash-list` FlashList for: Activities list, Contacts list, Expenses list, Meetings list.
> 3. Add `React.memo` to all card components: ActivityCard, MeetingCard, ContactCard, ExpenseCard, ProjectCard, GoalCard, PriorityCard, ScheduleBlock.
> 4. Add pull-to-refresh on all list screens (onRefresh → invalidate queries for that module).
> 5. Add loading skeletons for all data-fetching screens (show card-shaped gray placeholders while loading).
> 6. Build `CompletionCelebrationModal` — confetti animation when all daily activities are marked completed.
> 7. Add `SyncIndicator` floating badge showing pending count near bottom tabs.
> 8. Test and fix all navigation flows: deep linking via expo-router, back button from every modal, tab preservation when navigating to/from More stack screens.
> 9. Ensure keyboard avoidance works on all form modals (`KeyboardAvoidingView`).
> 10. Add haptic confirmation on destructive actions (delete confirmations).

---

## 10. Final Recommendation

### Best Path Forward

1. **Don't extract shared code prematurely.** The packages are already well-structured. Port Supabase queries from server actions into React Query hooks — this is mechanical work, not architectural.

2. **Build foundation first, then iterate by module.** Phase 0 (auth, providers, theme, base UI) is the critical path. Once it's solid, each feature module can be built independently following the hook → screen → polish pattern.

3. **Use the web server actions as the source of truth for queries.** Every `actions.ts` file contains the exact Supabase queries, validation logic, and business rules. The mobile hooks are a 1:1 translation with `useQuery`/`useMutation` replacing `"use server"` + `revalidatePath`.

4. **Prioritize daily workflow modules.** Daily Plan + Activities are the most-used features and the most complex (scheduling, carry-forward, timeline). Getting these right sets the foundation for everything else.

5. **Don't over-engineer offline sync.** The adapter is already built. Wire it to NetInfo and AppState events and it works. The domain package handles conflict resolution. Focus on getting the online experience right first.

6. **Keep UI very close to web.** Same cards, same badges, same colors, same typography. Only adapt layout (1-column) and interaction (bottom sheets instead of dropdowns, tap instead of hover). The notebook aesthetic should feel identical.

7. **Test each phase before moving on.** After each phase, verify: mutations work, offline queue captures operations, sync drains correctly, navigation flows work, loading/empty states display correctly.

### Estimated Effort

| Phase | Description | Relative Size |
|-------|------------|--------------|
| 0 | Foundation (auth, providers, theme, base UI) | Medium |
| 1 | Daily Plan + Activities | Large (most complex) |
| 2 | Calendar + Meetings | Medium |
| 3 | Communication + Projects | Medium |
| 4 | Year/Annual/Monthly | Medium |
| 5 | Expenses + Settings | Small |
| 6 | Notifications + Polish | Small-Medium |

The largest risk is Phase 1 (Daily Plan + Activities) due to the timeline scheduling complexity. If Phase 1 works well, the remaining phases are progressively simpler — they follow the same hook → screen → polish pattern with less complex UI.
