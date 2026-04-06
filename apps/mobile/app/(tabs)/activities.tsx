import React, { useState } from 'react';
import {
  Alert,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  canAddAPriority,
  exceedsDailyCapacity,
  groupActivitiesBySection,
  MAX_A_PRIORITY_PER_DAY,
} from '@pm/domain';
import type { Activity, ActivitySection } from '@pm/types';
import {
  useActivitiesForDate,
  usePreviousDayIncomplete,
  useCarryForwardActivity,
} from '../../src/hooks/useActivities';
import { useActiveProjects } from '../../src/hooks/useProjects';
import { useContacts } from '../../src/hooks/useContacts';
import { ActivityCard } from '../../src/components/activities/ActivityCard';
import { ActivityFormModal } from '../../src/components/activities/ActivityFormModal';
import type { ActivityFormValues } from '../../src/components/activities/ActivityForm';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Toast, useToast } from '../../src/components/ui/Toast';
import { CompletionCelebrationModal } from '../../src/components/ui';
import * as Haptics from 'expo-haptics';
import { useCreateActivity, useUpdateActivity } from '../../src/hooks/useActivities';
import { colors } from '../../src/theme/colors';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../src/theme/typography';
import { addDays, formatHeaderDate, todayISO } from '../../src/lib/dateUtils';
import type { SelectOption } from '../../src/components/ui/SelectPickerField';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTION_ORDER: ActivitySection[] = ['work', 'outside', 'unplanned', 'delegated'];
const SECTION_LABELS: Record<ActivitySection, string> = {
  work: 'Work',
  outside: 'Outside',
  unplanned: 'Unplanned / Sudden',
  delegated: 'Delegated',
};

// ---------------------------------------------------------------------------
// Default form values
// ---------------------------------------------------------------------------

