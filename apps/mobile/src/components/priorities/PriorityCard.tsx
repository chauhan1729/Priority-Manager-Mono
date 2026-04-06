import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { MonthlyPriority, MonthlyPriorityStatus } from '@pm/types';
import {
  getEffectiveProgress,
  isEligibleForCarryForward,
  isStale,
  MP_STATUS_LABELS,
} from '@pm/domain';
import { useCarryForwardPriority, useUpdatePriorityStatus } from '../../hooks/useMonthlyPriorities';
import { ProgressBar } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Status style map
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<MonthlyPriorityStatus, { bg: string; text: string }> = {
  planned:     { bg: colors.gray[100],  text: colors.gray[600] },
  in_progress: { bg: colors.blue[100],  text: colors.blue[700] },
  on_hold:     { bg: colors.amber[100], text: colors.amber[700] },
  completed:   { bg: colors.green[100], text: colors.green[700] },
  dropped:     { bg: colors.red[100],   text: colors.red[600] },
};

const QUICK_STATUSES: MonthlyPriorityStatus[] = [
  'planned', 'in_progress', 'on_hold', 'completed', 'dropped',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  priority: MonthlyPriority;
  linkedGoalTitle?: string | null;
  linkedProjectName?: string | null;
  projectProgressPercent?: number | null;
  onPress: () => void;
  onLongPress: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PriorityCardBase({
  priority,
  linkedGoalTitle,
  linkedProjectName,
  projectProgressPercent,
  onPress,
  onLongPress,
}: Props) {
  const statusStyle = STATUS_STYLE[priority.status] ?? STATUS_STYLE.planned;
  const effectiveProgress = getEffectiveProgress(priority, projectProgressPercent ?? null);
  const stale = isStale(priority);
  const eligible = isEligibleForCarryForward(priority);

  const carryForwardMutation = useCarryForwardPriority();
  const statusMutation = useUpdatePriorityStatus();

  const handleCarryForward = () => {
    Alert.alert(
      'Carry Forward',
      `Carry "${priority.title}" to next month?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Carry Forward',
          onPress: () =>
            carryForwardMutation.mutate(
              { priorityId: priority.id, sourceMonthKey: priority.month_key },
              { onError: (e: Error) => Alert.alert('Error', e.message) },
            ),
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLongPress(); }}
      activeOpacity={0.75}
    >
      {/* Title row */}
      <View style={styles.titleRow}>
        {priority.pinned && <Text style={styles.pin}>📌</Text>}
        <Text style={styles.title} numberOfLines={2}>{priority.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {MP_STATUS_LABELS[priority.status]}
          </Text>
        </View>
      </View>

      {/* Category + stale */}
      {(priority.category || stale) && (
        <View style={styles.metaRow}>
          {priority.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{priority.category}</Text>
            </View>
          )}
          {stale && (
            <View style={styles.staleBadge}>
              <Text style={styles.staleText}>⚠ Stale</Text>
            </View>
          )}
        </View>
      )}

      {/* Progress */}
      <View style={styles.progressRow}>
        <ProgressBar percent={effectiveProgress} style={styles.progressBar} />
        <Text style={styles.progressLabel}>{effectiveProgress}%</Text>
        {priority.progress_mode === 'auto_project' && (
          <Text style={styles.autoTag}>auto</Text>
        )}
      </View>

      {/* Linked goal / project badges */}
      {(linkedGoalTitle || linkedProjectName) && (
        <View style={styles.linksRow}>
          {linkedGoalTitle && (
            <View style={styles.linkBadge}>
              <Text style={styles.linkBadgeText} numberOfLines={1}>🎯 {linkedGoalTitle}</Text>
            </View>
          )}
          {linkedProjectName && (
            <View style={[styles.linkBadge, styles.projectBadge]}>
              <Text style={styles.linkBadgeText} numberOfLines={1}>🗂 {linkedProjectName}</Text>
            </View>
          )}
        </View>
      )}

      {/* Carry-forward button */}
      {eligible && (
        <TouchableOpacity
          style={styles.carryBtn}
          onPress={handleCarryForward}
          disabled={carryForwardMutation.isPending}
        >
          <Text style={styles.carryBtnText}>
            {carryForwardMutation.isPending ? 'Carrying…' : '↩ Carry to Next Month'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export const PriorityCard = React.memo(PriorityCardBase);

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  pin: { fontSize: 12, lineHeight: 20 },
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
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.purple[100],
  },
  categoryText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '500',
    color: colors.purple[700],
  },
  staleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.amber[100],
  },
  staleText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    color: colors.amber[700],
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  autoTag: {
    fontFamily: fontFamily.sans,
    fontSize: 9,
    color: colors.blue[500],
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  linkBadge: {
    flexShrink: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.blue[50],
    maxWidth: '60%',
  },
  projectBadge: {
    backgroundColor: colors.green[50],
  },
  linkBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    color: colors.blue[700],
  },
  carryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.blue[300],
    backgroundColor: colors.blue[50],
  },
  carryBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.blue[700],
  },
});
