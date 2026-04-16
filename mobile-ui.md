# Mobile UI Restructure Plan — Match Web Small-Screen Layout

## Context

The web app has a polished responsive layout for small screens: sidebar hidden behind a hamburger-triggered drawer, with a persistent TopBar. The mobile app currently uses 5 bottom tabs (Daily Plan, Activities, Calendar, Meetings, More), which doesn't match this pattern. The user wants to reduce to 2 bottom tabs (Daily Plan, Activities) and move everything else into a collapsible sidebar/drawer — mirroring the web's mobile experience.

## Navigation Architecture Change

**Current mobile tabs:** Daily Plan, Activities, Calendar, Meeting Planner, More  
**Target mobile tabs:** Daily Plan, Activities  
**Moved to drawer:** Calendar, Year at a Glance, Annual Strategies, Monthly Priorities, Project Planner, Meeting Planner, Communication Planner, Expense Record, Settings

### File structure changes

- **Move** `app/(tabs)/calendar.tsx` → `app/calendar.tsx`
- **Move** `app/(tabs)/meeting-planner.tsx` → `app/meeting-planner.tsx`
- **Delete** `app/(tabs)/more.tsx` (replaced by drawer)
- Tab layout keeps only `daily-plan` and `activities`

## New Components (4 files)

### 1. `DrawerProvider` — `apps/mobile/src/components/providers/DrawerProvider.tsx`
Simple React context managing `isDrawerOpen`, `openDrawer()`, `closeDrawer()`. Placed inside AuthProvider in root layout.

### 2. `NavIcons` — `apps/mobile/src/components/layout/NavIcons.tsx`
Translate the 11 inline SVGs from `apps/web/src/components/layout/Sidebar.tsx` (lines 10-112) to `react-native-svg` components. Each icon accepts `color` prop, renders at 20x20.

### 3. `TopBar` — `apps/mobile/src/components/layout/TopBar.tsx`
Persistent header bar (56dp height) matching web's TopBar:
- Left: hamburger button → calls `openDrawer()`
- Center-left: logo image + "Priority Manager" in Patrick Hand font
- Background: white, bottom border `colors.blue[100]`
- Rendered via tab layout's `header` prop (no per-screen changes needed)

### 4. `AppDrawer` — `apps/mobile/src/components/layout/AppDrawer.tsx`
Animated slide-in drawer using `react-native-reanimated` + `react-native-gesture-handler`:
- **Width:** 280dp (matches web's `max-w-[280px]`)
- **Animation:** Slide from left with `withTiming`, backdrop fades in (`rgba(0,0,0,0.3)`)
- **Swipe-to-close:** PanGesture handler for native feel
- **Structure mirrors web Sidebar in drawer mode:**
  - Header: Logo + "Priority Manager" + close (X) button
  - Nav list (ScrollView): 9 items with icons, active route highlighted (`blue-50` bg, `blue-700` text)
  - Footer: User name, email, date, sign-out button
- Uses `usePathname()` for active route detection
- Calls `router.push()` + `closeDrawer()` on item tap

## Modified Files (4 files)

### 5. `app/(tabs)/_layout.tsx`
- Remove Calendar, Meeting Planner, More tab screens
- Keep only `daily-plan` and `activities`
- Add TopBar as custom header via `screenOptions.header`

### 6. `app/_layout.tsx`
- Wrap content with `DrawerProvider`
- Add `AppDrawer` as overlay sibling to Stack navigator
- Register `calendar` and `meeting-planner` as Stack.Screen entries

### 7. `app/(tabs)/daily-plan.tsx`
- Change `SafeAreaView edges={['top']}` → `edges={['bottom']}` (TopBar handles top safe area)

### 8. `app/(tabs)/activities.tsx`
- Same SafeAreaView edges change

## Visual Consistency with Web

| Element | Web | Mobile RN |
|---|---|---|
| Drawer width | `w-72` (288px) | `280` |
| Nav active | `bg-blue-50 text-blue-700` | `colors.blue[50]`, `colors.blue[700]` |
| Nav inactive | `text-ink-light` | `colors.ink.light` (#4A4A6A) |
| Branding font | `font-handwriting text-xl` | `PatrickHand, fontSize: 20` |
| TopBar height | `h-14` (56px) | `56` |
| Backdrop | `bg-black/30` | `rgba(0,0,0,0.3)` |
| Footer border | `border-t border-blue-100` | `borderTopWidth: 1, borderTopColor: colors.blue[100]` |

## Implementation Order

1. Create `DrawerProvider`
2. Create `NavIcons` (translate SVGs from web Sidebar)
3. Create `TopBar`
4. Create `AppDrawer`
5. Move `calendar.tsx` and `meeting-planner.tsx` out of `(tabs)/`
6. Delete `more.tsx`
7. Modify `(tabs)/_layout.tsx` — 2 tabs + TopBar header
8. Modify `_layout.tsx` — add DrawerProvider + AppDrawer
9. Fix SafeAreaView edges in `daily-plan.tsx` and `activities.tsx`

## Dependencies

All required libraries already installed:
- `react-native-gesture-handler` ~2.30.0
- `react-native-reanimated` ~4.2.1
- `react-native-safe-area-context` ^5.6.2
- `GestureHandlerRootView` already wraps app in `_layout.tsx`
- May need: `expo install react-native-svg` for nav icons (ships with Expo but may need explicit install)

## Verification

1. `pnpm --filter mobile start` — launch Expo dev server
2. Confirm only 2 bottom tabs visible (Daily Plan, Activities)
3. Tap hamburger → drawer slides in from left with all 9 nav items
4. Tap a drawer item → navigates to correct screen, drawer closes
5. Active route highlighted in drawer
6. Swipe left on drawer → closes
7. Tap backdrop → closes
8. Drawer footer shows user info + sign out
9. Back gesture / hardware back from drawer screens returns to tabs
10. No double safe-area padding on any screen
