# Priority Manager App — Full Product Design Document

## 1. Product overview

Priority Manager is a personal productivity app for **web, Android, and iOS**.

Its goal is to help one user manage life and work in one connected planning system that feels like a physical handwritten planner, while still behaving like a modern synced digital product.

The product combines:
- yearly planning
- calendar scheduling
- annual and monthly goal setting
- daily activities and daily planning
- communication memory
- expense tracking
- meeting planning
- project planning

The app should feel:
- intuitive
- elegant
- calm
- highly readable
- notebook-inspired
- lightweight in interaction, but deep in capability

This is a **personal productivity app**, not a team collaboration app and not a full enterprise project management tool.

---

## 2. Product goals

### Primary goals
- Help the user see yearly, monthly, and daily priorities in one connected system.
- Reduce planning fragmentation between tasks, meetings, projects, and personal life.
- Make daily execution easier through a structured day plan.
- Preserve historical record while preventing planning in the past.
- Keep all relevant data synced across features.
- Create a visually memorable planner experience with handwritten, paper-like UI.

### Secondary goals
- Support travel planning, renewals, and recurring meetings.
- Help users remember meeting context and people context.
- Track time-based project progress and selected expenses.
- Work across devices with real-time sync and offline-first tolerance.

---

## 3. Product principles

1. **One source of truth per object**  
   Avoid duplicate records across tabs. Features should display shared data, not create disconnected copies.

2. **Time should behave strictly**  
   The app must not allow new meetings, activities, or daily plan scheduling in the past.

3. **Past records should remain visible**  
   Past daily plans and meetings should remain available as historical record.

4. **Editing permissions depend on time context**  
   Future and current items are editable. Past items have restricted editing.

5. **Strategy should flow into execution**  
   Annual goals connect to monthly priorities and projects; projects connect to activities and daily planning.

6. **UI should feel like a premium handwritten planner**  
   Stylish, calm, highly legible, modern, but inspired by physical planning.

7. **Mobile responsiveness is not optional**  
   All screens, not just the menu, must adapt gracefully for mobile.

---

## 4. Target user

### Core user
A single personal user who wants to manage:
- business/work priorities
- personal tasks
- schedules
- trips
- meetings
- people notes
- projects
- expenses

This user values:
- structure
- visibility
- calm planning
- daily control
- long-range planning
- elegant UI

---

## 5. Platforms

- Web app
- Android app
- iOS app

### Platform behavior requirements
- Real-time sync across devices
- Offline usage support
- When offline, store actions locally and sync once online

---

## 6. Authentication

Support:
- Email login
- Google sign-in
- Apple sign-in

---

## 7. Design system and UI direction

## 7.1 Visual direction
The app should look like a high-quality physical planner/notebook with a modern digital finish.

### Core visual characteristics
- white paper background
- blue color scheme
- handwritten / cursive style feel
- notebook-inspired layout
- clear sectioning
- elegant cards
- readable typography
- minimal heavy shadows
- soft separators, structured spacing

### Light mode only
- No dark mode for v1

## 7.2 Typography
Primary font direction:
- Patrick Hand or similar handwriting-style font

Typography must remain highly readable. Use handwriting-inspired display and labels carefully so usability does not suffer.

### Recommended typography strategy
- Handwritten-style font for headings, day labels, planner accents, key entry labels
- Very readable complementary sans-serif for dense body text, forms, longer notes, tables, numbers, and summaries

This preserves the aesthetic while keeping data dense screens usable.

## 7.3 UI improvements recommended
- Increase font size across all screens for readability
- Use stronger text contrast; avoid text that is too light
- Increase sidebar text size and letter spacing
- Reduce oversized button shadows
- Use elegant chips, pills, and compact cards instead of heavy dropdown styling
- Use modern custom date and time pickers rather than browser-default inputs
- Make all interactive states clearly visible
- Ensure hover states do not make text invisible

