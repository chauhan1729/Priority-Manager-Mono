import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

// Priority
type Priority = 'A' | 'B' | 'C';

// Status — exact mappings from ActivitiesTab.tsx ACTIVITY_STATUS_CLASSES
type ActivityStatus =
  | 'not_started'
  | 'working'
  | 'completed'
  | 'postponed'
  | 'delegated'
  | 'cancelled';

type BadgeVariant = Priority | ActivityStatus;

const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  A: { bg: colors.red[100], text: colors.red[700] },
  B: { bg: colors.blue[100], text: colors.blue[700] },
  C: { bg: colors.gray[100], text: colors.gray[600] },
};

const STATUS_COLORS: Record<ActivityStatus, { bg: string; text: string }> = {
  not_started: { bg: colors.gray[100], text: colors.gray[600] },
  working: { bg: colors.blue[100], text: colors.blue[700] },
  completed: { bg: colors.green[100], text: colors.green[700] },
  postponed: { bg: colors.amber[100], text: colors.amber[700] },
  delegated: { bg: colors.purple[100], text: colors.purple[700] },
  cancelled: { bg: colors.red[100], text: colors.red[600] },
};

const STATUS_LABELS: Record<ActivityStatus, string> = {
  not_started: 'Not Started',
  working: 'Working',
  completed: 'Completed',
  postponed: 'Postponed',
  delegated: 'Delegated',
  cancelled: 'Cancelled',
};

interface BadgeProps {
  variant: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ variant, style }: BadgeProps) {
  const isPriority = variant === 'A' || variant === 'B' || variant === 'C';

  const { bg, text } = isPriority
    ? PRIORITY_COLORS[variant as Priority]
    : STATUS_COLORS[variant as ActivityStatus];

  const label = isPriority ? variant : STATUS_LABELS[variant as ActivityStatus];

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
