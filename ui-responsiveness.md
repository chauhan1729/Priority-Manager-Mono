# Web App Responsive UI Plan

## Context

The Next.js web app at [apps/web](apps/web/) is currently **desktop-first**. The sidebar at [apps/web/src/app/(app)/layout.tsx](apps/web/src/app/(app)/layout.tsx) is a hard-coded `w-60` column that never collapses, and it uses a plain text wordmark instead of the notebook logo that already exists at [apps/web/public/favicon.svg](apps/web/public/favicon.svg). Data-heavy views (Calendar, Activities, Project Planner, Expense Record, Daily Plan) use ad-hoc `md:`/`sm:` classes in places but have no coherent responsive strategy — they will overflow or crowd on phones and tablets.

Goal: make every page usable and readable on phone (≤640px), tablet (641–1024px), and desktop (≥1024px), introduce a collapsible sidebar that also works as a mobile drawer, and use the existing notebook SVG as the sidebar logo. Stay faithful to CLAUDE.md rules — light mode, notebook visual language, handwriting font only for accents, readability over novelty.

## Breakpoint strategy

Standard Tailwind breakpoints (already configured in [apps/web/tailwind.config.ts](apps/web/tailwind.config.ts)):

| Tier    | Range        | Layout behaviour                                              |
|---------|--------------|---------------------------------------------------------------|
| Mobile  | < 768px      | Sidebar hidden, hamburger opens a slide-in drawer. Single column. |
| Tablet  | 768–1023px   | Sidebar collapsed to **icon rail** (64px). Content at full width. |
| Desktop | ≥ 1024px     | Sidebar expanded (240px) by default, user can collapse to rail.   |

User's collapse preference persisted in `localStorage` (`pm.sidebarCollapsed`).

## 1. Sidebar: collapsible + logo + mobile drawer

**File to refactor**: [apps/web/src/app/(app)/layout.tsx](apps/web/src/app/(app)/layout.tsx)

Split the current server component into:

- `AppLayout` (server) — reads user, renders `AppShell`.
- `AppShell` (new client component at `apps/web/src/components/layout/AppShell.tsx`) — holds collapsed/open state, renders `Sidebar` + `TopBar` + `<main>`.
- `Sidebar` (new at `apps/web/src/components/layout/Sidebar.tsx`) — three visual modes:
  1. **Expanded** (desktop default): 240px, logo + wordmark, full labels.
  2. **Rail** (tablet default, desktop opt-in): 64px, logo only, icon-only nav with tooltips on hover.
  3. **Drawer** (mobile): hidden off-canvas; slides in over a backdrop when the hamburger is tapped. Reuses the backdrop pattern already used by [ContactDrawer.tsx](apps/web/src/components/communication/ContactDrawer.tsx).
- `TopBar` (new at `apps/web/src/components/layout/TopBar.tsx`) — visible only `< md`. Contains hamburger button, small logo, current page title. Hidden on desktop.

Nav items stay in `NAV_ITEMS`, but each gains an `icon` (lucide-react is already implied by existing icon usage; if not installed, add it — otherwise inline tiny SVGs). Active route gets highlighted using `usePathname()`.

**Logo**: render [favicon.svg](apps/web/public/favicon.svg) via `next/image` at 28px in expanded mode (next to "Priority Manager" wordmark in `font-handwriting`), and alone at 32px in rail/mobile modes. No new asset needed; optionally rename to `logo.svg` for clarity.

**Collapse control**: a small chevron button at the bottom of the sidebar on desktop toggles rail ↔ expanded. Hamburger in `TopBar` opens drawer on mobile. `Esc` and backdrop-click close the drawer.

## 2. Page-level responsive rules

Apply a consistent page shell: `px-4 sm:px-6 md:px-8` and `max-w-screen-2xl mx-auto`. Headings use `text-2xl md:text-3xl`. Per-view specifics:

