import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { Activity, Project, ProjectStatus } from '@pm/types';
import { useProjects, useDeleteProject } from '../../src/hooks/useProjects';
import { useActivitiesForProject } from '../../src/hooks/useActivities';
import { ProjectCard, ProjectFormModal } from '../../src/components/projects';
import { colors } from '../../src/theme/colors';
import { borderRadius, spacing } from '../../src/theme/spacing';
import { fontSize, fontFamily } from '../../src/theme/typography';

// ---------------------------------------------------------------------------
// Status filter chips
// ---------------------------------------------------------------------------

const STATUS_FILTERS: { label: string; value: ProjectStatus | 'all' }[] = [
  { label: 'All',         value: 'all' },
  { label: 'Planned',     value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'On Hold',     value: 'on_hold' },
  { label: 'Completed',   value: 'completed' },
  { label: 'Cancelled',   value: 'cancelled' },
];

// ---------------------------------------------------------------------------
// Per-project card wrapper — each card fetches its own activities for metrics
// ---------------------------------------------------------------------------

function ProjectCardWithActivities({
  project,
  onPress,
  onLongPress,
}: {
  project: Project;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { data: rawActivities = [] } = useActivitiesForProject(project.id);
  return (
    <ProjectCard
      project={project}
      activities={rawActivities as Activity[]}
      onPress={onPress}
    />
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProjectListScreen() {
  const [activeFilter, setActiveFilter] = useState<ProjectStatus | 'all'>('all');
  const [formVisible, setFormVisible] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const { data: allProjects = [], isLoading } = useProjects();
  const deleteMutation = useDeleteProject();

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return allProjects;
    return allProjects.filter((p) => p.status === activeFilter);
  }, [allProjects, activeFilter]);

  const handleLongPress = (project: Project) => {
    Alert.alert(project.name, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => { setEditProject(project); setFormVisible(true); } },
      {
        text: 'Delete Project',
        style: 'destructive',
        onPress: () => {
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
                    { onError: (e: Error) => Alert.alert('Error', e.message) },
                  ),
              },
            ],
          );
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Action bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setEditProject(null); setFormVisible(true); }}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {STATUS_FILTERS.map((f) => {
            const isSelected = activeFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.value)}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Project list */}
      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProjectCardWithActivities
            project={item}
            onPress={() => router.push(`/project-planner/${item.id}`)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {activeFilter !== 'all' ? 'No projects with this status.' : 'No projects yet.'}
              </Text>
              {activeFilter === 'all' && (
                <TouchableOpacity onPress={() => setFormVisible(true)}>
                  <Text style={styles.emptyLink}>Create your first project</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />

      <ProjectFormModal
        visible={formVisible}
        editProject={editProject}
        onClose={() => { setFormVisible(false); setEditProject(null); }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.blue[100],
  },
  headerTitle: {
    flex: 1, fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'], color: colors.ink.DEFAULT,
  },
  addBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.blue[600],
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontSize: 22, lineHeight: 26, fontWeight: '300' },
  filterRow: {
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.blue[100],
  },
  filterContent: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray[300], backgroundColor: '#FFFFFF',
  },
  filterChipActive: { backgroundColor: colors.blue[600], borderColor: colors.blue[600] },
  filterChipText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '500', color: colors.ink.light },
  filterChipTextActive: { color: '#FFFFFF' },
  listContent: { paddingTop: spacing.md, paddingBottom: spacing['3xl'] },
  empty: { paddingTop: spacing['3xl'] * 2, alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400], marginBottom: spacing.md, textAlign: 'center' },
  emptyLink: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: '500', color: colors.blue[600] },
});