## 7.4 Responsive behavior
- Fully responsive layouts for all screens
- Sidebar must remain recoverable on mobile when collapsed
- On mobile, use drawers/bottom sheets/popups where needed
- Keep month grids compact and readable
- Daily Plan should remain scrollable and practical on mobile

---

## 8. Information architecture

Main navigation:
1. Daily Plan (default home screen)
2. Activities
3. Calendar
4. Year at a Glance
5. Annual Strategies
6. Monthly Priorities
7. Project Planner
8. Meeting Planner
9. Communication Planner
10. Expense Record

### Default landing page
The app must open directly to **Daily Plan**.  
Do not open Year at a Glance first and then redirect.

---

## 9. Shared data architecture

To avoid sync problems, use a shared data model.

### Core entities
- User
- AwayEntry / YearEntry
- CalendarEvent
- AnnualGoal
- MonthlyPriority
- Project
- ProjectMilestone
- ProjectResource
- Activity
- ScheduleInstance
- Contact
- Meeting
- Expense
- NotificationPreference
- ReminderInstance

### Important architecture rule
**Activities tab, Daily Plan, and Project Planner must all reference the same underlying activity records.**

### Scheduling rule
Use a separate **ScheduleInstance** model so one activity can:
- exist unscheduled
- have part of its work scheduled today
- have remaining effort unscheduled
- keep historical scheduled blocks after completion or postponement

### Benefits
This solves:
- partial scheduling
- historical record retention
- project progress by completed hours
- daily plan history
- activity sync across tabs

---

## 10. Feature specifications

# 10.1 Year at a Glance

## Purpose
High-level yearly view for:
- vacations / travel / away periods
- birthdays

## Scope
This screen is only for:
- vacations/travel/away entries
- birthdays

## Entry types
- single-day entries
- date-range entries

## Fields
Each yearly entry can include:
- title
- type/category
- start date
- end date
- location
- note
- availability status

## Behavior
- Fully editable from the yearly screen
- Birthdays should sync into Calendar without duplicate data creation
- Travel/away periods should be visible in Calendar
- When scheduling meetings during an away period, show a warning but allow override

## Travel-linked planning
When a user creates a travel/away entry, offer:
1. Mark as away only
2. Create linked trip plan

### Linked trip plan behavior
If chosen, auto-create a lightweight trip-linked project or travel plan that can hold:
- flight boarding
- hotel check-in
- visit locations
- errands
- travel-related activities

Those linked items may appear in:
- Activities
- Daily Plan
- Calendar if time-based

## UX recommendations included
- Show full year in 12 compact month cards
- Color-code entry categories
- Show compact availability state
- Allow inline editing from yearly view

---

# 10.2 Calendar

## Purpose
The central scheduling layer for timed events.

## View
- Month grid layout
- Show names of days
- Notebook-inspired calendar layout
- Handwritten/cursive styling for entries where practical
- Short summaries in day cells
- Full details shown in popup

## Supported event types
- meeting
- appointment
- birthday
- renewal/subscription
- other timed event
- away/travel context shown from Year at a Glance

## Data rule
Birthdays are synced from Year at a Glance.  
Do not create duplicate birthday records inside Calendar.

## Fields
Calendar entries can include:
- title
- type
- date
- start time
- end time or duration
- linked contact
- linked project
- location
- notes
- recurrence
- status

## Popup behavior
On click:
- view details first
- edit option within the same popup

## Recurrence support
- daily
- weekly
- monthly

## Bottom monthly notes area
At the bottom of the month screen:
- free notes for the month

## Sync behavior
- Meetings created in Calendar auto-create linked Meeting records
- Prompt user to add agenda/details after meeting creation
- Calendar meetings must sync with Meeting Planner
- Deleting a meeting/appointment from Calendar should remove its linked meeting planner record where applicable

## Time rules
- Past meetings/appointments should be treated as completed or prompt for update depending on meeting behavior
- New timed events cannot be created in the past
- Away periods should warn before booking

## UX recommendations included
- event badges/icons by type
- recurring renewal visibility
- quick actions: edit, delete, reschedule, mark complete, open linked details
- mobile-friendly bottom sheet popup

