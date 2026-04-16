import React, { useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  canAddAPriority,
  exceedsDailyCapacity,
  groupActivitiesBySection,
  MAX_A_PRIORITY_PER_DAY,
} from '@pm/domain';
import type { Activity, ActivitySection } from '@pm/types';
import { DatePickerField } from '../../src/components/ui/DatePickerField';
import { supabase } from '../../src/lib/supabase/client';
import { useAuth } from '../../src/components/providers/AuthProvider';
import {
  useActivitiesForDate,
  useArchivedActivitiesForDate,
  usePreviousDayIncomplete,
  useCarryForwardActivity,
  useBulkMoveActivities,
  useBulkUpdateStatus,
  useBulkArchiveActivities,
  useBulkDeleteActivities,
  useUnarchiveActivity,
} from '../../src/hooks/useActivities';
import { useActiveProjects } from '../../src/hooks/useProjects';
import { useContacts } from '../../src/hooks/useContacts';
import { ActivityCard } from '../../src/components/activities/ActivityCard';
import { ActivityFormModal } from '../../src/components/activities/ActivityFormModal';
import { Badge } from '../../src/components/ui/Badge';
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
    recurrence_rule: null,
  };
}

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'Not Started', value: 'not_started' },
  { label: 'Working', value: 'working' },
  { label: 'Completed', value: 'completed' },
  { label: 'Postponed', value: 'postponed' },
  { label: 'Delegated', value: 'delegated' },
  { label: 'Cancelled', value: 'cancelled' },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ActivitiesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [showAdd, setShowAdd] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [carryForwardCollapsed, setCarryForwardCollapsed] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [bulkMoveVisible, setBulkMoveVisible] = useState(false);
  const [bulkMoveDate, setBulkMoveDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const prevAllDoneRef = React.useRef(false);

  const previousDate = addDays(selectedDate, -1);
  const { toastProps, show: showToast } = useToast();

  // Data
  const { data: activities = [], isLoading, refetch } = useActivitiesForDate(selectedDate);
  const { data: archivedActivities = [] } = useArchivedActivitiesForDate(selectedDate);
  const [refreshing, setRefreshing] = useState(false);
  const { data: prevIncomplete = [] } = usePreviousDayIncomplete(previousDate);
  const { data: projects = [] } = useActiveProjects();
  const { data: contacts = [] } = useContacts();

  // Monthly priorities — used to show "★ Monthly Priority" badge on cards
  // whose linked project is itself linked to a monthly priority.
  const { data: monthlyPriorities = [] } = useQuery({
    queryKey: ['monthly_priorities', 'all-titles', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_priorities')
        .select('id, title')
        .eq('user_id', user!.id);
      return (data ?? []) as { id: string; title: string }[];
    },
    enabled: !!user,
  });

  // Mutations
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const carryForward = useCarryForwardActivity();
  const bulkMove = useBulkMoveActivities();
  const bulkStatus = useBulkUpdateStatus();
  const bulkArchive = useBulkArchiveActivities();
  const bulkDelete = useBulkDeleteActivities();
  const unarchiveActivity = useUnarchiveActivity();

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
  // Web parity: capacity warning applies to A-priority workload only, not all activities.
  const capacityExceeded = exceedsDailyCapacity(
    activeActivities.filter((a) => a.priority === 'A'),
  );

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const contactMap = new Map(contacts.map((c) => [c.id, c.full_name]));

  // project_id → monthly priority title (null if project has no MP link)
  const projectPriorityMap = useMemo(() => {
    const priorityTitleMap = new Map(monthlyPriorities.map((p) => [p.id, p.title]));
    const map = new Map<string, string>();
    for (const project of projects) {
      if (project.linked_monthly_priority_id && priorityTitleMap.has(project.linked_monthly_priority_id)) {
        map.set(project.id, priorityTitleMap.get(project.linked_monthly_priority_id)!);
      }
    }
    return map;
  }, [projects, monthlyPriorities]);

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
  // Bulk mode
  // ---------------------------------------------------------------------------

  function toggleBulkMode() {
    if (bulkMode) {
      setBulkMode(false);
      setSelectedIds(new Set());
    } else {
      setBulkMode(true);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Auto-enter bulk mode on long-press
      if (!bulkMode && next.size > 0) {
        setBulkMode(true);
      }
      return next;
    });
  }

  function openBulkMovePicker() {
    if (selectedIds.size === 0) return;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setBulkMoveDate(d);
    setBulkMoveVisible(true);
  }

  function confirmBulkMove() {
    const toDate = `${bulkMoveDate.getFullYear()}-${String(bulkMoveDate.getMonth() + 1).padStart(2, '0')}-${String(bulkMoveDate.getDate()).padStart(2, '0')}`;
    Haptics.selectionAsync();
    bulkMove.mutate(
      { activityIds: Array.from(selectedIds), toDate, fromDate: selectedDate },
      {
        onSuccess: () => {
          showToast(`${selectedIds.size} activities moved`);
          setBulkMoveVisible(false);
          setBulkMode(false);
          setSelectedIds(new Set());
        },
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      },
    );
  }

  function applyBulkStatus(status: string) {
    const label = STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
    Haptics.selectionAsync();
    bulkStatus.mutate(
      { activityIds: Array.from(selectedIds), status },
      {
        onSuccess: () => {
          showToast(`${selectedIds.size} set to ${label}`);
          setBulkMode(false);
          setSelectedIds(new Set());
        },
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      },
    );
  }

  function handleBulkStatus() {
    if (selectedIds.size === 0) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Set status for selected',
          options: [...STATUS_OPTIONS.map((s) => s.label), 'Cancel'],
          cancelButtonIndex: STATUS_OPTIONS.length,
        },
        (idx) => {
          if (idx < STATUS_OPTIONS.length) {
            applyBulkStatus(STATUS_OPTIONS[idx]!.value);
          }
        },
      );
    } else {
      Alert.alert(
        'Set status',
        'Set all selected to:',
        [
          ...STATUS_OPTIONS.map((s) => ({
            text: s.label,
            onPress: () => applyBulkStatus(s.value),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
    }
  }

  const canBulkArchive = useMemo(() => {
    if (selectedIds.size === 0) return false;
    for (const a of activeActivities) {
      if (selectedIds.has(a.id) && a.status !== 'completed' && a.status !== 'cancelled') {
        return false;
      }
    }
    return true;
  }, [selectedIds, activeActivities]);

  function handleBulkArchive() {
    if (selectedIds.size === 0) return;
    if (!canBulkArchive) {
      showToast('Only completed or cancelled activities can be archived', 'error');
      return;
    }
    Haptics.selectionAsync();
    bulkArchive.mutate(
      { activityIds: Array.from(selectedIds) },
      {
        onSuccess: () => {
          showToast(`${selectedIds.size} archived`);
          setBulkMode(false);
          setSelectedIds(new Set());
        },
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      }
    );
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Activities',
      `Permanently delete ${selectedIds.size} activities?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            bulkDelete.mutate(
              { activityIds: Array.from(selectedIds) },
              {
                onSuccess: () => {
                  showToast(`${selectedIds.size} deleted`);
                  setBulkMode(false);
                  setSelectedIds(new Set());
                },
                onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
              }
            );
          },
        },
      ]
    );
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleCarryForward(activity: Activity) {
    carryForward.mutate(
      {
        activityId: activity.id,
        fromDate: previousDate,
        toDate: selectedDate,
        linkedProjectId: activity.linked_project_id,
      },
      {
        onSuccess: () => showToast('Activity moved to today'),
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      }
    );
  }

  function handleCarryForwardAll() {
    if (prevIncomplete.length === 0) return;
    Haptics.selectionAsync();
    for (const a of prevIncomplete) {
      carryForward.mutate({
        activityId: a.id,
        fromDate: previousDate,
        toDate: selectedDate,
        linkedProjectId: a.linked_project_id,
      });
    }
    showToast(`${prevIncomplete.length} activities moved to today`);
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
        recurrence_rule: values.recurrence_rule,
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
        delegated_contact_id: values.delegated_contact_id,
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

  function handleOpenProject(projectId: string) {
    router.push(`/project-planner/${projectId}` as never);
  }

  function handleUnarchive(activity: Activity) {
    unarchiveActivity.mutate(
      { activityId: activity.id },
      {
        onSuccess: () => showToast('Activity restored'),
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      }
    );
  }

  const isBulkPending = bulkMove.isPending || bulkStatus.isPending || bulkArchive.isPending || bulkDelete.isPending;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Date navigation header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
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

        {/* Bulk edit toggle */}
        <TouchableOpacity onPress={toggleBulkMode} style={styles.bulkToggle}>
          <Text style={[styles.bulkToggleText, bulkMode && styles.bulkToggleActive]}>
            {bulkMode ? 'Cancel' : 'Select'}
          </Text>
        </TouchableOpacity>
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
                {!carryForwardCollapsed && (
                  <>
                    <TouchableOpacity
                      style={styles.moveAllBtn}
                      onPress={handleCarryForwardAll}
                      disabled={carryForward.isPending}
                    >
                      <Text style={styles.moveAllBtnText}>↷ Move All to Today</Text>
                    </TouchableOpacity>
                    {prevIncomplete.map((a) => (
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
                  </>
                )}
              </View>
            )}
          </>
        }
        ListFooterComponent={
          <>
            {/* Archived activities section */}
            {archivedActivities.length > 0 && (
              <View style={styles.archivedSection}>
                <TouchableOpacity
                  style={styles.archivedHeader}
                  onPress={() => setShowArchived((v) => !v)}
                >
                  <Text style={styles.archivedTitle}>
                    {showArchived ? '▾' : '▸'} Archived ({archivedActivities.length})
                  </Text>
                </TouchableOpacity>
                {showArchived && archivedActivities.map((a) => (
                  <View key={a.id} style={styles.archivedItem}>
                    <View style={styles.archivedItemLeft}>
                      {a.priority ? <Badge variant={a.priority} style={{ marginRight: 6 }} /> : null}
                      <Text style={styles.archivedItemTitle} numberOfLines={1}>{a.title}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleUnarchive(a)} hitSlop={8}>
                      <Text style={styles.unarchiveLink}>Restore</Text>
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
            monthlyPriorityTitle={item.linked_project_id ? projectPriorityMap.get(item.linked_project_id) : undefined}
            contacts={contacts}
            bulkMode={bulkMode}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={toggleSelect}
            onEdit={setEditActivity}
            onOpenProject={handleOpenProject}
            onPostponed={() => showToast('Postponed')}
          />
        )}
      />

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <View style={styles.bulkBar}>
          <View style={styles.bulkBarHeader}>
            <Text style={styles.bulkBarCount}>{selectedIds.size} selected</Text>
            <TouchableOpacity onPress={() => setSelectedIds(new Set())} hitSlop={8}>
              <Text style={styles.bulkClearText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bulkBarActions}>
            <TouchableOpacity onPress={openBulkMovePicker} style={styles.bulkBtn} disabled={isBulkPending}>
              <Text style={styles.bulkBtnText}>Move</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkStatus} style={styles.bulkBtn} disabled={isBulkPending}>
              <Text style={styles.bulkBtnText}>Status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBulkArchive}
              style={[styles.bulkBtn, !canBulkArchive && styles.bulkBtnDisabled]}
              disabled={isBulkPending || !canBulkArchive}
            >
              <Text style={[styles.bulkBtnText, !canBulkArchive && styles.bulkBtnTextDisabled]}>
                Archive
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkDelete} style={[styles.bulkBtn, styles.bulkBtnDanger]} disabled={isBulkPending}>
              <Text style={[styles.bulkBtnText, styles.bulkBtnDangerText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bulk move date picker modal */}
      <Modal
        visible={bulkMoveVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBulkMoveVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Move {selectedIds.size} to…</Text>
            <DatePickerField
              label="Target date"
              value={bulkMoveDate}
              onChange={(d) => setBulkMoveDate(d)}
              minimumDate={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })()}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setBulkMoveVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={confirmBulkMove}
                disabled={bulkMove.isPending}
              >
                <Text style={styles.modalConfirmText}>
                  {bulkMove.isPending ? 'Moving…' : 'Move'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FAB (hidden in bulk mode) */}
      {!bulkMode && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

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
                recurrence_rule: editActivity.recurrence_rule,
              }
            : defaultFormValues(selectedDate)
        }
        projectOptions={projectOptions}
        contactOptions={contactOptions}
        aPriorityCount={aPriorityCount}
        submitting={updateActivity.isPending}
        readOnly={editActivity?.status === 'completed'}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  bulkToggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bulkToggleText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[600],
    fontWeight: fontWeight.medium,
  },
  bulkToggleActive: {
    color: colors.red[500],
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
  moveAllBtn: {
    backgroundColor: colors.blue[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  moveAllBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#FFFFFF',
  },
  // Archived section
  archivedSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    padding: spacing.md,
  },
  archivedHeader: {
    paddingVertical: spacing.xs,
  },
  archivedTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray[600],
  },
  archivedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    gap: spacing.sm,
  },
  archivedItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  archivedItemTitle: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[500],
    textDecorationLine: 'line-through',
  },
  unarchiveLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[600],
    fontWeight: fontWeight.medium,
  },
  // Bulk action bar
  bulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.blue[100],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  bulkBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bulkBarCount: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.ink.DEFAULT,
  },
  bulkClearText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.blue[600],
  },
  bulkBarActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  bulkBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.blue[50],
    borderWidth: 1,
    borderColor: colors.blue[200],
  },
  bulkBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.blue[700],
  },
  bulkBtnDanger: {
    backgroundColor: colors.red[50],
    borderColor: colors.red[200],
  },
  bulkBtnDangerText: {
    color: colors.red[600],
  },
  bulkBtnDisabled: {
    backgroundColor: colors.gray[50],
    borderColor: colors.gray[200],
    opacity: 0.5,
  },
  bulkBtnTextDisabled: {
    color: colors.gray[400],
  },
  // Modal (bulk move date picker)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
  },
  modalTitle: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize.xl,
    color: colors.ink.DEFAULT,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  modalCancel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  modalCancelText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.light,
  },
  modalConfirm: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.blue[600],
  },
  modalConfirmText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
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
