import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { getProjectMetrics, isProjectAtRisk } from '@pm/domain';
import type { Activity, ProjectStatus } from '@pm/types';
import { useProjectById, useMilestones, useResources, useDeleteProject } from '../../src/hooks/useProjects';
import { useActivitiesForProject } from '../../src/hooks/useActivities';
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

  const metrics = useMemo(() => getProjectMetrics(activities), [activities]);
  const atRisk = useMemo(
    () => project ? isProjectAtRisk(project, activities) : false,
    [project, activities],
  );

  const handleDelete = () => {
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{project.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setEditFormVisible(true)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Metrics banner */}
      <View style={[styles.metricsBanner, atRisk && styles.metricsBannerAtRisk]}>
        <View style={styles.metricsRow}>
          <MetricItem label="Tasks" value={`${metrics.completedTasks}/${metrics.totalTasks}`} />
          <MetricItem label="Hours" value={`${metrics.completedHours}/${metrics.totalEstimatedHours}h`} />
          <MetricItem label="Progress" value={`${metrics.progressPercent}%`} />
          {atRisk && (
            <View style={styles.riskBadge}>
              <Text style={styles.riskText}>⚠ At risk</Text>
            </View>
          )}
        </View>
        <ProgressBar percent={metrics.progressPercent} style={styles.progressBar} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['activities', 'milestones', 'resources', 'notes'] as Tab[]).map((tab) => {
          const isSelected = activeTab === tab;
          const labels: Record<Tab, string> = {
            activities: 'Activities',
            milestones: 'Milestones',
            resources: 'Resources',
            notes: 'Notes',
          };
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabBtnText, isSelected && styles.tabBtnTextActive]}>
                {labels[tab]}
              </Text>
            </TouchableOpacity>
          );
        })}
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

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.blue[100],
  },
  backBtn: { paddingVertical: spacing.sm, paddingRight: spacing.sm },
  backText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.blue[600] },
  headerCenter: { flex: 1, gap: 3, alignItems: 'flex-start' },
  headerTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: '600', color: colors.ink.DEFAULT },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  statusText: { fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  editBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  editBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.blue[600], fontWeight: '500' },
  deleteBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  deleteBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.red[600], fontWeight: '500' },

  // Metrics banner
  metricsBanner: {
    backgroundColor: '#FFFFFF', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.blue[100], gap: spacing.sm,
  },
  metricsBannerAtRisk: { borderBottomColor: colors.amber[400] },
  metricsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  metricItem: { alignItems: 'center' },
  metricValue: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: '700', color: colors.ink.DEFAULT },
  metricLabel: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.gray[400] },
  riskBadge: {
    marginLeft: 'auto', paddingHorizontal: spacing.sm, paddingVertical: 2,
    backgroundColor: colors.amber[100], borderRadius: borderRadius.full,
  },
  riskText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: '600', color: colors.amber[700] },
  progressBar: { marginTop: 2 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: colors.blue[100],
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.blue[600] },
  tabBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '500', color: colors.ink.light },
  tabBtnTextActive: { color: colors.blue[600], fontWeight: '600' },

  // Tab content
  tabContent: { flex: 1 },
  tabContentInner: { flexGrow: 1 },
});
