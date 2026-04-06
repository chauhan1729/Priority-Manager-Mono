import React from 'react';
import * as Haptics from 'expo-haptics';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getProjectMetrics, isProjectAtRisk } from '@pm/domain';
import type { Activity, Project, ProjectStatus } from '@pm/types';
import { ProgressBar } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<ProjectStatus, { bg: string; text: string; label: string }> = {
  planned:     { bg: colors.gray[100],   text: colors.gray[600],   label: 'Planned' },
  in_progress: { bg: colors.blue[100],   text: colors.blue[700],   label: 'In Progress' },
  on_hold:     { bg: colors.amber[100],  text: colors.amber[700],  label: 'On Hold' },
  completed:   { bg: colors.green[100],  text: colors.green[700],  label: 'Completed' },
  cancelled:   { bg: colors.red[100],    text: colors.red[600],    label: 'Cancelled' },
};

interface Props {
  project: Project;
  activities: Activity[];
  onPress: () => void;
}

function ProjectCardBase({ project, activities, onPress }: Props) {
  const status = STATUS_STYLE[project.status] ?? STATUS_STYLE.planned;
  const metrics = getProjectMetrics(activities);
  const atRisk = isProjectAtRisk(project, activities);

  return (
    <TouchableOpacity
      style={[styles.card, atRisk && styles.cardAtRisk]}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      activeOpacity={0.75}
    >
      {/* Name + status */}
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{project.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>

      {/* Description */}
      {project.description ? (
        <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
      ) : null}

      {/* Progress bar */}
      <ProgressBar percent={metrics.progressPercent} style={styles.progressBar} />

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <Text style={styles.metric}>
          {metrics.completedTasks}/{metrics.totalTasks} tasks
        </Text>
        <Text style={styles.metricDot}>·</Text>
        <Text style={styles.metric}>
          {metrics.completedHours}/{metrics.totalEstimatedHours}h
        </Text>
        <Text style={styles.metricDot}>·</Text>
        <Text style={styles.metric}>{metrics.progressPercent}%</Text>
        {atRisk && <Text style={styles.riskLabel}>⚠ At risk</Text>}
      </View>

      {/* Dates */}
      {(project.start_date || project.target_end_date) && (
        <Text style={styles.dates}>
          {project.start_date ? formatDate(project.start_date) : '—'} →{' '}
          {project.target_end_date ? formatDate(project.target_end_date) : '—'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const ProjectCard = React.memo(ProjectCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardAtRisk: {
    borderColor: colors.amber[400],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
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
  description: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
  },
  progressBar: {
    marginVertical: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metric: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },
  metricDot: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[300],
  },
  riskLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.amber[600],
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  dates: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
});
