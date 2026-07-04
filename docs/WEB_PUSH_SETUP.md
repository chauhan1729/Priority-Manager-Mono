# Web Push Notifications — Setup & Deploy Runbook

This delivers notifications to the **web app / installed PWA even when it is fully
closed**, on Supabase Free tier. No new servers.

## Architecture — "client computes, server delivers"

The browser already computes reminders (in the user's real local timezone) via
`computeAllReminders()`. Instead of only showing them while open, it also writes
the *upcoming* ones into a `push_outbox` table. A cron-driven Edge Function then
delivers anything due to every browser the user subscribed. The server holds **no**
reminder logic — it's a dumb dispatcher, which keeps domain logic shared and
sidesteps server-side timezone math.

```
Browser: subscribe (VAPID)  ─▶ web_push_subscriptions
Browser: computeAllReminders ─▶ push_outbox (future reminders, absolute UTC time)
pg_cron (every minute)       ─▶ send-web-push Edge Function
Edge Function                ─▶ Web Push (FCM/Apple/Mozilla) ─▶ Service Worker `push`
Service Worker               ─▶ showNotification()   ← app can be CLOSED
```

Foreground (app open) notifications still fire immediately via the service worker,
and play the user's chosen sound. Background (closed) notifications use the OS
default sound — browsers do **not** allow a custom sound file for push, so the
in-app "Notification sound" picker applies to the foreground only. The
`silent` toggle is honored in both.

## What was built in code

| Area | File |
|---|---|
| DB tables + sound columns | `packages/db/supabase/migrations/20260703000001_web_push.sql` |
| Types | `packages/types/src/entities/web-push.ts`, `…/reminder-preference.ts` |
| Outbox builder (shared, tested) | `packages/domain/src/notification/outbox.ts` |
| Service worker push handlers | `apps/web/public/sw.js` |
| Subscription client | `apps/web/src/lib/notifications/web-push.ts` |
| Foreground show + sound | `apps/web/src/lib/notifications/web-notifications.ts`, `…/sounds.ts` |
| Provider (timer + outbox upsert) | `apps/web/src/components/providers/NotificationProvider.tsx` |
| Settings UI (enable + sound) | `apps/web/src/components/settings/ReminderSettingsView.tsx` |
| Dispatcher Edge Function | `packages/db/supabase/functions/send-web-push/index.ts` |

---

## Deploy steps (one-time)

All commands run from the repo root unless noted. Requires the Supabase CLI
(`supabase login` first).

### 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Copy the **Public Key** and **Private Key**.

### 2. Set the public key for the web app

Add to `apps/web/.env.local` (and your hosting env — Vercel/Netlify/etc.):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
```

Without this, the app degrades gracefully to foreground-only notifications.

### 3. Apply the migration

```bash
cd packages/db/supabase
supabase db push
```

This creates `web_push_subscriptions`, `push_outbox`, adds the two sound columns
to `reminder_preferences`, and sets RLS.

### 4. Set Edge Function secrets

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<public key> \
  VAPID_PRIVATE_KEY=<private key> \
  VAPID_SUBJECT=mailto:you@yourdomain.com
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

### 5. Deploy the Edge Function

```bash
supabase functions deploy send-web-push
```

JWT verification stays **on** (the endpoint is not public). pg_cron authenticates
with the `service_role` key below.

### 6. Schedule it every minute

In the Supabase Dashboard: **Database → Extensions**, enable `pg_cron` and
`pg_net`. Then in **SQL Editor**, run (replace `<PROJECT_REF>` and the
`service_role` key — Dashboard → Project Settings → API → `service_role`):

```sql
select cron.schedule(
  'send-web-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

The `service_role` key is a secret — keep it server-side only (it lives in the
`cron.job` table, which is not exposed to clients).

Optional — nightly cleanup of delivered rows so the outbox stays small:

```sql
select cron.schedule(
  'purge-sent-outbox-daily',
  '0 3 * * *',
  $$ delete from public.push_outbox where sent_at is not null and sent_at < now() - interval '3 days'; $$
);
```

To change or remove: `select cron.unschedule('send-web-push-every-minute');`

### 7. Enable on each device

Open the app → **Settings → Device Notifications → "Enable notifications on this
device"**, and allow the browser prompt. On iPhone/iPad you must **Add to Home
Screen first** (iOS only allows web push for installed PWAs, iOS 16.4+).

---

## Verify

```sql
-- A subscription was saved after clicking "Enable" in Settings:
select user_id, left(endpoint, 40) as endpoint, created_at from web_push_subscriptions;

-- The browser queued upcoming reminders:
select reminder_type, scheduled_for, sent_at from push_outbox order by scheduled_for desc limit 20;

-- The cron job exists and is running:
select jobid, schedule, jobname from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
```

Manual one-shot test of the function:

```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/send-web-push' \
  -H 'Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>'
# → {"sent":N,"delivered":M,"prunedSubscriptions":0}
```

---

## Free-tier notes

- Cron every minute ≈ 43,200 Edge Function invocations/month — ~8.6% of the 500K
  free allowance.
- Free projects **pause after ~1 week of inactivity**; cron won't run while paused.
  Any app use resets the timer, so for a daily-use app this effectively never trips.
- Web Push itself is free (no per-message cost, no FCM server key needed for web).

## Limits (by browser design, not fixable in code)

- **Custom sound for closed-app notifications is impossible** — the OS sound is used.
  The sound picker in Settings applies to foreground notifications only.
- **iOS** requires the PWA be installed to the Home Screen; permission must come
  from a tap (handled by the Settings button).
- Reminders more than 48h out are queued the next time the user opens the app
  (the outbox sync horizon), matching the app's "opened at least daily" assumption.
