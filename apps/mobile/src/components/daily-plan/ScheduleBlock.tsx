import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Badge } from '../ui/Badge';
import type { ActivityPriority, ActivityStatus } from '@pm/types';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// px per minute on the timeline
export const PX_PER_MIN = 2;

// Timeline start hour
export const TIMELINE_START_HOUR = 6;

export function minutesFromTimelineStart(isoDatetime: string): number {
  const d = new Date(isoDatetime);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  return (hours - TIMELINE_START_HOUR) * 60 + minutes;
}

interface Props {
  instanceId: string;
  title: string;
  startAt: string;
  endAt: string;
  statusSnapshot: string | null;
  priority?: ActivityPriority;
  projectName?: string;
  contactName?: string;
  sourceType: string;
  onPress: () => void;
}

const STATUS_BG: Record<string, string> = {
  upcoming: colors.blue[50],
  working: colors.blue[100],
  completed: colors.green[50],
  postponed: colors.amber[50],
  missed: colors.red[50],
};

const STATUS_BORDER: Record<string, string> = {
  upcoming: colors.blue[200],
  working: colors.blue[400],
  completed: colors.green[300],
  postponed: colors.amber[300],
  missed: colors.red[200],
};

function ScheduleBlockBase({
  title,
  startAt,
  endAt,
  statusSnapshot,
  priority,
  projectName,
  contactName,
  sourceType,
  onPress,
}: Props) {
  const topMin = minutesFromTimelineStart(startAt);
  const durationMin = Math.round(
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000
  );
  const top = topMin * PX_PER_MIN;
  const height = Math.max(durationMin * PX_PER_MIN, 28);

  const status = statusSnapshot ?? 'upcoming';
  const bg = STATUS_BG[status] ?? colors.blue[50];
  const border = STATUS_BORDER[status] ?? colors.blue[200];

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const isMeeting = sourceType === 'meeting';

  return (
    <TouchableOpacity
      style={[styles.block, { top, height, backgroundColor: bg, borderColor: border }]}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        {priority ? <Badge variant={priority} style={styles.priorityBadge} /> : null}
        <Text style={styles.title} numberOfLines={height < 40 ? 1 : 2}>
          {isMeeting ? `📅 ${title}` : title}
        </Text>
      </View>
      {height >= 36 && (
        <Text style={styles.meta} numberOfLines={1}>
          {formatTime(startAt)} – {formatTime(endAt)}
          {projectName ? ` · ${projectName}` : ''}
          {contactName ? ` · ${contactName}` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export const ScheduleBlock = React.memo(ScheduleBlockBase);

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    left: 56,
    right: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priorityBadge: {
    transform: [{ scale: 0.8 }],
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.DEFAULT,
  },
  meta: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    color: colors.ink.light,
    marginTop: 1,
  },
});