---

# 10.3 Annual Strategies

## Purpose
Yearly outcome-based planning layer.

## Sections
Exactly 3 sections:
- Business
- Career
- Personal

## Fields
Each annual strategy can have:
- title
- category
- description
- why it matters
- target date
- progress %
- status
- linked project
- notes

## Progress model
Progress is **manual** because these goals are outcome-based.

### Future-friendly note
Architecture may later support project-assisted progress suggestions, but manual remains the source of truth in v1.

## Status options
- not started
- active
- on track
- at risk
- completed
- dropped

## Connections
Annual strategies connect to:
- Monthly Priorities
- Projects

Activities should remain visible only inside projects, not directly under Annual Strategies.

## UX recommendations included
- strategy cards instead of plain list
- compact “why this matters” preview
- quarterly checkpoint support optional
- linked project preview
- monthly alignment hint when no current month priority exists
- archive completed/dropped goals from default active view

---

# 10.4 Monthly Priorities

## Purpose
Bridge between annual strategy and execution.

## Sections
Only 2 sections:
- Business/Career
- Personal

## Limits
Hard block: only **3–5 priorities per section**.

## Fields
Each monthly priority includes:
- title
- category
- started date
- assigned date
- target completion date
- linked annual strategy
- linked project
- progress
- status
- note / “why this matters this month”

## Progress model
- Auto from linked project when linked
- Manual when not linked

## Status options
- planned
- in progress
- on hold
- completed
- dropped

## Carry-forward logic
- allow carry forward to next month
- only if linked project is still **in progress**
- must ask user permission before carrying forward

## View behavior
- Current month shown by default
- Next/previous month navigation
- Status updates should happen inline via dropdown, not popup

## UX recommendations included
- section counter such as `3/5 used`
- pin one top priority per section
- project progress chip
- stale indicator for no recent progress
- month-end review flow: complete / carry forward / drop / rewrite

---

# 10.5 Activities

## Purpose
The daily command center for activity capture and daily work organization.

## Sections
Each activity belongs to exactly one section:
- Work
- Outside
- Delegated
- Unplanned / Sudden

No multiple tags.

## Definitions
### A priority
Must happen today and cannot be postponed.
- hard maximum: 3

### B priority
Should happen today but can be moved if needed.

## Fields
Each activity includes:
- title
- section/type
- priority (A/B/none)
- date
- estimated duration
- status
- linked project
- note
- delegated to
- scheduled start time
- scheduled end time
- focus hours
- moved from / moved to history

## Status options
- not started
- working
- completed
- postponed
- delegated
- cancelled

## Contact linkage
Delegated activities should connect to contacts from Communication Planner.

## Project linkage rules
- Work activities: linked project required
- Other activity types: linked project optional

## Priority rules
- Hard block if A priorities exceed 3
- Warn if total A workload exceeds realistic daily capacity

## Unplanned activities
- Stay in their own separate section

## Rescheduling history
Keep movement history:
- originally planned date
- moved to date

## Sync rules
- Activities created from Project Planner must sync here
- Activities added here and linked to a project must sync back to project
- Project name must display properly and be clickable
- Clicking project name opens project details
- Deleting a project removes linked activities

## UX recommendations included
- Quick Add and Full Add modes
- section headers with total items, total time, completed count
- visual distinction for A/B priorities
- unscheduled indicator
- inline quick actions: complete, schedule, move, postpone, open details
- clear distinction between estimated duration and focus hours
- carry-forward panel for yesterday’s tasks
- preserve previous values correctly during editing
- desktop layout should place status, project name, estimated time to the right rather than stacking vertically
- modern activity card design

---

# 10.6 Daily Plan

## Purpose
The main execution screen and default home screen.

## Structure
- Single-day view
- Only scheduled items appear on the timeline
- Unscheduled items appear in a separate list on the same screen

## Default behavior
- App opens here by default

