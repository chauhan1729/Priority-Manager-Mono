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
import type { AnnualGoal, AnnualGoalSection } from '@pm/types';
import {
  filterActive,
  filterArchived,
  groupGoalsBySection,
  useAnnualGoals,
  useDeleteAnnualGoal,
} from '../../src/hooks/useAnnualGoals';
import { useProjects } from '../../src/hooks/useProjects';
import { GoalCard, GoalFormModal } from '../../src/components/goals';
import { colors } from '../../src/theme/colors';
import { borderRadius, spacing } from '../../src/theme/spacing';
import { fontSize, fontFamily } from '../../src/theme/typography';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SECTION_TABS: { label: string; value: AnnualGoalSection }[] = [
  { label: 'Business', value: 'business' },
  { label: 'Career',   value: 'career' },
  { label: 'Personal', value: 'personal' },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AnnualStrategiesScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activeSection, setActiveSection] = useState<AnnualGoalSection>('business');
  const [showArchived, setShowArchived] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editGoal, setEditGoal] = useState<AnnualGoal | null>(null);

  const { data: allGoals = [], isLoading } = useAnnualGoals(year);
  const { data: allProjects = [] } = useProjects();
  const deleteMutation = useDeleteAnnualGoal();

  // Group and filter goals
  const grouped = useMemo(() => groupGoalsBySection(allGoals), [allGoals]);
  const sectionGoals = useMemo(() => {
    const goals = grouped[activeSection];
    return showArchived ? filterArchived(goals) : filterActive(goals);
  }, [grouped, activeSection, showArchived]);

  // Count linked projects per goal
  const linkedCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const project of allProjects) {
      if (project.linked_annual_goal_id) {
        map[project.linked_annual_goal_id] = (map[project.linked_annual_goal_id] ?? 0) + 1;
      }
    }
    return map;
  }, [allProjects]);

  const handleLongPress = (goal: AnnualGoal) => {
    Alert.alert(goal.title, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => { setEditGoal(goal); setFormVisible(true); } },
      {
        text: 'Delete Goal',
        style: 'destructive',
        onPress: () =>
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
                    { onError: (e: Error) => Alert.alert('Error', e.message) },
                  ),
              },
            ],
          ),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Annual Strategies</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setEditGoal(null); setFormVisible(true); }}
        >
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Year selector */}
      <View style={styles.yearRow}>
        <TouchableOpacity onPress={() => setYear((y) => y - 1)} style={styles.yearArrow}>
          <Text style={styles.yearArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.yearLabel}>{year}</Text>
        <TouchableOpacity onPress={() => setYear((y) => y + 1)} style={styles.yearArrow}>
          <Text style={styles.yearArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Section tabs */}
      <View style={styles.tabBar}>
        {SECTION_TABS.map((tab) => {
          const isSelected = activeSection === tab.value;
          const count = grouped[tab.value]?.length ?? 0;
          return (
            <TouchableOpacity
              key={tab.value}
              style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
              onPress={() => setActiveSection(tab.value)}
            >
              <Text style={[styles.tabBtnText, isSelected && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabCount, isSelected && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, isSelected && styles.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active / Archived toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, !showArchived && styles.toggleBtnActive]}
          onPress={() => setShowArchived(false)}
        >
          <Text style={[styles.toggleBtnText, !showArchived && styles.toggleBtnTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, showArchived && styles.toggleBtnActive]}
          onPress={() => setShowArchived(true)}
        >
          <Text style={[styles.toggleBtnText, showArchived && styles.toggleBtnTextActive]}>
            Archived
          </Text>
        </TouchableOpacity>
      </View>

      {/* Goal list */}
      <FlatList
        data={sectionGoals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            linkedProjectsCount={linkedCountMap[item.id] ?? 0}
            onPress={() => router.push(`/annual-strategies/${item.id}`)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {showArchived
                  ? `No archived ${activeSection} goals for ${year}.`
                  : `No active ${activeSection} goals for ${year}.`}
              </Text>
              {!showArchived && (
                <TouchableOpacity onPress={() => { setEditGoal(null); setFormVisible(true); }}>
                  <Text style={styles.emptyLink}>Add your first goal</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      <GoalFormModal
        visible={formVisible}
        editGoal={editGoal}
        initialSection={activeSection}
        initialYear={year}
        onClose={() => { setFormVisible(false); setEditGoal(null); }}
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
  addBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.blue[600],
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontSize: 22, lineHeight: 26, fontWeight: '300' },

  // Year selector
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.xl,
  },
  yearArrow: { padding: spacing.sm },
  yearArrowText: {
    fontFamily: fontFamily.sans,
    fontSize: 24,
    color: colors.blue[600],
    lineHeight: 28,
  },
  yearLabel: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
    minWidth: 60,
    textAlign: 'center',
  },

  // Section tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.blue[600] },
  tabBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.ink.light,
  },
  tabBtnTextActive: { color: colors.blue[600], fontWeight: '600' },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: colors.blue[100] },
  tabCountText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray[500],
  },
  tabCountTextActive: { color: colors.blue[700] },

  // Active/Archived toggle
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.sm,
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: '#FFFFFF',
  },
  toggleBtnActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  toggleBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
    fontWeight: '500',
  },
  toggleBtnTextActive: { color: '#FFFFFF' },

  // List
  listContent: { paddingTop: spacing.md, paddingBottom: spacing['3xl'] },
  empty: {
    paddingTop: spacing['3xl'] * 2,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.blue[600],
  },
});
