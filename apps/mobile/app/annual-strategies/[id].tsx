import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type { AnnualGoal, AnnualGoalStatus, Project } from '@pm/types';
import { STATUS_LABELS } from '@pm/domain';
import {
  annualGoalKeys,
  useDeleteAnnualGoal,
  useUpdateAnnualGoal,
  useUpdateGoalProgress,
  useUnlinkProjectFromGoal,
} from '../../src/hooks/useAnnualGoals';
import { useProjects } from '../../src/hooks/useProjects';
import { GoalFormModal, ProjectLinkModal } from '../../src/components/goals';
import { ProgressBar } from '../../src/components/ui';
import { colors } from '../../src/theme/colors';
import { borderRadius, spacing } from '../../src/theme/spacing';
import { fontSize, fontFamily } from '../../src/theme/typography';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase/client';
import { useAuth } from '../../src/components/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Status style
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<AnnualGoalStatus, { bg: string; text: string }> = {
  not_started: { bg: colors.gray[100],  text: colors.gray[600] },
  active:      { bg: colors.blue[100],  text: colors.blue[700] },
  on_track:    { bg: colors.green[100], text: colors.green[700] },
  at_risk:     { bg: colors.amber[100], text: colors.amber[700] },
  completed:   { bg: colors.green[100], text: colors.green[700] },
  dropped:     { bg: colors.red[100],   text: colors.red[600] },
};

const ALL_STATUSES: AnnualGoalStatus[] = [
  'not_started', 'active', 'on_track', 'at_risk', 'completed', 'dropped',
];

// ---------------------------------------------------------------------------
// Hook: fetch single goal by id
// ---------------------------------------------------------------------------