## Timeline rules
- 15-minute slots
- exact scheduling allowed, including times such as 6:30
- drag-and-drop scheduling supported
- modal-based scheduling/editing comes first in v1 for reliability

## Scheduled activity block displays
- title
- project name
- focus duration
- status
- priority badge

## Scheduled meeting block displays
- title
- contact name
- start–end time
- completed/upcoming state

## Partial scheduling
If only part of an activity is scheduled today:
- scheduled portion appears on timeline
- remaining effort stays pending
- remaining portion also appears in unscheduled list

## Time rules
- No new scheduling in the past
- Clicking a past empty time slot must not allow scheduling
- Occupied slot click should open existing item edit/reschedule flow, not create a second overlapping item
- Locked slot should prevent additional activity scheduling
- Existing scheduled item should still be editable

## Focus duration rules
When planning an activity, ask user how much time to focus on it.
- focus duration must be less than or equal to the activity’s remaining estimated time
- lock that many hours/minutes on the daily timeline
- allow editing of the scheduled block later

## Rescheduling and movement
- upcoming scheduled activities remain editable/reschedulable
- allow user to move scheduled item back to unscheduled without full edit modal
- allow user to move previous day’s activities to another day
- the move feature should apply to all yesterday’s activities, scheduled and unscheduled

## Current time behavior
- show current time progress line
- precision need not be exact to the minute; placement within 30-minute range is acceptable
- today’s timeline should visually reflect approximate current position

## Status prompts after time passes
Once the scheduled time passes, notify user to update status:
- completed
- postponed
- working
- move to another day

For meetings, also prompt for takeaway update.

Even after status update, the scheduled instance remains visible in Daily Plan as historical record.

## Sync behavior
- Meetings and activities share timeline
- meeting creation from Meeting Planner syncs to Calendar and Daily Plan
- calendar events that are meetings sync here
- activity status updates from Daily Plan sync back to Activities and Project Planner

## UX recommendations included
- current time strip with next scheduled item
- grouped unscheduled sections by activity type
- schedule suggestions for available time blocks
- quick actions on scheduled blocks: edit, reschedule, move back to unscheduled, mark complete
- carry-forward tray for yesterday’s unfinished items
- daily capacity summary
- mobile timeline centered around current time when opening today
- project name visible on scheduled activity block
- focus goal/duration positioned to the right rather than stacked under title on larger layouts

---

# 10.7 Communication Planner

## Purpose
Lightweight relationship memory layer.

## Contact fields
Each contact can include:
- full name
- company/organization
- role/title
- phone
- email
- note

## Organization
Contacts should be filterable by categories such as:
- personal
- professional
- family
- client
- vendor
- other

## Notes
- one rolling note per contact

## Person card content
Each person card should show:
1. next meeting info/reference
2. list of last 3 meeting references
3. note
4. delegated items count or mini-list

## Meeting display rule
Instead of showing full agenda/takeaways inline, show meeting references/links that can be clicked to open meeting details.

## Meeting popup rules
- popup with edit options
- for past meetings, only conclusion/key takeaway editable
- all other meeting fields read-only

## Delegated activities
Delegated activities linked to a contact should appear on that person’s card.

## Search
Search should support:
- name
- company
- email
- note text

## Delete contact behavior
Do not delete historical records by default.

When deleting a contact, provide safer options such as:
1. delete contact only, keep historical records
2. unlink related records but preserve history

Do not auto-delete past meetings and historical activity records by default.

## UX recommendations included
- compact card design with strong scanability
- next meeting visually prioritized
- empty-state prompts
- quick actions: schedule meeting, add delegated activity, edit contact, open details
- relationship freshness indicator
- search + filter + sort combination
- compact detail popup/drawer instead of full-page detail view for v1

---

# 10.8 Expense Record

## Purpose
A daily expense tracker, not a full accounting system.

## Fields
Each expense can include:
- title
- merchant/payee
- amount
- date
- category
- payment method
- note
- linked project
- linked contact
- linked travel entry
- recurring settings where applicable