function defaultFormValues(date: string): ActivityFormValues {
  return {
    title: '',
    section_type: 'work',
    priority: null,
    activity_date: date,
    estimated_hours: '1',
    linked_project_id: null,
    delegated_contact_id: null,
    note: '',
  };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ActivitiesScreen() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [showAdd, setShowAdd] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [carryForwardCollapsed, setCarryForwardCollapsed] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const prevAllDoneRef = React.useRef(false);

  const previousDate = addDays(selectedDate, -1);
  const { toastProps, show: showToast } = useToast();

  // Data
  const { data: activities = [], isLoading, refetch } = useActivitiesForDate(selectedDate);
  const [refreshing, setRefreshing] = useState(false);
  const { data: prevIncomplete = [] } = usePreviousDayIncomplete(previousDate);
  const { data: projects = [] } = useActiveProjects();
  const { data: contacts = [] } = useContacts();

  // Mutations
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const carryForward = useCarryForwardActivity();

  // Derived
  const activeActivities = activities.filter((a) => !a.archived);
  const grouped = groupActivitiesBySection(activeActivities);

  // Fire celebration when ALL activities transition to completed/cancelled
  React.useEffect(() => {
    if (activeActivities.length === 0) {
      prevAllDoneRef.current = false;
      return;
    }
    const allDone = activeActivities.every(
      (a) => a.status === 'completed' || a.status === 'cancelled',
    );
    if (allDone && !prevAllDoneRef.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCelebrationVisible(true);
    }
    prevAllDoneRef.current = allDone;
  }, [activeActivities]);
  const canAddA = canAddAPriority(activeActivities);
  const aPriorityCount = activeActivities.filter((a) => a.priority === 'A').length;
  const capacityExceeded = exceedsDailyCapacity(activeActivities);

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const contactMap = new Map(contacts.map((c) => [c.id, c.full_name]));

  const projectOptions: SelectOption[] = projects.map((p) => ({ label: p.name, value: p.id }));
  const contactOptions: SelectOption[] = contacts.map((c) => ({ label: c.full_name, value: c.id }));

  // SectionList data
  const sections = SECTION_ORDER
    .filter((s) => grouped[s].length > 0)
    .map((s) => ({
      key: s,
      label: SECTION_LABELS[s],
      data: grouped[s],
      totalHours: grouped[s].reduce((sum, a) => sum + a.estimated_minutes, 0) / 60,
    }));

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleCarryForward(activity: Activity) {
    carryForward.mutate(
      { activityId: activity.id, fromDate: previousDate, toDate: selectedDate },
      {
        onSuccess: () => showToast('Activity moved to today'),
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      }
    );
  }

  function handleCreateSubmit(values: ActivityFormValues) {
    const hours = parseFloat(values.estimated_hours);
    createActivity.mutate(
      {
        title: values.title,
        section_type: values.section_type,
        priority: values.priority,
        activity_date: values.activity_date,
        estimated_minutes: Math.round(hours * 60),
        linked_project_id: values.linked_project_id,
        delegated_contact_id: values.delegated_contact_id,
        note: values.note || null,
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          showToast('Activity created');
        },
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      }
    );
  }

  function handleEditSubmit(values: ActivityFormValues) {
    if (!editActivity) return;
    const hours = parseFloat(values.estimated_hours);
    updateActivity.mutate(
      {
        id: editActivity.id,
        title: values.title,
        section_type: values.section_type,
        priority: values.priority,
        activity_date: values.activity_date,
        estimated_minutes: Math.round(hours * 60),
        linked_project_id: values.linked_project_id,
        note: values.note || null,
      },
      {
        onSuccess: () => {
          setEditActivity(null);
          showToast('Activity updated');
        },
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Date navigation header */}
      <View style={styles.header}>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => setSelectedDate(addDays(selectedDate, -1))} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{formatHeaderDate(selectedDate)}</Text>
          <TouchableOpacity onPress={() => setSelectedDate(addDays(selectedDate, 1))} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
        {selectedDate !== todayISO() && (
          <TouchableOpacity onPress={() => setSelectedDate(todayISO())}>
            <Text style={styles.todayLink}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Warnings */}
      {capacityExceeded && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>⚠ Daily capacity exceeds 8 hours</Text>
        </View>
      )}
      {!canAddA && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Max {MAX_A_PRIORITY_PER_DAY} A-priorities reached for this day
          </Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
          />
        }
        ListHeaderComponent={
          <>
            {/* Carry-forward panel */}
            {prevIncomplete.length > 0 && (
              <View style={styles.carryPanel}>
                <TouchableOpacity
                  style={styles.carryHeader}
                  onPress={() => setCarryForwardCollapsed((v) => !v)}
                >
                  <Text style={styles.carryTitle}>
                    {carryForwardCollapsed ? '▸' : '▾'} Carry Forward ({prevIncomplete.length})
                  </Text>
                  <Text style={styles.carrySubtitle}>from {formatHeaderDate(previousDate)}</Text>
                </TouchableOpacity>
                {!carryForwardCollapsed &&
                  prevIncomplete.map((a) => (
                    <View key={a.id} style={styles.carryItem}>
                      <Text style={styles.carryItemTitle} numberOfLines={1}>{a.title}</Text>
                      <TouchableOpacity
                        style={styles.carryBtn}
                        onPress={() => handleCarryForward(a)}
                        disabled={carryForward.isPending}
                      >
                        <Text style={styles.carryBtnText}>Carry Forward</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              message="No activities for this day"
              action={{ label: '+ Add Activity', onPress: () => setShowAdd(true) }}
            />
          )
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader
            title={section.label}
            count={section.data.length}
          />
        )}
        renderItem={({ item }) => (
          <ActivityCard
            activity={item}
            projectName={item.linked_project_id ? projectMap.get(item.linked_project_id) : undefined}
            contactName={item.delegated_contact_id ? contactMap.get(item.delegated_contact_id) : undefined}
            onEdit={setEditActivity}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add modal */}
      <ActivityFormModal
        visible={showAdd}
        title="New Activity"
        initialValues={defaultFormValues(selectedDate)}
        projectOptions={projectOptions}
        contactOptions={contactOptions}
        aPriorityCount={aPriorityCount}
        submitting={createActivity.isPending}
        onSubmit={handleCreateSubmit}
        onClose={() => setShowAdd(false)}
      />

      {/* Edit modal */}
      <ActivityFormModal
        visible={!!editActivity}
        title="Edit Activity"
        initialValues={
          editActivity
            ? {
                title: editActivity.title,
                section_type: editActivity.section_type,
                priority: editActivity.priority,
                activity_date: editActivity.activity_date,
                estimated_hours: (editActivity.estimated_minutes / 60).toFixed(1),
                linked_project_id: editActivity.linked_project_id,
                delegated_contact_id: editActivity.delegated_contact_id,
                note: editActivity.note ?? '',
              }
            : defaultFormValues(selectedDate)
        }
        projectOptions={projectOptions}
        contactOptions={contactOptions}
        aPriorityCount={aPriorityCount}
        submitting={updateActivity.isPending}
        onSubmit={handleEditSubmit}
        onClose={() => setEditActivity(null)}
      />

      <Toast {...toastProps} />

      <CompletionCelebrationModal
        visible={celebrationVisible}
        onClose={() => setCelebrationVisible(false)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.md,
    backgroundColor: '#FFFFFF',
  },
  navBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navArrow: {
    fontSize: 22,
    color: colors.ink.light,
    lineHeight: 26,
  },
  dateLabel: {
    minWidth: 110,
    textAlign: 'center',
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.ink.DEFAULT,
    paddingHorizontal: spacing.xs,
  },
  todayLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[600],
    textDecorationLine: 'underline',
  },
  warning: {
    backgroundColor: colors.amber[50],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.amber[200],
  },
  warningText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.amber[700],
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  // Carry-forward panel
  carryPanel: {
    backgroundColor: colors.blue[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  carryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  carryTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.blue[700],
  },
  carrySubtitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[400],
  },
  carryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.blue[100],
    gap: spacing.sm,
  },
  carryItemTitle: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  carryBtn: {
    backgroundColor: colors.blue[600],
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  carryBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#FFFFFF',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing['3xl'],
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 32,
    fontWeight: '300',
  },
});
