-- Migration 014: expenses
-- Spec §10.8: daily expense tracker. Recurring expenses sync to calendar_events.

create table if not exists public.expenses (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references public.profiles(id) on delete cascade,
  title                text        not null,
  merchant_payee       text,
  amount               numeric(12, 2) not null check (amount >= 0),
  expense_date         date        not null,
  category             text        not null default 'other'
                       check (category in (
                         'personal', 'business', 'travel', 'food',
                         'transport', 'subscriptions', 'household', 'other'
                       )),
  payment_method       text,
  note                 text,
  linked_project_id    uuid        references public.projects(id) on delete set null,
  linked_contact_id    uuid        references public.contacts(id) on delete set null,
  linked_year_entry_id uuid        references public.year_entries(id) on delete set null,
  recurrence_rule      text
                       check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_expenses_user_date on public.expenses (user_id, expense_date);

comment on column public.expenses.recurrence_rule is 'Spec §10.8: recurring subscriptions/renewals must also create calendar_events.';
