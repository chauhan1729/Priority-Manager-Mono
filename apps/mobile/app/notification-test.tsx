import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendTestNotification } from '../src/lib/notifications/mobile-notifications';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily } from '../src/theme/typography';

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

const TEST_CASES: { type: string; label: string; description: string }[] = [
  {
    type: 'activity_starting',
    label: 'Activity Starting',
    description: 'Fires before a scheduled activity block begins.',
  },
  {
    type: 'activity_overdue',
    label: 'Activity Overdue',
    description: 'Fires when a scheduled block ends without a status update.',
  },
  {
    type: 'meeting_upcoming',
    label: 'Meeting Upcoming',
    description: 'Fires N minutes before a meeting starts.',
  },
  {
    type: 'meeting_passed',
    label: 'Meeting Passed',
    description: 'Fires after a meeting ends to prompt status & takeaways.',
  },
  {
    type: 'event_upcoming',
    label: 'Event Upcoming',
    description: 'Fires before an appointment or calendar event.',
  },
  {
    type: 'eod_review',
    label: 'End of Day Review',
    description: 'Fires at your configured EOD review time.',
  },
  {
    type: 'morning_summary',
    label: 'Morning Summary',
    description: 'Fires at your configured morning summary time.',
  },
  {
    type: 'birthday',
    label: 'Birthday Reminder',
    description: 'Fires N days before a birthday from Year at a Glance.',
  },
  {
    type: 'travel',
    label: 'Travel Reminder',
    description: 'Fires N days before a trip from Year at a Glance.',
  },
  {
    type: 'renewal',
    label: 'Renewal Reminder',
    description: 'Fires N days before a recurring expense renews.',
  },
];

const DELAY_SECONDS = 5;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NotificationTestScreen() {
  const [statuses, setStatuses] = useState<Record<string, 'idle' | 'scheduled' | 'error'>>({});

  async function handleTest(type: string) {
    setStatuses((s) => ({ ...s, [type]: 'idle' }));
    const id = await sendTestNotification(type, DELAY_SECONDS);
    setStatuses((s) => ({ ...s, [type]: id ? 'scheduled' : 'error' }));
    // Reset badge after 4 seconds so button is re-tappable
    setTimeout(() => {
      setStatuses((s) => ({ ...s, [type]: 'idle' }));
    }, 4000);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Tap a button to schedule a test notification in {DELAY_SECONDS} seconds.
          Background the app to see it arrive.
        </Text>

        {TEST_CASES.map(({ type, label, description }) => {
          const status = statuses[type] ?? 'idle';
          return (
            <View key={type} style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>{label}</Text>
                <Text style={styles.cardDesc}>{description}</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.btn,
                  status === 'scheduled' && styles.btnScheduled,
                  status === 'error' && styles.btnError,
                ]}
                onPress={() => handleTest(type)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.btnText,
                    status === 'scheduled' && styles.btnTextScheduled,
                    status === 'error' && styles.btnTextError,
                  ]}
                >
                  {status === 'scheduled'
                    ? `In ${DELAY_SECONDS}s`
                    : status === 'error'
                    ? 'Failed'
                    : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: spacing.md, gap: spacing.xs, paddingBottom: spacing['3xl'] },

  hint: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[500],
    lineHeight: 20,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[50],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  cardBody: { flex: 1, gap: 2 },
  cardLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  cardDesc: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
    lineHeight: 16,
  },

  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.blue[300],
    backgroundColor: colors.blue[50],
    minWidth: 64,
    alignItems: 'center',
  },
  btnScheduled: {
    borderColor: colors.green[400],
    backgroundColor: colors.green[50],
  },
  btnError: {
    borderColor: colors.red[400],
    backgroundColor: colors.red[50],
  },
  btnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.blue[700],
  },
  btnTextScheduled: {
    color: colors.green[700],
  },
  btnTextError: {
    color: colors.red[700],
  },
});
