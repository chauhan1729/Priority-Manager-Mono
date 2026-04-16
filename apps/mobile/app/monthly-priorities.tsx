import React, { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Activity, MonthlyPriority, MonthlyPrioritySection, MonthlyPriorityStatus } from '@pm/types';
import {
  calcProjectProgress,
  formatMonthLabel,
  getCurrentMonthKey,
  getNextMonthKey,
  getPrevMonthKey,
  groupBySection,
  MAX_PRIORITIES_PER_SECTION,
} from '@pm/domain';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../src/lib/supabase/client';
import { useAuth } from '../src/components/providers/AuthProvider';
import {
  useMonthlyPriorities,
  useDeleteMonthlyPriority,
  useUpdatePriorityStatus,
} from '../src/hooks/useMonthlyPriorities';
import { useAnnualGoals } from '../src/hooks/useAnnualGoals';
import { useProjects } from '../src/hooks/useProjects';
import { router } from 'expo-router';
import {
  MonthEndReviewModal,
  PriorityCard,
  PriorityFormModal,
} from '../src/components/priorities';
import { SkeletonList } from '../src/components/ui';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily } from '../src/theme/typography';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPastMonth(monthKey: string): boolean {
  return monthKey < getCurrentMonthKey();
}

const QUICK_STATUSES: { label: string; value: MonthlyPriorityStatus }[] = [
  { label: 'Planned',     value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'On Hold',     value: 'on_hold' },
  { label: 'Completed',   value: 'completed' },
  { label: 'Dropped',     value: 'dropped' },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MonthlyPrioritiesScreen() {
  const { user } = useAuth();
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [formVisible, setFormVisible] = useState(false);
  const [editPriority, setEditPriority] = useState<MonthlyPriority | null>(null);
  const [rewriteFromPriority, setRewriteFromPriority] = useState<MonthlyPriority | null>(null);
  const [rewriteTargetMonth, setRewriteTargetMonth] = useState<string | null>(null);
  const [initialSection, setInitialSection] = useState<MonthlyPrioritySection>('business_career');
  const [reviewVisible, setReviewVisible] = useState(false);
  const [pendingNavDirection, setPendingNavDirection] = useState<'prev' | 'next' | null>(null);

  const { data: priorities = [], isLoading, refetch } = useMonthlyPriorities(monthKey);
  const [refreshing, setRefreshing] = useState(false);
  const { data: allGoals = [] } = useAnnualGoals(new Date().getFullYear());
  const { data: allProjects = [] } = useProjects();
  const deleteMutation = useDeleteMonthlyPriority();
  const statusMutation = useUpdatePriorityStatus();

  // Build lookup maps for linked entities
  const goalMap = useMemo(
    () => Object.fromEntries(allGoals.map((g) => [g.id, g])),
    [allGoals],
  );
  const projectMap = useMemo(
    () => Object.fromEntries(allProjects.map((p) => [p.id, p])),
    [allProjects],
  );

  // Auto-progress calculation — fetch activities for all linked projects with auto_project mode
  // and compute per-project progress using the shared domain helper.
  const autoProjectIds = useMemo(
    () =>
      Array.from(
        new Set(
          priorities
            .filter((p) => p.progress_mode === 'auto_project' && p.linked_project_id)
            .map((p) => p.linked_project_id as string),
        ),
      ),
    [priorities],
  );

  const { data: autoActivities = [] } = useQuery({
    queryKey: ['activities', 'forProjects', autoProjectIds],
    queryFn: async () => {
      if (!user || autoProjectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .in('linked_project_id', autoProjectIds);
      if (error) throw error;
      return data as Activity[];
    },
    enabled: !!user && autoProjectIds.length > 0,
  });

  const projectProgressMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const projectId of autoProjectIds) {
      const projectActivities = autoActivities.filter((a) => a.linked_project_id === projectId);
      map[projectId] = calcProjectProgress(projectActivities);
    }
    return map;
  }, [autoProjectIds, autoActivities]);

  const grouped = useMemo(() => groupBySection(priorities), [priorities]);

  const isPast = isPastMonth(monthKey);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (isPast) {
      // Prompt review before leaving a past month
      setPendingNavDirection(direction);
      setReviewVisible(true);
    } else {
      applyNavigation(direction);
    }
  };

  const applyNavigation = (direction: 'prev' | 'next') => {
    setMonthKey((k) =>
      direction === 'prev' ? getPrevMonthKey(k) : getNextMonthKey(k),
    );
  };

  const handleReviewClose = () => {
    setReviewVisible(false);
    if (pendingNavDirection) {
      applyNavigation(pendingNavDirection);
      setPendingNavDirection(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Long-press action sheet
  // ---------------------------------------------------------------------------

  const handleLongPress = (priority: MonthlyPriority) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: priority.title,
          options: [
            'Cancel',
            'Edit',
            ...QUICK_STATUSES.map((s) => `Set: ${s.label}`),
            'Delete',
          ],
          cancelButtonIndex: 0,
          destructiveButtonIndex: QUICK_STATUSES.length + 2,
        },
        (idx) => {
          if (idx === 1) {
            setEditPriority(priority);
            setFormVisible(true);
          } else if (idx >= 2 && idx <= QUICK_STATUSES.length + 1) {
            const status = QUICK_STATUSES[idx - 2]!.value;
            statusMutation.mutate(
              { id: priority.id, status, month_key: priority.month_key },
              { onError: (e: Error) => Alert.alert('Error', e.message) },
            );
          } else if (idx === QUICK_STATUSES.length + 2) {
            confirmDelete(priority);
          }
        },
      );
    } else {
      Alert.alert(priority.title, 'What would you like to do?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit', onPress: () => { setEditPriority(priority); setFormVisible(true); } },
        ...QUICK_STATUSES.map((s) => ({
          text: `Set: ${s.label}`,
          onPress: () =>
            statusMutation.mutate(
              { id: priority.id, status: s.value, month_key: priority.month_key },
              { onError: (e: Error) => Alert.alert('Error', e.message) },
            ),
        })),
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(priority) },
      ]);
    }
  };

  const confirmDelete = (priority: MonthlyPriority) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Priority',
      `Delete "${priority.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(
              { id: priority.id, month_key: priority.month_key },
              { onError: (e: Error) => Alert.alert('Error', e.message) },
            ),
        },
      ],
    );
  };

  // ---------------------------------------------------------------------------
  // Render section
  // ---------------------------------------------------------------------------

  const renderSection = (
    section: MonthlyPrioritySection,
    label: string,
    sectionPriorities: MonthlyPriority[],
  ) => {
    const count = sectionPriorities.length;
    return (
      <View style={styles.sectionBlock} key={section}>
        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{label}</Text>
          <View style={styles.sectionMeta}>
            <Text style={[styles.sectionCount, count >= MAX_PRIORITIES_PER_SECTION && styles.sectionCountFull]}>
              {count}/{MAX_PRIORITIES_PER_SECTION}
            </Text>
            <TouchableOpacity
              style={[styles.addSectionBtn, count >= MAX_PRIORITIES_PER_SECTION && styles.addSectionBtnDisabled]}
              disabled={count >= MAX_PRIORITIES_PER_SECTION}
              onPress={() => {
                setEditPriority(null);
                setInitialSection(section);
                setFormVisible(true);
              }}
            >
              <Text style={[styles.addSectionBtnText, count >= MAX_PRIORITIES_PER_SECTION && styles.addSectionBtnTextDisabled]}>
                + Add
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Priority cards */}
        {sectionPriorities.length === 0 ? (
          <View style={styles.sectionEmpty}>
            <Text style={styles.sectionEmptyText}>No priorities yet.</Text>
          </View>
        ) : (
          sectionPriorities.map((p) => (
            <PriorityCard
              key={p.id}
              priority={p}
              linkedGoalTitle={p.linked_annual_goal_id ? goalMap[p.linked_annual_goal_id]?.title ?? null : null}
              linkedProjectName={p.linked_project_id ? projectMap[p.linked_project_id]?.name ?? null : null}
              projectProgressPercent={
                p.linked_project_id && projectProgressMap[p.linked_project_id] !== undefined
                  ? projectProgressMap[p.linked_project_id] ?? null
                  : null
              }
              onPress={() => { setEditPriority(p); setFormVisible(true); }}
              onLongPress={() => handleLongPress(p)}
              onOpenProject={
                p.linked_project_id
                  ? () => router.push(`/project-planner/${p.linked_project_id}`)
                  : undefined
              }
              onOpenGoal={
                p.linked_annual_goal_id
                  ? () => router.push('/annual-strategies')
                  : undefined
              }
            />
          ))
        )}
        {count >= MAX_PRIORITIES_PER_SECTION && (
          <Text style={styles.capacityWarning}>
            Section at capacity. Complete or drop a priority first.
          </Text>
        )}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Action bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        {isPast && (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => setReviewVisible(true)}
          >
            <Text style={styles.reviewBtnText}>Review</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Month navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navArrow}>
          <Text style={styles.navArrowText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.monthLabelCol}>
          <Text style={styles.monthLabel}>{formatMonthLabel(monthKey)}</Text>
          {monthKey !== getCurrentMonthKey() && (
            <TouchableOpacity onPress={() => setMonthKey(getCurrentMonthKey())}>
              <Text style={styles.todayLink}>This month</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navArrow}>
          <Text style={styles.navArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
          />
        }
      >
        {isLoading ? (
          <SkeletonList count={4} />
        ) : (
          <>
            {renderSection('business_career', 'Business / Career', grouped.business_career)}
            {renderSection('personal', 'Personal', grouped.personal)}
          </>
        )}
      </ScrollView>

      {/* Form modal */}
      <PriorityFormModal
        visible={formVisible}
        editPriority={editPriority}
        rewriteFromPriority={rewriteFromPriority}
        initialSection={initialSection}
        monthKey={rewriteTargetMonth ?? monthKey}
        annualGoals={allGoals}
        projects={allProjects}
        onClose={() => {
          setFormVisible(false);
          setEditPriority(null);
          setRewriteFromPriority(null);
          setRewriteTargetMonth(null);
        }}
      />

      {/* Month-end review modal */}
      <MonthEndReviewModal
        visible={reviewVisible}
        monthLabel={formatMonthLabel(monthKey)}
        priorities={priorities}
        onClose={handleReviewClose}
        onRewrite={(priority) => {
          // Open form pre-filled with priority, targeted at next month
          setRewriteFromPriority(priority);
          setRewriteTargetMonth(getNextMonthKey(monthKey));
          setFormVisible(true);
        }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
  },
  reviewBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.amber[400],
    backgroundColor: colors.amber[50],
  },
  reviewBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.amber[700],
  },

  // Month navigator
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.xl,
  },
  navArrow: { padding: spacing.sm },
  navArrowText: {
    fontFamily: fontFamily.sans,
    fontSize: 24,
    color: colors.blue[600],
    lineHeight: 28,
  },
  monthLabelCol: {
    alignItems: 'center',
    minWidth: 160,
  },
  monthLabel: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
    textAlign: 'center',
  },
  todayLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[600],
    fontWeight: '500',
    marginTop: 2,
  },
  capacityWarning: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.amber[700],
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    fontStyle: 'italic',
  },

  // Content
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: spacing.md, paddingBottom: spacing['3xl'] },
  loading: { paddingTop: spacing['3xl'] * 2, alignItems: 'center' },
  loadingText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },

  // Section block
  sectionBlock: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.ink.DEFAULT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionCount: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
    fontWeight: '600',
  },
  sectionCountFull: { color: colors.red[500] },
  addSectionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.blue[600],
  },
  addSectionBtnDisabled: { backgroundColor: colors.gray[200] },
  addSectionBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addSectionBtnTextDisabled: { color: colors.gray[400] },
  sectionEmpty: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionEmptyText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
  },
});
