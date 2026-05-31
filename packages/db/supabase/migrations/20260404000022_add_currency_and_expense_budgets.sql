-- Migration 022: app-wide display currency + per-month expense budgets
-- Spec §10.8 (expenses): a single user-level display currency preference
-- (amounts are re-labeled, never converted) and a per-calendar-month budget limit.

-- 1. App-wide display currency on reminder_preferences (one row per user).
alter table public.reminder_preferences
  add column if not exists currency_code text not null default 'USD';

comment on column public.reminder_preferences.currency_code is
  'ISO 4217 code (e.g. ''USD''). App-wide display currency; amounts are re-labeled, never converted.';

-- 2. Per-month expense budgets (one budget amount per YYYY-MM per user).
create table if not exists public.expense_budgets (
  id         uuid           primary key default gen_random_uuid(),
  user_id    uuid           not null references public.profiles(id) on delete cascade,
  month      text           not null,
  amount     numeric(12, 2) not null default 0 check (amount >= 0),
  created_at timestamptz    not null default now(),
  updated_at timestamptz    not null default now(),
  unique (user_id, month)
);

create index idx_expense_budgets_user_month on public.expense_budgets (user_id, month);

comment on table public.expense_budgets is 'Spec §10.8: per-calendar-month (YYYY-MM) spending budget limit per user.';
comment on column public.expense_budgets.month is 'Calendar month key in YYYY-MM format.';

-- updated_at maintenance (same trigger function as all other tables, see migration 017).
create or replace trigger trg_expense_budgets_updated_at
  before update on public.expense_budgets
  for each row execute function public.set_updated_at();

-- Row level security: owner-only access (matches migration 016 policy style).
alter table public.expense_budgets enable row level security;

create policy "expense_budgets_own" on public.expense_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
