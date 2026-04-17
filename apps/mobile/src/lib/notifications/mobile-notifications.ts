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

const CHANNEL_ID = 'default';

/**
 * Configure expo-notifications to show banners while the app is in foreground
 * and ensure the Android notification channel exists.
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

  // Android 8+ requires an explicit channel — create it once at startup.
  if (Platform.OS === 'android') {
    N.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Priority Manager',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
    }).catch(() => {});
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
          title: `Upcoming: ${m.title}`,
          body: `Starts in ${minutesBefore} minute${minutesBefore === 1 ? '' : 's'}.`,
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
    // Log so failures are visible during debugging
    console.warn('[notifications] scheduleOne failed:', reminder.type, err);
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