## Categories
Default categories:
- personal
- business
- travel
- food
- transport
- subscriptions
- household
- other

## Recurring support
Recurring expenses are supported for:
- subscriptions
- renewals

These recurring items should sync into Calendar.

## Summary
Show:
- total today
- total this week
- total this month

## Linking
Expenses can link to:
- projects
- contacts
- trips/travel entries

## Attachments
Skip receipts/images for v1.

## UX recommendations included
- daily quick-add bar
- smart defaults for date and frequently used category/payment method
- card-based daily list
- monthly summary strip
- upcoming recurring payment preview
- filters by category, project, trip, payment method, date range
- project/travel spend visibility
- safe recurring edit flow: this occurrence vs future occurrences

---

# 10.9 Meeting Planner

## Purpose
Structured planning and recording layer for meetings.

## Core fields
- title
- linked contact
- date
- start time
- end time / duration
- agenda
- key takeaways
- recurrence
- linked calendar event
- status

## Content model
Only 2 content fields:
- agenda
- key takeaways

## Required fields
A meeting must require:
- linked contact
- date
- time
- duration

## Contact model
- one contact only for v1

## Recurrence
- daily
- weekly
- monthly

## Completion behavior
When a meeting is marked complete, prompt the user to add key takeaways if empty.

## Past/missed behavior
When meeting time has passed, prompt user to classify/update rather than silently auto-finalizing.

## Editing rules
- future meetings: editable
- past meetings: only key takeaways editable

## Sync rules
- Meeting creation must work consistently from Calendar, Communication Planner, or Meeting Planner
- All routes create the same shared meeting record
- Meetings created in Calendar auto-create linked Meeting records
- Meetings scheduled from Meeting Planner sync to Calendar
- Meeting contact must be selected from Communication Planner contacts only
- Meetings should be visible from the linked contact card
- Recurring meetings must sync to Calendar

## UX recommendations included
- compact meeting cards
- “needs takeaway” indicator
- post-meeting prompt flow
- linked contact snippet in meeting popup
- recurring edit choice: this meeting vs future meetings
- better empty states

---

# 10.10 Project Planner

## Purpose
Structured work container for project-level execution.

## Project fields
Each project can include:
- name
- description
- status
- start date
- target end date
- linked annual strategy
- linked monthly priority
- resources needed
- notes
- milestone list

## Activity/task model
Project tasks should use the same shared activity model as the Activities tab.

## Progress model
Primary project progress is calculated by:
- completed hours / total estimated hours

## Milestones
Milestones are allowed as a **secondary visibility layer**, not the primary progress engine in v1.

### Recommended milestone role
- major checkpoints
- status visibility
- motivation
- reporting

## Project metrics
Show:
- total tasks
- completed tasks
- total estimated hours
- completed hours
- progress

## Project statuses
Recommended:
- planned
- in progress
- on hold
- completed
- cancelled

## Filters
Projects should be filterable by:
- status
- linked annual strategy
- linked monthly priority
- date

## Delete flow
Provide:
- delete project and all linked activities
- cancel

## Resources
Resources are often:
- money
- employees
- hiring
- tools/software
- other practical dependencies

### Recommended resource model
Use a lightweight structured resource list.

Each resource item can include:
- resource type
- title
- description/note
- estimated cost optional
- status
- owner/assigned person optional
- needed by date optional

### Suggested resource types
- budget / money
- employee / team member
- contractor / freelancer
- new hire
- tool / software
- equipment
- other

### Suggested resource statuses
- needed
- requested
- approved
- acquired
- delayed
- cancelled

## Sync rules
- adding a dated project activity should populate Activities for that day
- changes in Activities sync to Project Planner
- changes in Project Planner sync to Activities
- Daily Plan completion/status updates also sync through the same activity record

## UX recommendations included
- strong project cards showing status, progress, hours, linked strategy/priority, next upcoming task
- project detail sections: Overview, Activities, Resources, Milestones, Notes
- quick add activity from project
- progress explanation text
- risk flag for overdue/no-progress/missing-resource scenarios
- budget summary potential based on resources and linked expenses
- more elegant status UI instead of plain checkbox treatment

