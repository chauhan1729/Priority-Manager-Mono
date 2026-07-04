-- Migration: Web Push notifications (closed-app delivery for the web app / PWA).
--
-- Architecture — "client computes, server delivers":
--   * The browser already runs computeAllReminders() in the user's real local
--     timezone. Whenever it checks reminders it upserts the *upcoming* ones into
--     push_outbox (absolute UTC scheduled_for + rendered title/body).
--   * A cron-driven Edge Function (send-web-push) is a dumb dispatcher: it sends
--     any outbox row that is due (scheduled_for <= now) and not yet sent, to every
--     browser the user has subscribed via the Web Push protocol, then stamps sent_at.
--   * This keeps all reminder/domain logic in the shared package (no duplication
--     into Deno) and sidesteps server-side timezone math.

-- ---------------------------------------------------------------------------
-- 1. Browser push subscriptions (one row per browser/device the user enables)
-- ---------------------------------------------------------------------------
create table if not exists public.web_push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  endpoint   text        not null,
  -- Keys from PushSubscription.toJSON().keys (Web Push encryption)
  p256dh     text        not null,
  auth       text        not null,
  user_agent text,
  created_at timestamptz not null default now(),
  -- One subscription per endpoint per user; re-subscribing upserts.
  unique (user_id, endpoint)
);

comment on table public.web_push_subscriptions is
  'Web Push endpoints (one per browser/device). Consumed by the send-web-push Edge Function.';

-- ---------------------------------------------------------------------------
-- 2. Outbox of notifications to deliver
-- ---------------------------------------------------------------------------
create table if not exists public.push_outbox (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  -- Stable idempotency key: `${type}::${source_id ?? 'null'}::${scheduled_for ISO}`.
  -- Lets the client re-sync the same reminder repeatedly without creating duplicates.
  dedup_key     text        not null,
  reminder_type text        not null,
  source_id     uuid,
  scheduled_for timestamptz not null,
  title         text        not null,
  body          text        not null,
  -- If true, deliver without the OS notification sound.
  silent        boolean     not null default false,
  -- Optional deep-link path opened on notification click (e.g. "/daily-plan").
  url           text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, dedup_key)
);

-- Dispatcher hot path: "due, unsent, per user".
create index if not exists idx_push_outbox_due
  on public.push_outbox (scheduled_for)
  where sent_at is null;

comment on table public.push_outbox is
  'Outbox written by the browser (future reminders) and drained by the send-web-push Edge Function.';

-- ---------------------------------------------------------------------------
-- 3. Notification sound preferences
-- ---------------------------------------------------------------------------
-- notification_sound: foreground tone choice (synthesized in-browser via Web Audio).
--   One of: 'chime' | 'bell' | 'ding' | 'none'. Background push cannot carry a custom
--   sound file (browser limitation) — it uses the OS sound, gated by the enabled flag.
-- notification_sound_enabled: play a sound at all (foreground tone + non-silent push).
alter table public.reminder_preferences
  add column if not exists notification_sound         text    not null default 'chime',
  add column if not exists notification_sound_enabled boolean not null default true;

comment on column public.reminder_preferences.notification_sound is
  'Foreground notification tone: chime | bell | ding | none (synthesized via Web Audio API).';
comment on column public.reminder_preferences.notification_sound_enabled is
  'If false, notifications are silent (no foreground tone, and background push sets silent=true).';

-- ---------------------------------------------------------------------------
-- 4. RLS — users manage only their own rows
-- ---------------------------------------------------------------------------
alter table public.web_push_subscriptions enable row level security;
alter table public.push_outbox            enable row level security;

-- drop-then-create so re-running this script is safe (idempotent).
drop policy if exists "web_push_subscriptions_own" on public.web_push_subscriptions;
create policy "web_push_subscriptions_own" on public.web_push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "push_outbox_own" on public.push_outbox;
create policy "push_outbox_own" on public.push_outbox
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Note: the Edge Function reads/updates these tables with the service-role key,
-- which bypasses RLS. The policies above only govern browser (anon/auth) access.
