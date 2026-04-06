import React from 'react';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AnnualGoal, AnnualGoalStatus } from '@pm/types';
import { ProgressBar } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Status style map
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<AnnualGoalStatus, { bg: string; text: string; label: string }> = {
  not_started: { bg: colors.gray[100],  text: colors.gray[600],  label: 'Not Started' },
  active:      { bg: colors.blue[100],  text: colors.blue[700],  label: 'Active' },
  on_track:    { bg: colors.green[100], text: colors.green[700], label: 'On Track' },
  at_risk:     { bg: colors.amber[100], text: colors.amber[700], label: 'At Risk' },
  completed:   { bg: colors.green[100], text: colors.green[700], label: 'Completed' },
  dropped:     { bg: colors.red[100],   text: colors.red[600],   label: 'Dropped' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  goal: AnnualGoal;
  linkedProjectsCount?: number;
  onPress: () => void;
  onLongPress?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function GoalCardBase({ goal, linkedProjectsCount = 0, onPress, onLongPress }: Props) {
  const status = STATUS_STYLE[goal.status] ?? STATUS_STYLE.not_started;
  const isAtRisk = goal.status === 'at_risk';

  return (
    <TouchableOpacity
      style={[styles.card, isAtRisk && styles.cardAtRisk]}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLongPress?.(); }}
      activeOpacity={0.75}
    >
      {/* Title + status badge */}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>{goal.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <ProgressBar percent={goal.progress_percent} style={styles.progressBar} />
        <Text style={styles.progressLabel}>{goal.progress_percent}%</Text>
      </View>

      {/* Why it matters preview */}
      {!!goal.why_it_matters && (
        <Text style={styles.why} numberOfLines={1}>
          {goal.why_it_matters}
        </Text>
      )}

      {/* Footer: target date + linked projects */}
      <View style={styles.footer}>
        {goal.target_date ? (
          <Text style={styles.footerText}>
            Target: {new Date(goal.target_date + 'T00:00:00').toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </Text>
        ) : (
          <Text style={styles.footerText}>No target date</Text>
        )}
        {linkedProjectsCount > 0 && (
          <Text style={styles.footerText}>
            🗂 {linkedProjectsCount} project{linkedProjectsCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export const GoalCard = React.memo(GoalCardBase);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.blue[100],
    gap: spacing.sm,
  },
  cardAtRisk: {
    borderColor: colors.amber[400],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  statusText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBar: { flex: 1 },
  progressLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.ink.light,
    width: 30,
    textAlign: 'right',
  },
  why: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[500],
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
});
