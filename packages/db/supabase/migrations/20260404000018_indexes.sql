-- Migration 018: additional composite indexes for common query patterns

-- Annual goals by section (Annual Strategies page loads by section)
create index idx_annual_goals_user_section
  on public.annual_goals (user_id, section, status);

-- Monthly priorities by month_key (default view = current month)
create index idx_monthly_priorities_user_month
  on public.monthly_priorities (user_id, month_key, section);

-- Calendar events by date range (month grid)
create index idx_calendar_events_user_date
  on public.calendar_events (user_id, date);

-- Meetings by date (upcoming meetings, meeting planner view)
create index idx_meetings_user_date
  on public.meetings (user_id, date, status);

-- Meetings by contact (Communication Planner: last 3 meetings per contact)
create index idx_meetings_contact
  on public.meetings (linked_contact_id, date desc);

-- Projects by status (Project Planner filter)
create index idx_projects_user_status
  on public.projects (user_id, status);

-- Contacts: active contacts only (soft-delete filter)
create index idx_contacts_active
  on public.contacts (user_id, full_name)
  where is_deleted = false;

-- Expenses by date (daily/weekly/monthly summaries)
create index idx_expenses_user_date
  on public.expenses (user_id, expense_date desc);

-- Reminder instances: unfired reminders (background job poll)
create index idx_reminder_instances_unfired
  on public.reminder_instances (user_id, scheduled_for)
  where fired_at is null and dismissed_at is null;