---

## 11. Global sync rules

## 11.1 Core sync principles
All relevant features must stay synced through shared records.

### Required sync examples
- Birthday in Year at a Glance → visible in Calendar
- Meeting created in Calendar → Meeting Planner record auto-created
- Meeting created in Meeting Planner → synced to Calendar and Daily Plan
- Linked meeting → visible in Communication Planner under contact
- Activity created in Project Planner → visible in Activities for assigned date
- Activity edited in Activities → updates Project Planner
- Activity status updated in Daily Plan → syncs to Activities and Project Planner
- Recurring subscriptions/renewals in Expense Record → visible in Calendar
- Travel/away entries → shown in Calendar, influence meeting warnings, can create travel-linked project/tasks

## 11.2 Avoid duplicate records
Never create multiple independent copies of the same logical item for different tabs.

---

## 12. Time and permission rules

## 12.1 Past rules
Do not allow creation of:
- activities in the past
- daily plan schedule blocks in the past
- meetings in the past

## 12.2 Visibility rules
Past items remain visible for historical record.

### Examples
- Past daily plans visible
- Past scheduled blocks visible
- Past meetings visible

## 12.3 Editability rules
### Past meetings
Only key takeaways editable.

### Past daily plan
Visible, but new scheduling not allowed.

### Past scheduled instances
Kept as record.

## 12.4 Completion rules
- meetings and appointments that have passed should be treated as completed or prompt for classification depending on type
- past timed meeting flows should prompt for takeaway/status

---

## 13. Notifications and reminders

## User-configurable reminder behavior
The app should ask the user to define preferred end-of-day review time.

### Required notification types
- End-of-day reminder for reviewing the day, rescheduling incomplete items, and updating status
- Upcoming meeting reminder
- Meeting time passed reminder to update status and add takeaway
- Subscription/renewal reminder
- Birthday reminder
- Travel upcoming reminder
- Daily morning summary

## Suggested notification behavior
### End-of-day review reminder
User-configurable time, such as 9 PM by preference.

Prompt should help the user:
- review unfinished activities
- move incomplete items
- update statuses
- check overdue meetings/takeaways

### Meeting after-time reminder
If a meeting time has passed:
- prompt user to update status
- prompt for key takeaways if empty

---

## 14. Offline-first behavior

## Requirements
- App should continue functioning offline
- Actions should be stored locally
- Once online, changes should sync automatically

## Recommended implementation behavior
- local cache/store per platform
- optimistic local updates
- background sync queue
- conflict resolution using last-write-wins for low-risk fields and record-version checks for sensitive edits

For v1, keep conflict handling simple but predictable.

---

## 15. Export features

Support export for:
- PDF daily plan
- CSV expenses
- project summary export

Future export targets may include monthly and annual summary PDFs.

---

## 16. UX patterns and component rules

## 16.1 Sidebar
- left sidebar collapsible
- use planner icon already in design, not hamburger replacement
- font size larger and more spacious
- date text at bottom must be readable
- sidebar must remain recoverable on mobile when collapsed

## 16.2 Buttons
- reduce heavy long shadows
- use cleaner modern elevation

## 16.3 Date picker and time picker
Need elegant, modern, custom-styled pickers across:
- Activities
- Daily Plan
- Meeting Planner
- Calendar date jumps
- move/reschedule flows

## 16.4 Status controls
Replace crude dropdown feel where possible with:
- segmented chips
- elegant dropdowns
- pills/buttons with clear states

## 16.5 Popups and drawers
Use popups/drawers/bottom sheets for:
- viewing details
- quick edit
- meeting details
- calendar event details
- person/contact detail
- activity edit

---

## 17. Data model sketch

This is a practical schema direction for Claude Code.

## 17.1 User
- id
- name
- email
- auth_provider
- timezone
- eod_review_time
- created_at
- updated_at

