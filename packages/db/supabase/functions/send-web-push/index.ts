// Supabase Edge Function: send-web-push
//
// Cron-driven dispatcher for the "client computes, server delivers" push model.
// Every run it drains due rows from `push_outbox` and delivers each to every
// browser the user has registered in `web_push_subscriptions`, then stamps
// `sent_at`. Expired endpoints (404/410) are pruned. It contains no reminder
// logic — the browser already computed *what* and *when*.
//
// Deploy:  supabase functions deploy send-web-push
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@…)
//
// JWT verification stays ON: pg_cron invokes it with the service_role key as the
// Bearer token, so the endpoint is not publicly invocable. See WEB_PUSH_SETUP.md.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

// Deno global is provided by the Supabase Edge runtime.
declare const Deno: { env: { get(key: string): string | undefined } };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:notifications@example.com";

// Don't deliver reminders that are more than this stale (e.g. after downtime).
const GRACE_MS = 60 * 60 * 1000;
// Cap rows per invocation to stay well within function limits.
const BATCH_LIMIT = 500;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface OutboxRow {
  id: string;
  user_id: string;
  reminder_type: string;
  source_id: string | null;
  title: string;
  body: string;
  silent: boolean;
  url: string | null;
  scheduled_for: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const graceIso = new Date(nowMs - GRACE_MS).toISOString();

  // 1. Pull due, unsent, non-stale reminders.
  const { data: due, error: dueErr } = await admin
    .from("push_outbox")
    .select("id, user_id, reminder_type, source_id, title, body, silent, url, scheduled_for")
    .is("sent_at", null)
    .lte("scheduled_for", nowIso)
    .gte("scheduled_for", graceIso)
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_LIMIT);

  if (dueErr) {
    return Response.json({ error: dueErr.message }, { status: 500 });
  }
  const rows = (due ?? []) as OutboxRow[];
  if (rows.length === 0) {
    return Response.json({ sent: 0, delivered: 0 });
  }

  // 2. Load all subscriptions for the affected users in one query.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: subsData } = await admin
    .from("web_push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  const subs = (subsData ?? []) as SubscriptionRow[];

  const subsByUser = new Map<string, SubscriptionRow[]>();
  for (const s of subs) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  const staleSubIds = new Set<string>();
  const sentRowIds: string[] = [];
  let delivered = 0;

  // 3. Deliver each reminder to each of the user's browsers.
  for (const row of rows) {
    const userSubs = subsByUser.get(row.user_id) ?? [];
    const payload = JSON.stringify({
      title: row.title,
      body: row.body,
      tag: `pm-${row.reminder_type}-${row.source_id ?? "global"}`,
      url: row.url ?? "/daily-plan",
      silent: row.silent,
    });

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        delivered++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) staleSubIds.add(sub.id);
        // Other errors: leave the subscription; the row is still marked sent to
        // avoid retry storms (reminders are time-sensitive, not worth requeueing).
      }
    }
    // Mark the row handled even if the user had no subscriptions (nothing to do).
    sentRowIds.push(row.id);
  }

  // 4. Persist results: stamp sent rows, prune dead subscriptions.
  if (sentRowIds.length > 0) {
    await admin.from("push_outbox").update({ sent_at: nowIso }).in("id", sentRowIds);
  }
  if (staleSubIds.size > 0) {
    await admin.from("web_push_subscriptions").delete().in("id", [...staleSubIds]);
  }

  return Response.json({
    sent: sentRowIds.length,
    delivered,
    prunedSubscriptions: staleSubIds.size,
  });
});
