import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Activity,
  CalendarEvent,
  Expense,
  Meeting,
  ScheduleInstance,
  YearEntry,
} from '@pm/types';
import { useAuth } from './AuthProvider';
import { useReminderPreferences } from '../../hooks/useSettings';
import { supabase } from '../../lib/supabase/client';
import {
  addNotificationTapListener,
  configureNotificationHandler,
  getNotificationRoute,
  requestNotificationPermission,
  scheduleAllReminders,
} from '../../lib/notifications/mobile-notifications';

// Configure notification display behavior.
// configureNotificationHandler() is a no-op in Expo Go, so this is safe here.
configureNotificationHandler();

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: prefs } = useReminderPreferences();
  const qc = useQueryClient();
  const permissionRequestedRef = useRef(false);
  const lastScheduledAtRef = useRef<number>(0);

  // Request permission on first mount (once per app session)
  useEffect(() => {
    if (!user || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;
    requestNotificationPermission().catch(() => {
      // Permission denied — silently skip scheduling
    });
  }, [user]);

  // Re-schedule helper — pulls fresh data and re-runs the scheduler.
  async function rescheduleNow() {
    if (!user || !prefs) return;
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      // Look 7 days ahead for scheduled blocks + calendar events
      const horizonISO = new Date(now.getTime() + 7 * 24 * 60 * 60_000)
        .toISOString()
        .slice(0, 10);

      const [meetingsRes, yearEntriesRes, expensesRes, instancesRes, activitiesRes, eventsRes] =
        await Promise.all([
          supabase
            .from('meetings')
            .select('id, title, start_at, end_at, status, key_takeaways')
            .eq('user_id', user.id)
            .gte('start_at', `${today}T00:00:00Z`)
            .order('start_at', { ascending: true }),
          supabase
            .from('year_entries')
            .select('id, title, type, start_date')
            .eq('user_id', user.id),
          supabase
            .from('expenses')
            .select('id, title, amount, expense_date, recurrence_rule')
            .eq('user_id', user.id)
            .not('recurrence_rule', 'is', null),
          supabase
            .from('schedule_instances')
            .select('id, source_type, source_activity_id, start_at, end_at, status_snapshot')
            .eq('user_id', user.id)
            .gte('schedule_date', today)
            .lte('schedule_date', horizonISO),
          supabase
            .from('activities')
            .select('id, title')
            .eq('user_id', user.id)
            .gte('activity_date', today)
            .lte('activity_date', horizonISO),
          supabase
            .from('calendar_events')
            .select('id, title, event_type, start_at')
            .eq('user_id', user.id)
            .gte('date', today)
            .lte('date', horizonISO)
            .not('start_at', 'is', null),
        ]);

      await scheduleAllReminders(
        prefs,
        (meetingsRes.data ?? []) as Meeting[],
        (yearEntriesRes.data ?? []) as YearEntry[],
        (expensesRes.data ?? []) as Expense[],
        (instancesRes.data ?? []) as ScheduleInstance[],
        (activitiesRes.data ?? []) as Activity[],
        (eventsRes.data ?? []) as CalendarEvent[],
      );
      lastScheduledAtRef.current = Date.now();
    } catch {
      // Non-fatal
    }
  }

  // Schedule whenever prefs or user change
  useEffect(() => {
    if (!user || !prefs) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await rescheduleNow();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, prefs]);

  // Re-schedule when the app comes to the foreground OR when React Query cache
  // for scheduling-relevant keys updates (activities, meetings, calendar events, schedule instances).
  useEffect(() => {
    if (!user || !prefs) return;

    // Foreground listener
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Debounce: don't re-schedule if we did it within the last 30 seconds
        if (Date.now() - lastScheduledAtRef.current > 30_000) {
          rescheduleNow();
        }
      }
    });

    // Query cache subscription — any change to scheduling data triggers a re-schedule
    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey?.[0];
      if (
        key === 'scheduleInstances' ||
        key === 'activities' ||
        key === 'meetings' ||
        key === 'calendar_events' ||
        key === 'calendarEvents'
      ) {
        // Debounce rapid bursts
        if (Date.now() - lastScheduledAtRef.current > 2_000) {
          rescheduleNow();
        }
      }
    });

    return () => {
      appSub.remove();
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, prefs]);

  // Handle notification tap → navigate to relevant screen
  useEffect(() => {
    const listener = addNotificationTapListener((data) => {
      const route = getNotificationRoute(data.type ?? '');
      router.push(route as never);
    });

    return () => listener.remove();
  }, []);

  return <>{children}</>;
}
