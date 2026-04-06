import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { isMeetingPast, needsTakeawayPrompt } from '@pm/domain';
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
  contactName?: string;
  onPress: () => void;
}

function MeetingCardBase({ meeting, contactName, onPress }: Props) {
  const statusStyle = STATUS_STYLE[meeting.status] ?? STATUS_STYLE.upcoming;
  const needsTakeaway = needsTakeawayPrompt(meeting);

  const dateLabel = new Date(meeting.date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = new Date(meeting.start_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      activeOpacity={0.75}
    >
      <View style={styles.row}>
        {/* Takeaway indicator stripe */}
        {needsTakeaway && <View style={styles.amberStripe} />}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            {needsTakeaway && <View style={styles.amberDot} />}
            <Text style={styles.title} numberOfLines={2}>
              {meeting.title}
            </Text>
          </View>

          {contactName && (
            <Text style={styles.contact} numberOfLines={1}>
              {contactName}
            </Text>
          )}

          <Text style={styles.meta}>
            {dateLabel} · {timeLabel} · {meeting.duration_minutes} min
          </Text>
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
    alignItems: 'center',
  },
  amberStripe: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.amber[400],
  },
  body: {
    flex: 1,
    padding: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: 3,
  },
  amberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber[400],
    marginTop: 4,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  contact: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.blue[600],
    marginBottom: 3,
  },
  meta: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },
  badgesCol: {
    paddingRight: spacing.md,
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
