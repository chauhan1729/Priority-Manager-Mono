/**
 * Browser Notification API wrapper.
 * Spec §13: web-layer bridge between computed ReminderSchedule and browser alerts.
 *
 * The domain computes WHAT and WHEN to notify. This module handles the HOW
 * (browser permission, Notification constructor, in-app fallback toast).
 *
 * Used exclusively on the client side ("use client" components / providers).
 */

import type { ReminderSchedule } from "@pm/domain";

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/** Returns whether the browser supports the Notification API. */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Returns the current notification permission state. */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Requests browser notification permission.
 * Returns the resulting permission state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

// ---------------------------------------------------------------------------
// Show a single browser notification
// ---------------------------------------------------------------------------

/**
 * Shows a browser Notification for a given ReminderSchedule.
 * Falls back gracefully if permission is denied.
 */
export function showBrowserNotification(reminder: ReminderSchedule): void {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  try {
    new Notification(reminder.title, {
      body: reminder.body,
      tag: `pm-${reminder.type}-${reminder.source_id ?? "global"}`,
      // Reusing the same tag prevents duplicate notifications for the same reminder
    });
  } catch {
    // Silent — some browsers restrict Notification outside secure contexts
  }
}

// ---------------------------------------------------------------------------
// Batch fire: show all overdue reminders that haven't been fired yet
// ---------------------------------------------------------------------------

/**
 * Fires browser notifications for all reminders whose `scheduled_for` is in
 * the past (i.e., they should have already alerted but the user may have had
 * the tab closed).
 *
 * Returns the reminders that were actually shown.
 */
export function fireOverdueReminders(
  reminders: ReminderSchedule[],
  now: Date = new Date(),
): ReminderSchedule[] {
  const overdue = reminders.filter((r) => r.scheduled_for <= now);
  for (const r of overdue) {
    showBrowserNotification(r);
  }
  return overdue;
}

// ---------------------------------------------------------------------------
// Storage key for "fired today" deduplication (localStorage)
// ---------------------------------------------------------------------------

const FIRED_KEY = "pm_fired_reminders";

/** Serialisation key for a fired reminder. */
export function reminderKey(type: string, sourceId: string | null): string {
  return `${type}::${sourceId ?? "null"}`;
}

/** Returns the set of reminder keys already fired today (from localStorage). */
export function getFiredTodayFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date: string; keys: string[] };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return new Set(); // reset on new day
    return new Set(parsed.keys);
  } catch {
    return new Set();
  }
}

/** Marks a reminder as fired today in localStorage. */
export function markFiredInStorage(type: string, sourceId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = getFiredTodayFromStorage();
    existing.add(reminderKey(type, sourceId));
    localStorage.setItem(
      FIRED_KEY,
      JSON.stringify({ date: today, keys: Array.from(existing) }),
    );
  } catch {
    // localStorage unavailable
  }
}

/**
 * Fires browser notifications for reminders that are overdue AND haven't
 * been marked as fired today in localStorage. Marks them fired after showing.
 *
 * This provides client-side deduplication across page reloads without
 * needing a round-trip to the reminder_instances table for every check.
 */
export function fireNewOverdueReminders(
  reminders: ReminderSchedule[],
  now: Date = new Date(),
): ReminderSchedule[] {
  const firedToday = getFiredTodayFromStorage();
  const toFire = reminders.filter((r) => {
    if (r.scheduled_for > now) return false;
    return !firedToday.has(reminderKey(r.type, r.source_id));
  });

  for (const r of toFire) {
    showBrowserNotification(r);
    markFiredInStorage(r.type, r.source_id);
  }

  return toFire;
}
