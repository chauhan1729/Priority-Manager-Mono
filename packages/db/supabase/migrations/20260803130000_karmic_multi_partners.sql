-- Migration: Karmic Partners — allow multiple partners per group.
-- Was one row per (user, group); now each of the four groups can hold several
-- named partners, and each daily action belongs to a specific partner.

-- 1. Drop the one-per-group uniqueness so a group can hold many partners.
alter table public.karmic_partners drop constraint if exists uq_karmic_partner_group;

-- 2. Retire-without-delete + ordering within a group.
alter table public.karmic_partners
  add column if not exists status text not null default 'active'
  check (status in ('active', 'retired'));
alter table public.karmic_partners
  add column if not exists sort_order integer not null default 0;

-- 3. Anchor actions on a specific partner (kept alongside partner_group, which
--    stays denormalised for cheap history grouping).
alter table public.karmic_partner_actions
  add column if not exists partner_id uuid references public.karmic_partners(id) on delete cascade;

-- Backfill: each existing action maps to the single partner in its group (if any).
update public.karmic_partner_actions a
  set partner_id = p.id
  from public.karmic_partners p
  where a.partner_id is null
    and p.user_id = a.user_id
    and p.partner_group = a.partner_group;

create index if not exists idx_karmic_partner_actions_partner
  on public.karmic_partner_actions (partner_id);