- **Daily Plan** [DailyPlanView.tsx](apps/web/src/components/daily-plan/DailyPlanView.tsx) — two-column (schedule / unscheduled) becomes stacked `< md`; unscheduled list collapses into an accordion above timeline on mobile.
- **Activities** [ActivitiesView.tsx](apps/web/src/components/activities/ActivitiesView.tsx) — bulk-edit bar becomes a sticky bottom sheet `< md` with a "More" overflow for secondary actions; cards already use `sm:flex-row`, keep that.
- **Calendar** [CalendarView.tsx](apps/web/src/components/calendar/CalendarView.tsx) + [MonthGrid.tsx](apps/web/src/components/calendar/MonthGrid.tsx) — below `md`, switch from month grid to an **agenda list** (day-by-day scroll of upcoming events). Above `md`, keep the 7-column grid with `min-h-[72px] md:min-h-[100px]`. Event chips truncate to time + first 12 chars on small cells.
- **Year at a Glance** — horizontally scrollable 12-month strip `< md` with snap points; grid remains on desktop.
- **Annual Strategies** [AnnualStrategiesView.tsx](apps/web/src/components/annual-strategies/AnnualStrategiesView.tsx) — already `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`; verify card internals wrap.
- **Monthly Priorities** — single column `< md`, two columns `md+`.
- **Project Planner** [ProjectList.tsx](apps/web/src/components/project/ProjectList.tsx) — filter chips become horizontally scrollable row `< md`; project cards stack metrics.
- **Meeting Planner** — list view on mobile; the side-by-side detail pane moves to a full-screen drawer on tap `< md`.
- **Communication Planner** [CommunicationPlannerView.tsx](apps/web/src/components/communication/CommunicationPlannerView.tsx) — contact grid goes `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`; [ContactDrawer.tsx](apps/web/src/components/communication/ContactDrawer.tsx) already mobile-friendly (`w-full max-w-md`).
- **Expense Record** [ExpenseRecordView.tsx](apps/web/src/components/expense-record/ExpenseRecordView.tsx) — summary strip wraps to 2×2 on mobile; filter panel becomes a bottom sheet triggered by a "Filters" button.
- **Settings** — section tabs become a `<select>` or stacked section list `< md`.

## 3. Shared primitives to add (minimal)

In `apps/web/src/components/ui/`:

- `MobileDrawer.tsx` — extracts the backdrop + slide-in pattern already inlined in [ContactDrawer.tsx](apps/web/src/components/communication/ContactDrawer.tsx). Reused by sidebar drawer and bottom-sheet filters.
- `useMediaQuery.ts` hook (one tiny file) — returns booleans for `isMobile`, `isTablet`. Used by calendar to swap grid↔agenda and by AppShell to pick the default sidebar mode.

No new UI library; keep custom components per existing pattern.

## 4. Modals — verify mobile behaviour

All modals ([GoalFormModal.tsx](apps/web/src/components/annual-strategies/GoalFormModal.tsx), `EditActivityModal`, `ExpenseFormModal`, `ContactFormModal`, `MeetingFormModal`, `PriorityFormModal`, `ProjectLinkModal`, `CalendarEventFormModal`) already use the `items-end sm:items-center` bottom-sheet-to-centered pattern. Audit each to ensure:

- Content scrolls inside the modal, not the page (`max-h-[90vh] overflow-y-auto`).
- Footer action buttons stay reachable (sticky footer inside the modal).
- Inputs are ≥ 16px font-size on mobile (prevents iOS zoom-on-focus).

## Files to modify

- [apps/web/src/app/(app)/layout.tsx](apps/web/src/app/(app)/layout.tsx) — slim to data fetch + `<AppShell>`.
- **New**: `apps/web/src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`.
- **New**: `apps/web/src/components/ui/MobileDrawer.tsx`, `apps/web/src/hooks/useMediaQuery.ts`.
- Each view listed in §2 — responsive class pass (no logic changes).
- [apps/web/src/app/globals.css](apps/web/src/app/globals.css) — add `html { -webkit-text-size-adjust: 100%; }` and safe-area padding utilities for iOS.
- Optionally copy [favicon.svg](apps/web/public/favicon.svg) → `apps/web/public/logo.svg` for semantic clarity.

## Out of scope

- Mobile (Expo) app — not touched.
- Dark mode — CLAUDE.md says light-only.
- New features or data model changes.
- Animation polish beyond the sidebar/drawer transitions.

## Verification

1. `pnpm --filter web dev` and walk every route at 375px (iPhone SE), 768px (iPad portrait), 1280px (laptop), 1920px (desktop) via Chrome DevTools device toolbar.
2. Sidebar: on desktop toggle rail ↔ expanded and confirm `localStorage` persists across reload. On mobile confirm hamburger opens drawer, backdrop + Esc close it, nav-link tap closes it.
3. Calendar: confirm month grid on desktop, agenda list on mobile.
4. Modals: open each modal on mobile viewport, confirm scroll + sticky footer, confirm input focus does not cause iOS zoom.
5. `pnpm --filter web typecheck` and `pnpm --filter web lint` clean.
6. If Playwright/RTL tests exist under [apps/web](apps/web/), run them; add a smoke test that renders `AppShell` at a mobile width and asserts sidebar is hidden until the hamburger is clicked.