function useGoalById(id: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useQuery({
    queryKey: [...annualGoalKeys.all, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('annual_goals')
        .select('*')
        .eq('id', id)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as AnnualGoal;
    },
    initialData: () => {
      // Try to find in any cached year query
      const cached = qc.getQueriesData<AnnualGoal[]>({ queryKey: annualGoalKeys.all });
      for (const [, goals] of cached) {
        if (!goals) continue;
        const found = goals.find((g) => g.id === id);
        if (found) return found;
      }
      return undefined;
    },
    enabled: !!user && !!id,
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [editFormVisible, setEditFormVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);

  // Local draft progress (for optimistic UI while mutating)
  const [localProgress, setLocalProgress] = useState<number | null>(null);

  // Notes debounce
  const [notes, setNotes] = useState('');
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesInitialized = useRef(false);

  const { data: goal, isLoading } = useGoalById(id ?? '');
  const { data: allProjects = [] } = useProjects();
  const progressMutation = useUpdateGoalProgress();
  const updateMutation = useUpdateAnnualGoal();
  const unlinkMutation = useUnlinkProjectFromGoal();
  const deleteMutation = useDeleteAnnualGoal();

  // Projects linked to this goal
  const linkedProjects = useMemo(
    () => allProjects.filter((p) => p.linked_annual_goal_id === id),
    [allProjects, id],
  );

  // Sync notes from fetched goal (once)
  useEffect(() => {
    if (goal && !notesInitialized.current) {
      setNotes(goal.notes ?? '');
      notesInitialized.current = true;
    }
  }, [goal]);

  // Debounced notes save
  const handleNotesChange = useCallback(
    (text: string) => {
      setNotes(text);
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
      notesTimerRef.current = setTimeout(() => {
        if (!goal) return;
        updateMutation.mutate({ id: goal.id, notes: text });
      }, 1000);
    },
    [goal, updateMutation],
  );

  const handleProgressSet = (value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setLocalProgress(clamped);
    if (!goal) return;
    progressMutation.mutate(
      { id: goal.id, progressPercent: clamped },
      { onSuccess: () => setLocalProgress(null) },
    );
  };

  const handleStatusSelect = (status: AnnualGoalStatus) => {
    setStatusPickerOpen(false);
    if (!goal || status === goal.status) return;
    updateMutation.mutate({ id: goal.id, status });
  };

  const handleUnlinkProject = (project: Project) => {
    Alert.alert(
      'Unlink Project',
      `Unlink "${project.name}" from this goal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: () =>
            unlinkMutation.mutate(
              { goalId: goal!.id, projectId: project.id },
              { onError: (e: Error) => Alert.alert('Error', e.message) },
            ),
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!goal) return;
    Alert.alert(
      'Delete Goal',
      `Delete "${goal.title}"? Linked projects will be preserved but unlinked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(
              { id: goal.id },
              {
                onSuccess: () => router.back(),
                onError: (e: Error) => Alert.alert('Error', e.message),
              },
            ),
        },
      ],
    );
  };

  if (isLoading || !goal) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayProgress = localProgress ?? goal.progress_percent;
  const statusStyle = STATUS_STYLE[goal.status] ?? STATUS_STYLE.not_started;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{goal.title}</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.sectionLabel}>{goal.section}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setEditFormVisible(true)} style={styles.headerBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Progress section */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Progress</Text>
          <View style={styles.progressRow}>
            <ProgressBar percent={displayProgress} style={styles.progressBar} />
            <Text style={styles.progressValue}>{displayProgress}%</Text>
          </View>
          {/* Presets */}
          <View style={styles.progressPresets}>
            {[0, 25, 50, 75, 100].map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetBtn,
                  displayProgress === preset && styles.presetBtnActive,
                ]}
                onPress={() => handleProgressSet(preset)}
                disabled={progressMutation.isPending}
              >
                <Text style={[
                  styles.presetBtnText,
                  displayProgress === preset && styles.presetBtnTextActive,
                ]}>
                  {preset}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Fine control */}
          <View style={styles.progressFineRow}>
            <TouchableOpacity
              style={styles.fineBtn}
              onPress={() => handleProgressSet(displayProgress - 5)}
              disabled={progressMutation.isPending || displayProgress <= 0}
            >
              <Text style={styles.fineBtnText}>−5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fineBtn}
              onPress={() => handleProgressSet(displayProgress - 1)}
              disabled={progressMutation.isPending || displayProgress <= 0}
            >
              <Text style={styles.fineBtnText}>−1</Text>
            </TouchableOpacity>
            <View style={styles.fineValueBox}>
              <Text style={styles.fineValue}>{displayProgress}%</Text>
            </View>
            <TouchableOpacity
              style={styles.fineBtn}
              onPress={() => handleProgressSet(displayProgress + 1)}
              disabled={progressMutation.isPending || displayProgress >= 100}
            >
              <Text style={styles.fineBtnText}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fineBtn}
              onPress={() => handleProgressSet(displayProgress + 5)}
              disabled={progressMutation.isPending || displayProgress >= 100}
            >
              <Text style={styles.fineBtnText}>+5</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status picker */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Status</Text>
          <TouchableOpacity
            style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}
            onPress={() => setStatusPickerOpen((o) => !o)}
          >
            <Text style={[styles.statusChipText, { color: statusStyle.text }]}>
              {STATUS_LABELS[goal.status]}
            </Text>
            <Text style={[styles.statusChipCaret, { color: statusStyle.text }]}>
              {statusPickerOpen ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {statusPickerOpen && (
            <View style={styles.statusOptions}>
              {ALL_STATUSES.map((s) => {
                const st = STATUS_STYLE[s];
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusOption, goal.status === s && styles.statusOptionActive]}
                    onPress={() => handleStatusSelect(s)}
                  >
                    <Text style={[styles.statusOptionText, { color: st.text }]}>
                      {STATUS_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Target date */}
        {goal.target_date && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Target Date</Text>
            <Text style={styles.bodyText}>
              {new Date(goal.target_date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </Text>
          </View>
        )}

        {/* Description */}
        {!!goal.description && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Description</Text>
            <Text style={styles.bodyText}>{goal.description}</Text>
          </View>
        )}

        {/* Why it matters */}
        {!!goal.why_it_matters && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Why It Matters</Text>
            <Text style={[styles.bodyText, styles.whyText]}>{goal.why_it_matters}</Text>
          </View>
        )}

        {/* Linked projects */}
        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={styles.cardLabel}>Linked Projects ({linkedProjects.length})</Text>
            <TouchableOpacity onPress={() => setLinkModalVisible(true)}>
              <Text style={styles.linkBtn}>+ Link Project</Text>
            </TouchableOpacity>
          </View>
          {linkedProjects.length === 0 ? (
            <Text style={styles.emptyText}>No projects linked yet.</Text>
          ) : (
            linkedProjects.map((p) => (
              <View key={p.id} style={styles.projectRow}>
                <TouchableOpacity
                  style={styles.projectInfo}
                  onPress={() => router.push(`/project-planner/${p.id}`)}
                >
                  <Text style={styles.projectName}>{p.name}</Text>
                  <Text style={styles.projectStatus}>{p.status.replace('_', ' ')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleUnlinkProject(p)} style={styles.unlinkBtn}>
                  <Text style={styles.unlinkBtnText}>Unlink</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Notes</Text>
          <RNTextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={handleNotesChange}
            placeholder="Add notes…"
            placeholderTextColor={colors.gray[400]}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <GoalFormModal
        visible={editFormVisible}
        editGoal={goal}
        onClose={() => setEditFormVisible(false)}
      />

      <ProjectLinkModal
        visible={linkModalVisible}
        goal={goal}
        linkedProjects={linkedProjects}
        onClose={() => setLinkModalVisible(false)}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  backBtn: { paddingVertical: spacing.sm, paddingRight: spacing.sm },
  backText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.blue[600] },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  headerMeta: { flexDirection: 'row', gap: spacing.xs },
  sectionLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
    textTransform: 'capitalize',
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  editBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.blue[600],
    fontWeight: '500',
  },
  deleteBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.red[600],
    fontWeight: '500',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing['3xl'] },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.blue[100],
    gap: spacing.sm,
  },
  cardLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bodyText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    lineHeight: 22,
  },
  whyText: { fontStyle: 'italic', color: colors.gray[600] },

  // Progress
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressBar: { flex: 1 },
  progressValue: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.blue[600],
    width: 36,
    textAlign: 'right',
  },
  progressPresets: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
  },
  presetBtnActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  presetBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.ink.light,
  },
  presetBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
  progressFineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fineBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.blue[200],
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  fineBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.blue[700],
  },
  fineValueBox: {
    flex: 2,
    alignItems: 'center',
  },
  fineValue: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.blue[600],
  },

  // Status
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  statusChipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  statusChipCaret: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: '#FAFAF8',
  },
  statusOptionActive: {
    borderColor: colors.blue[400],
    backgroundColor: colors.blue[50],
  },
  statusOptionText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },

  // Linked projects
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkBtn: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.blue[600],
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.blue[50],
  },
  projectInfo: { flex: 1, gap: 2 },
  projectName: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.blue[600],
  },
  projectStatus: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
    textTransform: 'capitalize',
  },
  unlinkBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.red[200],
  },
  unlinkBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.red[600],
    fontWeight: '500',
  },
  emptyText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
  },

  // Notes
  notesInput: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