## 17.2 YearEntry
- id
- user_id
- type (travel, away, birthday)
- title
- start_date
- end_date nullable
- location nullable
- note nullable
- availability_status nullable
- create_linked_trip_plan boolean
- linked_project_id nullable
- created_at
- updated_at

## 17.3 CalendarEvent
- id
- user_id
- event_type
- title
- date
- start_at nullable
- end_at nullable
- duration_minutes nullable
- linked_contact_id nullable
- linked_project_id nullable
- linked_meeting_id nullable
- linked_year_entry_id nullable
- location nullable
- notes nullable
- recurrence_rule nullable
- status
- source_type
- created_at
- updated_at

## 17.4 AnnualGoal
- id
- user_id
- section (business, career, personal)
- title
- description
- why_it_matters
- target_date nullable
- progress_percent
- status
- notes nullable
- created_at
- updated_at

## 17.5 MonthlyPriority
- id
- user_id
- section (business_career, personal)
- title
- category nullable
- started_date nullable
- assigned_date nullable
- target_date nullable
- linked_annual_goal_id nullable
- linked_project_id nullable
- progress_mode (manual, auto_project)
- manual_progress_percent nullable
- status
- note nullable
- pinned boolean
- month_key
- created_at
- updated_at

## 17.6 Project
- id
- user_id
- name
- description nullable
- status
- start_date nullable
- target_end_date nullable
- linked_annual_goal_id nullable
- linked_monthly_priority_id nullable
- notes nullable
- created_at
- updated_at

## 17.7 ProjectMilestone
- id
- project_id
- title
- target_date nullable
- status
- created_at
- updated_at

## 17.8 ProjectResource
- id
- project_id
- resource_type
- title
- note nullable
- estimated_cost nullable
- status
- assigned_contact_id nullable
- needed_by_date nullable
- created_at
- updated_at

## 17.9 Contact
- id
- user_id
- category
- full_name
- company nullable
- role nullable
- phone nullable
- email nullable
- note nullable
- is_deleted boolean default false
- created_at
- updated_at

## 17.10 Meeting
- id
- user_id
- linked_contact_id
- linked_calendar_event_id nullable
- title
- date
- start_at
- end_at
- duration_minutes
- agenda
- key_takeaways nullable
- recurrence_rule nullable
- status
- created_at
- updated_at

## 17.11 Activity
- id
- user_id
- section_type (work, outside, delegated, unplanned)
- title
- priority nullable
- activity_date
- estimated_minutes
- remaining_minutes
- status
- linked_project_id nullable
- delegated_contact_id nullable
- note nullable
- origin_type nullable
- moved_from_date nullable
- created_at
- updated_at

## 17.12 ScheduleInstance
- id
- user_id
- source_type (activity, meeting, appointment, other)
- source_id
- schedule_date
- start_at
- end_at
- locked_minutes
- focus_minutes nullable
- status_snapshot nullable
- keep_as_history boolean
- created_at
- updated_at

## 17.13 Expense
- id
- user_id
- title
- merchant_payee nullable
- amount
- expense_date
- category
- payment_method nullable
- note nullable
- linked_project_id nullable
- linked_contact_id nullable
- linked_year_entry_id nullable
- recurrence_rule nullable
- created_at
- updated_at

## 17.14 ReminderPreference / ReminderInstance
Can be modeled either as user settings plus generated reminders, or using your chosen notification service directly.

---

## 18. Key logic flows

## 18.1 Creating a meeting from Calendar
1. User selects date/time
2. Chooses event type = meeting
3. Selects contact from Communication Planner
4. Enters title, date, time, duration, agenda
5. System creates CalendarEvent
6. System creates linked Meeting
7. System creates ScheduleInstance for Daily Plan
8. Contact card reflects linked meeting

## 18.2 Creating an activity from Project Planner
1. User opens project
2. Adds activity with date and estimated time
3. System creates Activity linked to project
4. Activity appears in Activities on assigned day
5. User may later schedule portion into Daily Plan

