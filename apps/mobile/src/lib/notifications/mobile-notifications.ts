import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import type { Expense, Meeting, ReminderPreference, YearEntry } from '@pm/types';
import { computeAllReminders, type ReminderSchedule } from '@pm/domain';

// ---------------------------------------------------------------------------
// Expo Go guard
// ---------------------------------------------------------------------------

// expo-notifications Android push support was removed from Expo Go in SDK 53.
// Importing the module in Expo Go triggers a module-level crash.
// We use a lazy require() so the module is never loaded in Expo Go.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

function getNotifications(): typeof NotificationsType | null {
  if (IS_EXPO_GO) return null;
  // Dynamic require so expo-notifications is never evaluated in Expo Go
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/**
 * Requests permission to display local notifications.
 * Returns true if granted. No-op in Expo Go (returns false).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  const { status: existing } = await N.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await N.requestPermissionsAsync();
  return status === 'granted';
}

// ---------------------------------------------------------------------------
// Notification handler config (called at app startup)
// ---------------------------------------------------------------------------

/**
 * Configure expo-notifications to show banners while the app is in foreground.
 * No-op in Expo Go.
 */
export function configureNotificationHandler(): void {
  const N = getNotifications();
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/**
 * Cancels all existing scheduled notifications and schedules fresh ones.
 * No-op in Expo Go.
 */
export async function scheduleAllReminders(
  prefs: Pick<
    ReminderPreference,
    | 'eod_review_enabled'
    | 'eod_review_time'
    | 'morning_summary_enabled'
    | 'morning_summary_time'
    | 'meeting_reminder_minutes_before'
    | 'birthday_reminder_days_before'
    | 'travel_reminder_days_before'
    | 'renewal_reminder_days_before'
  >,
  meetings: Pick<Meeting, 'id' | 'title' | 'start_at' | 'end_at' | 'status' | 'key_takeaways'>[],
  yearEntries: Pick<YearEntry, 'id' | 'title' | 'type' | 'start_date'>[],
  expenses: Pick<Expense, 'id' | 'title' | 'amount' | 'expense_date' | 'recurrence_rule'>[],
): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);

  const reminders = computeAllReminders({
    prefs,
    meetings,
    yearEntries,
    expenses,
    todayISO,
    now,
  });

  await N.cancelAllScheduledNotificationsAsync();

  const future = reminders.filter((r) => r.scheduled_for > now);
  await Promise.all(future.map((r) => scheduleOne(N, r)));
}

async function scheduleOne(
  N: typeof NotificationsType,
  reminder: ReminderSchedule,
): Promise<void> {
  try {
    await N.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        data: {
          type: reminder.type,
          source_id: reminder.source_id,
        },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: reminder.scheduled_for,
      },
    });
  } catch {
    // Non-fatal: a single reminder failing shouldn't break the rest
  }
}

// ---------------------------------------------------------------------------
// Tap listener
// ---------------------------------------------------------------------------

/**
 * Registers a listener for notification taps. Returns a handle with remove().
 * Returns a no-op handle in Expo Go.
 */
export function addNotificationTapListener(
  handler: (data: { type?: string; source_id?: string | null }) => void,
): { remove: () => void } {
  const N = getNotifications();
  if (!N) return { remove: () => {} };

  const sub = N.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      type?: string;
      source_id?: string | null;
    };
    handler(data);
  });

  return { remove: () => sub.remove() };
}

// ---------------------------------------------------------------------------
// Navigation target resolver
// ---------------------------------------------------------------------------

/**
 * Maps a ReminderType to the route the user should be sent to when tapping
 * the notification.
 */
export function getNotificationRoute(type: string): string {
  switch (type) {
    case 'meeting_upcoming':
    case 'meeting_passed':
      return '/(tabs)/meetings';
    case 'eod_review':
    case 'morning_summary':
      return '/(tabs)/daily-plan';
    case 'birthday':
    case 'travel':
      return '/year-at-a-glance';
    case 'renewal':
      return '/expense-record';
    default:
      return '/(tabs)/daily-plan';
  }
}
