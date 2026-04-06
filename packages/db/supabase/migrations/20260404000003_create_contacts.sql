-- Migration 003: contacts
-- Spec §10.7: lightweight relationship memory layer.
-- Soft-deleted via is_deleted; historical records preserved.

create table if not exists public.contacts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  category   text        not null default 'other'
             check (category in ('personal', 'professional', 'family', 'client', 'vendor', 'other')),
  full_name  text        not null,
  company    text,
  role       text,
  phone      text,
  email      text,
  note       text,        -- rolling single note per contact
  is_deleted boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.contacts.is_deleted is 'Spec §10.7: soft delete — preserve historical meeting and activity records.';