## 18.3 Scheduling activity into Daily Plan
1. User opens unscheduled activity
2. Selects date/time and focus duration
3. System validates not in past, not overlapping, focus <= remaining duration
4. System creates ScheduleInstance
5. Timeline updates
6. Remaining unscheduled portion stays visible if any

## 18.4 Time passed for meeting/activity
1. System detects scheduled end time passed
2. User receives notification
3. User updates status
4. For meetings, user prompted for takeaways
5. Historical scheduled block remains on Daily Plan

## 18.5 Travel entry with linked plan
1. User creates YearEntry for travel/away
2. User chooses “create linked trip plan”
3. System creates lightweight project/travel plan
4. User may add related tasks and timed items
5. Calendar shows away period and related warnings

---

## 19. Suggested technical product direction for Claude Code

Since this needs web + Android + iOS with real-time sync and offline behavior, a practical product architecture would be:

### Recommended app approach
- One shared backend + shared database
- One web frontend
- One cross-platform mobile app

### Suggested stack direction
- **Frontend web:** Next.js or React-based app
- **Mobile:** React Native with Expo
- **Backend/API:** Supabase or Firebase-backed approach, or custom backend with Postgres
- **Database:** Postgres preferred if using relational linking heavily
- **Auth:** Google, Apple, email auth
- **Realtime sync:** Supabase Realtime / Firebase / websocket-based sync layer
- **Offline support:** local persistence + sync queue

### Why this suits the app
This product has many linked relational objects:
- projects → activities
- contacts → meetings → calendar
- year entries → calendar
- schedule instances → activities/meetings
- expenses → project/trip/contact

A relational database model is a strong fit.

---

## 20. Recommended build phases

## Phase 1 — Core planning foundation
Build first:
1. Authentication
2. Daily Plan
3. Activities
4. Calendar
5. Meeting Planner
6. Communication Planner
7. Shared sync/data architecture

Reason: these create the daily execution core.

## Phase 2 — Strategy and project layers
8. Project Planner
9. Monthly Priorities
10. Annual Strategies
11. Year at a Glance with linked travel plan

## Phase 3 — Supporting systems
12. Expense Record
13. notifications/reminders refinement
14. export features
15. deeper offline polish
16. milestone/resource enhancements

---

## 21. Acceptance rules / non-negotiables

- Daily Plan must be the default home screen
- No new activity, schedule block, or meeting in the past
- Past plans and meetings remain visible as record
- Past meetings: only takeaway editable
- Activities, Daily Plan, and Project Planner must share the same activity source of truth
- Recurring meetings must sync to Calendar
- Recurring renewals/subscriptions must sync to Calendar
- Birthday must sync from Year at a Glance to Calendar without duplicate data
- Calendar event click opens popup, not forced navigation
- Contact-linked meetings and delegated activities must reflect in Communication Planner
- Mobile responsiveness must apply to all screens
- Sidebar must remain usable on mobile
- UI text contrast and size must be improved globally for readability

---

## 22. Risks to avoid

1. Duplicate records across modules
2. Overcomplicated UI with too many stacked details
3. Browser-default date/time pickers ruining polish
4. Weak mobile adaptation
5. Activity/project sync failures
6. Contact deletion destroying historical records
7. Past/future permission bugs
8. Schedule overlap bugs
9. Resetting user values during edit flows
10. Using only handwriting font everywhere and harming readability

---

## 23. Final product summary

Priority Manager should feel like a premium digital planner for one person.

It should combine:
- yearly away planning
- calendar scheduling
- annual strategy
- monthly focus
- daily activities
- daily execution timeline
- meetings and people memory
- project tracking
- personal expense logging

The key product advantage is not any one screen, but the way all screens stay meaningfully connected.

The best implementation strategy is to build it around:
- one shared activity model
- one shared meeting model
- one calendar event layer
- one schedule-instance layer for timed planning

This foundation will make the rest of the product stable, elegant, and scalable.

