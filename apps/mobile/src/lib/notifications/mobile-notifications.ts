import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type * as NotificationsType from 'expo-notifications';
import type {
  Activity,
  CalendarEvent,
  Expense,
  Meeting,
  ReminderPreference,
  ScheduleInstance,
  YearEntry,
} from '@pm/types';
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

// Channel ID — increment the suffix if channel settings ever need to change.
// Android caches channel config after first creation and ignores updates,
// so a new ID is the only reliable way to pick up changed settings.
const CHANNEL_ID = 'pm_reminders_v1';

/**
 * Configure expo-notifications foreground handler. Call once at startup.
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

/**
 * Creates (or verifies) the notification channel on Android 8+.
 * Must be awaited before scheduling any notifications so the channel
 * exists when the first notification is dispatched.
 * No-op on iOS / Expo Go.
 */
export async function ensureNotificationChannel(): Promise<void> {
  const N = getNotifications();
  if (!N || Platform.OS !== 'android') return;
  try {
    await N.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Priority Manager',
      importance: N.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: true,
      enableVibrate: true,
    });
  } catch (err) {
    console.warn('[notifications] channel setup failed:', err);
  }
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
    | 'activity_starting_enabled'
    | 'activity_reminder_minutes_before'
    | 'activity_overdue_enabled'
    | 'event_reminder_minutes_before'
  >,
  meetings: Pick<Meeting, 'id' | 'title' | 'start_at' | 'end_at' | 'status' | 'key_takeaways'>[],
  yearEntries: Pick<YearEntry, 'id' | 'title' | 'type' | 'start_date'>[],
  expenses: Pick<Expense, 'id' | 'title' | 'amount' | 'expense_date' | 'recurrence_rule'>[],
  scheduleInstances: Pick<
    ScheduleInstance,
    'id' | 'source_type' | 'source_activity_id' | 'start_at' | 'end_at' | 'status_snapshot'
  >[] = [],
  activities: Pick<Activity, 'id' | 'title'>[] = [],
  calendarEvents: Pick<CalendarEvent, 'id' | 'title' | 'event_type' | 'start_at'>[] = [],
): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  // Ensure the channel exists before any notification is dispatched.
  await ensureNotificationChannel();

  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);

  const reminders = computeAllReminders({
    prefs,
    meetings,
    yearEntries,
    expenses,
    scheduleInstances,
    activities,
    calendarEvents,
    todayISO,
    now,
  });

  // computeMeetingUpcomingReminders is designed for web polling (fires only within
  // the [reminderTime, startAt) window). For local notification scheduling we need
  // to schedule AHEAD of that window, so compute meeting reminders separately here.
  const minutesBefore = prefs.meeting_reminder_minutes_before;
  const meetingScheduleReminders = minutesBefore > 0
    ? meetings.flatMap((m) => {
        if (m.status !== 'upcoming') return [];
        const startAt = new Date(m.start_at);
        const reminderTime = new Date(startAt.getTime() - minutesBefore * 60_000);
        if (reminderTime <= now) return [];
        return [{
          type: 'meeting_upcoming' as const,
          source_id: m.id,
          scheduled_for: reminderTime,
          title: m.title,
          body: `Meeting in ${minutesBefore} min. Show up fully, or reschedule and own it.`,
        }];
      })
    : [];

  // Merge: exclude any meeting_upcoming from computeAllReminders (empty for future
  // meetings anyway) and add the correctly forward-scheduled ones.
  const allReminders = [
    ...reminders.filter((r) => r.type !== 'meeting_upcoming'),
    ...meetingScheduleReminders,
  ];

  await N.cancelAllScheduledNotificationsAsync();

  const future = allReminders.filter((r) => r.scheduled_for > now);
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
        sound: true,
        data: {
          type: reminder.type,
          source_id: reminder.source_id,
        },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: reminder.scheduled_for,
        channelId: CHANNEL_ID,
      },
    });
  } catch (err) {
    console.warn('[notifications] scheduleOne failed:', reminder.type, err);
  }
}

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

const TEST_CASES: Record<string, { title: string; body: string }> = {
  activity_starting: {
    title: 'Deep Work: Build feature X',
    body: 'Focus and complete this cycle, or acknowledge, take responsibility, and move it to another time.',
  },
  activity_overdue: {
    title: 'Deep Work: Build feature X',
    body: 'Block ended — add an update so progress isn\'t lost and can be tracked.',
  },
  meeting_upcoming: {
    title: 'Weekly Sync',
    body: 'Meeting in 15 min. Show up fully, or reschedule and own it.',
  },
  meeting_passed: {
    title: 'Weekly Sync',
    body: 'Meeting done — add takeaways and update status so nothing is lost.',
  },
  event_upcoming: {
    title: 'Doctor Appointment',
    body: 'Focus and show up fully, or acknowledge, take responsibility, and reschedule.',
  },
  eod_review: {
    title: 'End of Day Review',
    body: 'Log updates on what\'s done and what\'s not — don\'t let progress go untracked.',
  },
  morning_summary: {
    title: 'Good morning!',
    body: 'Review today\'s plan. Commit to what you\'ll focus on and complete.',
  },
  birthday: {
    title: 'Birthday: Alex Johnson',
    body: 'Today is Alex Johnson\'s birthday — reach out and make it count.',
  },
  travel: {
    title: 'Trip to London',
    body: '1 day away — prepare ahead or reschedule and own it.',
  },
  renewal: {
    title: 'Notion',
    body: 'Renewal in 3 days. Handle it or reschedule and own it.',
  },
};

/**
 * Schedules a test notification for the given reminder type to fire in
 * `delaySeconds` seconds (default 5). Returns the notification identifier
 * or null if notifications are unavailable.
 */
export async function sendTestNotification(
  type: string,
  delaySeconds = 5,
): Promise<string | null> {
  const N = getNotifications();
  if (!N) return null;

  const content = TEST_CASES[type] ?? {
    title: `Test: ${type}`,
    body: 'This is a test notification.',
  };

  const fireAt = new Date(Date.now() + delaySeconds * 1000);

  try {
    const id = await N.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        sound: true,
        data: { type, source_id: 'test' },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: CHANNEL_ID,
      },
    });
    return id;
  } catch (err) {
    console.warn('[notifications] sendTestNotification failed:', type, err);
    return null;
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
    case 'activity_starting':
    case 'activity_overdue':
    case 'event_upcoming':
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
