/**
 * Web Push subscription management (client side).
 *
 * Handles the browser half of closed-app delivery: register the service worker,
 * subscribe via the VAPID public key, and persist the subscription so the
 * send-web-push Edge Function can reach this device. All functions are safe to
 * call in unsupported environments (they return a typed status instead of throwing).
 */

import { env } from "@/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PushSetupResult =
  | "subscribed"
  | "denied"
  | "unsupported"
  | "no-vapid-key"
  | "error";

/** True when this browser can do Web Push (SW + PushManager + Notification). */
export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** VAPID public keys are base64url; the subscribe API needs a Uint8Array. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // ServiceWorkerRegister registers /sw.js; wait for it to be active.
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Persists a PushSubscription to Supabase (idempotent upsert per endpoint). */
async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) return false;

  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("web_push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "user_id,endpoint" },
  );
  return !error;
}

/**
 * Requests notification permission (call from a user gesture) and subscribes
 * this browser to Web Push. Returns a status describing the outcome.
 */
export async function enableWebPush(): Promise<PushSetupResult> {
  if (!isWebPushSupported()) return "unsupported";
  const vapidKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return "no-vapid-key";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await getRegistration();
  if (!registration) return "error";

  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: the DOM lib types applicationServerKey as BufferSource; our
        // Uint8Array is one, but its generic arg trips strict assignability.
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      }));

    const saved = await saveSubscription(subscription);
    return saved ? "subscribed" : "error";
  } catch {
    return "error";
  }
}

/**
 * If permission was already granted, silently ensures a subscription exists and
 * is saved (e.g. after a browser rotates the endpoint). Safe to call on load.
 */
export async function ensureWebPushSubscribed(): Promise<void> {
  if (!isWebPushSupported()) return;
  if (Notification.permission !== "granted") return;
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
  await enableWebPush().catch(() => {});
}

/** Unsubscribes this browser and removes its row from Supabase. */
export async function disableWebPush(): Promise<void> {
  const registration = await getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});

  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("web_push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
  }
}
