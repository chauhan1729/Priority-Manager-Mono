import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { getProjectMetrics, isProjectAtRisk } from '@pm/domain';
import type { Activity, ProjectStatus } from '@pm/types';
import { useProjectById, useMilestones, useResources, useDeleteProject } from '../../src/hooks/useProjects';
import { useActivitiesForProject } from '../../src/hooks/useActivities';
import { supabase } from '../../src/lib/supabase/client';
import {
  ActivitiesTab,
  MilestonesTab,
  NotesTab,
  ProjectFormModal,
  ResourcesTab,
} from '../../src/components/projects';
import { ProgressBar } from '../../src/components/ui';
import { colors } from '../../src/theme/colors';
import { borderRadius, spacing } from '../../src/theme/spacing';
import { fontSize, fontFamily } from '../../src/theme/typography';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type Tab = 'activities' | 'milestones' | 'resources' | 'notes';

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatMediumDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_STYLE: Record<ProjectStatus, { bg: string; text: string; label: string }> = {
  planned:     { bg: colors.gray[100],  text: colors.gray[600],  label: 'Planned' },
  in_progress: { bg: colors.blue[100],  text: colors.blue[700],  label: 'In Progress' },
  on_hold:     { bg: colors.amber[100], text: colors.amber[700], label: 'On Hold' },
  completed:   { bg: colors.green[100], text: colors.green[700], label: 'Completed' },
  cancelled:   { bg: colors.red[100],   text: colors.red[600],   label: 'Cancelled' },
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('activities');
  const [editFormVisible, setEditFormVisible] = useState(false);

  const { data: project, isLoading: projectLoading } = useProjectById(id ?? '');
  const { data: rawActivities = [] } = useActivitiesForProject(id ?? '');
  const { data: milestones = [] } = useMilestones(id ?? '');
  const { data: resources = [] } = useResources(id ?? '');
  const deleteMutation = useDeleteProject();

  const activities = rawActivities as Activity[];

  // Linked records: fetch title for linked annual goal and monthly priority (if set)
  const { data: linkedGoalTitle = null } = useQuery({
    queryKey: ['annualGoalTitle', project?.linked_annual_goal_id],
    queryFn: async () => {
      if (!project?.linked_annual_goal_id) return null;
      const { data } = await supabase
        .from('annual_goals')
        .select('title')
        .eq('id', project.linked_annual_goal_id)
        .maybeSingle();
      return (data?.title as string) ?? null;
    },
    enabled: !!project?.linked_annual_goal_id,
  });

  const { data: linkedPriorityTitle = null } = useQuery({
    queryKey: ['monthlyPriorityTitle', project?.linked_monthly_priority_id],
    queryFn: async () => {
      if (!project?.linked_monthly_priority_id) return null;
      const { data } = await supabase
        .from('monthly_priorities')
        .select('title')
        .eq('id', project.linked_monthly_priority_id)
        .maybeSingle();
      return (data?.title as string) ?? null;
    },
    enabled: !!project?.linked_monthly_priority_id,
  });

  const metrics = useMemo(() => getProjectMetrics(activities), [activities]);
  const atRisk = useMemo(
    () => project ? isProjectAtRisk(project, activities) : false,
    [project, activities],
  );

  const nextTask = useMemo<Activity | null>(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const upcoming = activities
      .filter((a) => a.status !== 'completed' && a.activity_date >= todayISO)
      .sort((a, b) => a.activity_date.localeCompare(b.activity_date));
    return upcoming[0] ?? null;
  }, [activities]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const isOverdue =
    !!project &&
    project.target_end_date != null &&
    project.target_end_date < todayISO &&
    project.status !== 'completed';
  const isNoProgress =
    !!project && project.status === 'in_progress' && metrics.progressPercent === 0;

  const handleMenuPress = () => {
    if (!project) return;
    Alert.alert(project.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit Project', onPress: () => setEditFormVisible(true) },
      { text: 'Delete Project', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  const confirmDelete = () => {
    if (!project) return;
    Alert.alert(
      'Delete Project',
      `Delete "${project.name}"? All linked activities will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(
              { id: project.id },
              {
                onSuccess: () => router.back(),
                onError: (e: Error) => Alert.alert('Error', e.message),
              },
            ),
        },
      ],
    );
  };

  if (projectLoading || !project) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_STYLE[project.status] ?? STATUS_STYLE.planned;
  const hasDateRange = !!(project.start_date || project.target_end_date);
  const hasLinks = !!linkedGoalTitle || !!linkedPriorityTitle;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Compact header — back, title/dates, ⋯ menu */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>{project.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
            </View>
          </View>
          {hasDateRange && (
            <Text style={styles.headerSubline} numberOfLines={1}>
              {formatMediumDate(project.start_date)} → {formatMediumDate(project.target_end_date)}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={handleMenuPress} style={styles.menuBtn} hitSlop={8}>
          <Text style={styles.menuBtnText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Identity extras — description + linked chips (only if present) */}
      {(project.description || hasLinks) && (
        <View style={styles.identityBlock}>
          {project.description ? (
            <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
          ) : null}
          {hasLinks && (
            <View style={styles.chipsRow}>
              {linkedGoalTitle ? (
                <View style={[styles.linkedChip, styles.linkedChipGoal]}>
                  <Text style={styles.linkedChipGoalText} numberOfLines={1}>🎯 {linkedGoalTitle}</Text>
                </View>
              ) : null}
              {linkedPriorityTitle ? (
                <View style={[styles.linkedChip, styles.linkedChipPriority]}>
                  <Text style={styles.linkedChipPriorityText} numberOfLines={1}>📌 {linkedPriorityTitle}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      )}

      {/* Status block — single compact card with progress + callouts */}
      <View style={[styles.statusCard, atRisk && styles.statusCardAtRisk]}>
        <View style={styles.statusMetricsRow}>
          <Text style={styles.statusPercent}>{metrics.progressPercent}%</Text>
          <Text style={styles.statusMetrics}>
            {metrics.completedTasks}/{metrics.totalTasks} tasks · {metrics.completedHours}/{metrics.totalEstimatedHours}h
          </Text>
          {atRisk && (
            <View style={styles.riskPill}>
              <Text style={styles.riskPillText}>⚠ At risk</Text>
            </View>
          )}
        </View>
        <ProgressBar percent={metrics.progressPercent} style={styles.progressBar} />
        {/* Inline callouts — stay compact */}
        {nextTask && (
          <View style={styles.calloutRow}>
            <Text style={styles.calloutLabel}>Next</Text>
            <Text style={styles.calloutTitle} numberOfLines={1}>{nextTask.title}</Text>
            <Text style={styles.calloutDate}>{formatShortDate(nextTask.activity_date)}</Text>
          </View>
        )}
        {atRisk && (
          <Text style={styles.riskCalloutText} numberOfLines={2}>
            {isOverdue && isNoProgress
              ? 'Overdue with no recorded progress. Update status or target date.'
              : isOverdue
              ? `Target was ${formatMediumDate(project.target_end_date)}. Status: ${status.label.toLowerCase()}.`
              : 'In progress but no completed tasks yet.'}
          </Text>
        )}
      </View>

      {/* Horizontally scrollable tab bar with pills */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {(['activities', 'milestones', 'resources', 'notes'] as Tab[]).map((tab) => {
            const isSelected = activeTab === tab;
            const labels: Record<Tab, string> = {
              activities: 'Activities',
              milestones: 'Milestones',
              resources: 'Resources',
              notes: 'Notes',
            };
            const badge: Record<Tab, string | null> = {
              activities: metrics.totalTasks > 0 ? `${metrics.completedTasks}/${metrics.totalTasks}` : null,
              milestones: milestones.length > 0 ? String(milestones.length) : null,
              resources: resources.length > 0 ? String(resources.length) : null,
              notes: null,
            };
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabPill, isSelected && styles.tabPillActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabPillText, isSelected && styles.tabPillTextActive]}>
                  {labels[tab]}
                </Text>
                {badge[tab] && (
                  <View style={[styles.tabBadge, isSelected && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isSelected && styles.tabBadgeTextActive]}>
                      {badge[tab]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab content */}
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
        {activeTab === 'activities' && (
          <ActivitiesTab projectId={project.id} activities={activities} />
        )}
        {activeTab === 'milestones' && (
          <MilestonesTab projectId={project.id} milestones={milestones} />
        )}
        {activeTab === 'resources' && (
          <ResourcesTab projectId={project.id} resources={resources} />
        )}
        {activeTab === 'notes' && (
          <NotesTab projectId={project.id} initialNotes={project.notes} />
        )}
      </ScrollView>

      <ProjectFormModal
        visible={editFormVisible}
        editProject={project}
        onClose={() => setEditFormVisible(false)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.xs,
  },
  backBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  backText: {
    fontFamily: fontFamily.sans,
    fontSize: 28,
    color: colors.blue[600],
    lineHeight: 28,
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
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
  },
  statusText: { fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600' },
  headerSubline: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  menuBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 32,
    alignItems: 'center',
  },
  menuBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: 22,
    color: colors.ink.light,
    fontWeight: '700',
    lineHeight: 22,
  },

  // Identity extras (description + chips)
  identityBlock: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.xs,
  },
  description: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
    lineHeight: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  linkedChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    maxWidth: '80%',
  },
  linkedChipGoal: {
    backgroundColor: colors.blue[50],
    borderColor: colors.blue[200],
  },
  linkedChipGoalText: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.blue[700],
    fontWeight: '500',
  },
  linkedChipPriority: {
    backgroundColor: colors.violet[50],
    borderColor: colors.violet[200],
  },
  linkedChipPriorityText: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.violet[700],
    fontWeight: '500',
  },

  // Status card (progress + callouts)
  statusCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.xs,
  },
  statusCardAtRisk: { borderBottomColor: colors.amber[400] },
  statusMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusPercent: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.ink.DEFAULT,
  },
  statusMetrics: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },
  riskPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.amber[100],
  },
  riskPillText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '700',
    color: colors.amber[700],
  },
  progressBar: { marginTop: 2 },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  calloutLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '700',
    color: colors.blue[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: colors.blue[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  calloutTitle: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.DEFAULT,
  },
  calloutDate: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },
  riskCalloutText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.amber[700],
    lineHeight: 16,
    marginTop: 2,
  },

  // Tab bar (horizontal scroll pills)
  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  tabBarContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  tabPillActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  tabPillText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.ink.light,
  },
  tabPillTextActive: { color: '#FFFFFF' },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    backgroundColor: colors.blue[50],
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '700',
    color: colors.blue[700],
  },
  tabBadgeTextActive: { color: '#FFFFFF' },

  // Tab content
  tabContent: { flex: 1 },
  tabContentInner: { flexGrow: 1 },
});
