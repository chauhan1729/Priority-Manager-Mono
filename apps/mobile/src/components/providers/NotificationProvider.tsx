import React, { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import type { Expense, Meeting, YearEntry } from '@pm/types';
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
  const permissionRequestedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Request permission on first mount (once per app session)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;
    requestNotificationPermission().catch(() => {
      // Permission denied — silently skip scheduling
    });
  }, [user]);

  // ---------------------------------------------------------------------------
  // Schedule (or re-schedule) whenever prefs change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user || !prefs) return;

    let cancelled = false;

    const run = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        const [meetingsRes, yearEntriesRes, expensesRes] = await Promise.all([
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
        ]);

        if (cancelled) return;

        await scheduleAllReminders(
          prefs,
          (meetingsRes.data ?? []) as Meeting[],
          (yearEntriesRes.data ?? []) as YearEntry[],
          (expensesRes.data ?? []) as Expense[],
        );
      } catch {
        // Non-fatal: notification scheduling failure should not crash the app
      }
    };

    run();
    return () => { cancelled = true; };
  }, [user, prefs]);

  // ---------------------------------------------------------------------------
  // Handle notification tap → navigate to relevant screen
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const listener = addNotificationTapListener((data) => {
      const route = getNotificationRoute(data.type ?? '');
      router.push(route as never);
    });

    return () => listener.remove();
  }, []);

  return <>{children}</>;
}
