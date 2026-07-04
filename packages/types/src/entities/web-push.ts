/**
 * Web Push entities.
 *
 * Delivery model — "client computes, server delivers":
 *  - The browser subscribes to Web Push and stores its endpoint in
 *    `web_push_subscriptions` (one row per browser/device).
 *  - The browser writes upcoming reminders into `push_outbox` with an absolute
 *    UTC `scheduled_for`; the send-web-push Edge Function drains it on a cron.
 */

/** A single browser's Web Push endpoint + encryption keys. */
export interface WebPushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

/** A queued notification awaiting delivery by the dispatcher Edge Function. */
export interface PushOutboxRow {
  id: string;
  user_id: string;
  /** Idempotency key: `${type}::${source_id ?? 'null'}::${scheduled_for ISO}`. */
  dedup_key: string;
  reminder_type: string;
  source_id: string | null;
  scheduled_for: string; // ISO datetime (UTC)
  title: string;
  body: string;
  silent: boolean;
  url: string | null;
  sent_at: string | null;
  created_at: string;
}
