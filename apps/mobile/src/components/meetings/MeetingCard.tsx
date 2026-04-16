import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  isMeetingPast,
  isMeetingRunning,
  needsStatusUpdatePrompt,
  needsTakeawayPrompt,
} from '@pm/domain';
import type { Meeting, MeetingStatus } from '@pm/types';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

const STATUS_STYLE: Record<MeetingStatus, { bg: string; text: string }> = {
  upcoming: { bg: colors.blue[50], text: colors.blue[600] },
  completed: { bg: colors.green[50], text: colors.green[700] },
  missed: { bg: colors.red[50], text: colors.red[600] },
  cancelled: { bg: colors.gray[100], text: colors.gray[500] },
};

interface Props {
  meeting: Meeting;
  contactName?: string | undefined;
  contactSubtitle?: string | undefined;
  onPress: () => void;
}

function MeetingCardBase({ meeting, contactName, contactSubtitle, onPress }: Props) {
  const statusStyle = STATUS_STYLE[meeting.status] ?? STATUS_STYLE.upcoming;

  const running = isMeetingRunning(meeting);
  const past = isMeetingPast(meeting);
  const needsStatus = needsStatusUpdatePrompt(meeting);
  const needsTakeaway = needsTakeawayPrompt(meeting) && !needsStatus;

  const dateLabel = new Date(meeting.date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = new Date(meeting.start_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Secondary stripe stays as an "at a glance" cue when an attention prompt applies
  const showStripe = needsStatus || needsTakeaway;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      activeOpacity={0.75}
    >
      <View style={styles.row}>
        {showStripe && <View style={styles.amberStripe} />}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {meeting.title}
            </Text>
            {running && (
              <View style={styles.nowBadge}>
                <Text style={styles.nowBadgeText}>NOW</Text>
              </View>
            )}
          </View>

          {contactName && (
            <Text style={styles.contact} numberOfLines={1}>
              {contactName}
              {contactSubtitle ? ` · ${contactSubtitle}` : ''}
            </Text>
          )}

          <Text style={styles.meta}>
            {dateLabel} · {timeLabel} · {meeting.duration_minutes} min
            {meeting.recurrence_rule ? `  ↻ ${meeting.recurrence_rule}` : ''}
          </Text>

          {/* Attention pills */}
          {(needsStatus || needsTakeaway) && (
            <View style={styles.pillsRow}>
              {needsStatus && (
                <View style={[styles.pill, styles.pillOrange]}>
                  <Text style={styles.pillOrangeText}>Needs status update</Text>
                </View>
              )}
              {needsTakeaway && (
                <View style={[styles.pill, styles.pillAmber]}>
                  <Text style={styles.pillAmberText}>Add takeaways</Text>
                </View>
              )}
            </View>
          )}

          {/* Agenda preview — only for upcoming/non-past meetings */}
          {!past && meeting.agenda ? (
            <Text style={styles.agendaPreview} numberOfLines={1}>
              {meeting.agenda}
            </Text>
          ) : null}
        </View>

        <View style={styles.badgesCol}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {meeting.status}
            </Text>
          </View>
          {meeting.recurrence_rule && (
            <Text style={styles.recurIcon} accessibilityLabel="Recurring">
              ↻
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const MeetingCard = React.memo(MeetingCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  amberStripe: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.amber[400],
  },
  body: {
    flex: 1,
    padding: spacing.md,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  nowBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.amber[500],
    flexShrink: 0,
    marginTop: 1,
  },
  nowBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  contact: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.blue[600],
  },
  meta: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  pillOrange: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  pillOrangeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    color: '#C2410C',
  },
  pillAmber: {
    backgroundColor: colors.amber[50],
    borderWidth: 1,
    borderColor: colors.amber[200],
  },
  pillAmberText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    color: colors.amber[700],
  },
  agendaPreview: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
    fontStyle: 'italic',
    marginTop: 4,
  },
  badgesCol: {
    paddingRight: spacing.md,
    paddingTop: spacing.md,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  recurIcon: {
    fontSize: 14,
    color: colors.gray[400],
  },
});
