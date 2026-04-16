import React, { useCallback, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { Activity, Contact } from '@pm/types';
import { Badge } from '../ui/Badge';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';
import {
  useUpdateActivityStatus,
  useDeleteActivity,
  useArchiveActivity,
  usePostponeActivity,
  useDelegateActivity,
} from '../../hooks/useActivities';
import { addDays } from '../../lib/dateUtils';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'working', label: 'Working' },
  { value: 'completed', label: 'Completed' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'delegated', label: 'Delegated' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

interface Props {
  activity: Activity;
  projectName?: string | undefined;
  contactName?: string | undefined;
  monthlyPriorityTitle?: string | undefined;
  contacts?: Contact[] | undefined;
  bulkMode?: boolean | undefined;
  isSelected?: boolean | undefined;
  onToggleSelect?: ((id: string) => void) | undefined;
  onEdit: (activity: Activity) => void;
  onOpenProject?: ((projectId: string) => void) | undefined;
  onPostponed?: (() => void) | undefined;
}

function ActivityCardBase({
  activity,
  projectName,
  contactName,
  monthlyPriorityTitle,
  contacts,
  bulkMode = false,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onOpenProject,
  onPostponed,
}: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['45%'], []);

  const contactSheetRef = useRef<BottomSheet>(null);
  const contactSnapPoints = useMemo(() => ['60%'], []);
  const [delegatePending, setDelegatePending] = useState(false);

  const updateStatus = useUpdateActivityStatus();
  const deleteActivity = useDeleteActivity();
  const archiveActivity = useArchiveActivity();
  const postponeActivity = usePostponeActivity();
  const delegateActivity = useDelegateActivity();

  const isDone = activity.status === 'completed' || activity.status === 'cancelled';
  const estimatedHours = (activity.estimated_minutes / 60).toFixed(1);

  function openStatusSheet() {
    if (bulkMode) return;
    sheetRef.current?.expand();
  }

  function handleStatusSelect(status: string) {
    sheetRef.current?.close();

    // Web parity: changing status to "delegated" when not already in the delegated
    // section opens a contact picker before committing the change.
    if (status === 'delegated' && activity.section_type !== 'delegated') {
      setDelegatePending(true);
      contactSheetRef.current?.expand();
      return;
    }

    if (status === 'completed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.selectionAsync();
    }
    updateStatus.mutate({ activityId: activity.id, status });
  }

  function handleDelegateSelect(contactId: string) {
    contactSheetRef.current?.close();
    setDelegatePending(false);
    Haptics.selectionAsync();
    delegateActivity.mutate(
      { activityId: activity.id, contactId },
      {
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delegate'),
      },
    );
  }

  function handleQuickComplete() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateStatus.mutate({ activityId: activity.id, status: 'completed' });
  }

  function handlePostpone() {
    Haptics.selectionAsync();
    const nextDay = addDays(activity.activity_date, 1);
    postponeActivity.mutate(
      { activityId: activity.id, toDate: nextDay, currentDate: activity.activity_date },
      { onSuccess: () => onPostponed?.() }
    );
  }

  function handleDelete() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete Activity', `Delete "${activity.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteActivity.mutate({
            activityId: activity.id,
            linkedProjectId: activity.linked_project_id,
          }),
      },
    ]);
  }

  function handleArchive() {
    archiveActivity.mutate({ activityId: activity.id });
  }

  function handleCardPress() {
    if (bulkMode) {
      onToggleSelect?.(activity.id);
    }
  }

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  return (
    <>
      <TouchableOpacity
        activeOpacity={bulkMode ? 0.7 : 1}
        onPress={handleCardPress}
        onLongPress={() => onToggleSelect?.(activity.id)}
        style={[
          styles.card,
          isDone && styles.cardDone,
          bulkMode && isSelected && styles.cardSelected,
        ]}
      >
        {/* Bulk checkbox */}
        {bulkMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
            {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
        )}

        {/* Left: priority badge + title + meta */}
        <View style={styles.left}>
          <View style={styles.topRow}>
            {activity.priority ? (
              <Badge variant={activity.priority} style={styles.priorityBadge} />
            ) : null}
            <Text
              style={[styles.title, isDone && styles.titleStrike]}
              numberOfLines={2}
            >
              {activity.title}
            </Text>
            {/* Moved indicator */}
            {activity.moved_from_date ? (
              <Text style={styles.movedBadge}>↷ moved</Text>
            ) : null}
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{estimatedHours}h</Text>
            {activity.hours_worked > 0 ? (
              <Text style={styles.metaWorked}>
                · {(activity.hours_worked / 60).toFixed(1)}h worked
              </Text>
            ) : null}
            {projectName && activity.linked_project_id ? (
              onOpenProject ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onOpenProject(activity.linked_project_id!);
                  }}
                  hitSlop={4}
                >
                  <Text style={[styles.metaProject, styles.metaProjectLink]} numberOfLines={1}>
                    · {projectName}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.metaProject} numberOfLines={1}>
                  · {projectName}
                </Text>
              )
            ) : null}
            {contactName ? (
              <Text style={styles.metaDelegated} numberOfLines={1}>
                · {contactName}
              </Text>
            ) : null}
          </View>

          {/* Monthly priority badge */}
          {monthlyPriorityTitle ? (
            <View style={styles.mpBadge}>
              <Text style={styles.mpBadgeText} numberOfLines={1}>
                ★ {monthlyPriorityTitle}
              </Text>
            </View>
          ) : null}

          {activity.note ? (
            <Text style={styles.note} numberOfLines={2}>
              "{activity.note}"
            </Text>
          ) : null}
        </View>

        {/* Right: status badge + actions */}
        <View style={styles.right}>
          <TouchableOpacity onPress={openStatusSheet}>
            <Badge variant={activity.status} />
          </TouchableOpacity>

          <View style={styles.actions}>
            {/* Quick complete */}
            {!isDone && (
              <TouchableOpacity onPress={handleQuickComplete} hitSlop={8} style={styles.actionBtn}>
                <Text style={styles.completeIcon}>✓</Text>
              </TouchableOpacity>
            )}

            {/* Postpone to tomorrow */}
            {!isDone && (
              <TouchableOpacity onPress={handlePostpone} hitSlop={8} style={styles.actionBtn}>
                <Text style={styles.postponeIcon}>↷</Text>
              </TouchableOpacity>
            )}

            {/* Edit (hidden for completed/cancelled — web parity) */}
            {!isDone ? (
              <TouchableOpacity onPress={() => onEdit(activity)} hitSlop={8} style={styles.actionBtn}>
                <Text style={styles.actionIcon}>✎</Text>
              </TouchableOpacity>
            ) : null}

            {/* Archive (for done activities) */}
            {isDone && !activity.archived && (
              <TouchableOpacity onPress={handleArchive} hitSlop={8} style={styles.actionBtn}>
                <Text style={styles.archiveIcon}>⊘</Text>
              </TouchableOpacity>
            )}

            {/* Delete */}
            <TouchableOpacity onPress={handleDelete} hitSlop={8} style={styles.actionBtn}>
              <Text style={[styles.actionIcon, styles.deleteIcon]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Status picker bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheet}
        handleIndicatorStyle={styles.handle}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Update Status</Text>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.statusOption,
                activity.status === opt.value && styles.statusOptionActive,
              ]}
              onPress={() => handleStatusSelect(opt.value)}
            >
              <Badge variant={opt.value} />
              <Text style={styles.statusOptionLabel}>{opt.label}</Text>
              {activity.status === opt.value ? (
                <Text style={styles.checkmark}>✓</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>

      {/* Delegate contact picker bottom sheet */}
      <BottomSheet
        ref={contactSheetRef}
        index={-1}
        snapPoints={contactSnapPoints}
        enablePanDownToClose
        onClose={() => setDelegatePending(false)}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheet}
        handleIndicatorStyle={styles.handle}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Delegate to…</Text>
          {!contacts || contacts.length === 0 ? (
            <Text style={styles.emptyContacts}>
              No contacts yet. Add contacts in the Communication Planner first.
            </Text>
          ) : (
            contacts.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.statusOption}
                onPress={() => handleDelegateSelect(c.id)}
                disabled={delegateActivity.isPending}
              >
                <Text style={styles.statusOptionLabel}>{c.full_name}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </BottomSheet>
    </>
  );
}

export const ActivityCard = React.memo(ActivityCardBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardDone: {
    borderColor: colors.gray[100],
    opacity: 0.7,
  },
  cardSelected: {
    borderColor: colors.blue[400],
    backgroundColor: colors.blue[50],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.blue[300],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginRight: 4,
  },
  checkboxChecked: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  checkboxMark: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  left: {
    flex: 1,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  priorityBadge: {
    marginTop: 2,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.ink.DEFAULT,
  },
  titleStrike: {
    textDecorationLine: 'line-through',
    color: colors.gray[400],
  },
  movedBadge: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.amber[600],
    fontWeight: fontWeight.medium,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  meta: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },
  metaWorked: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.green[600],
    marginLeft: 2,
  },
  metaProject: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[600],
    marginLeft: 2,
  },
  metaProjectLink: {
    textDecorationLine: 'underline',
  },
  mpBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.violet[100],
  },
  mpBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    color: colors.violet[700],
  },
  emptyContacts: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
    fontStyle: 'italic',
    padding: spacing.md,
    textAlign: 'center',
  },
  metaDelegated: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.purple[600],
    marginLeft: 2,
  },
  note: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
    fontStyle: 'italic',
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtn: {
    padding: 4,
  },
  actionIcon: {
    fontSize: 15,
    color: colors.gray[500],
  },
  completeIcon: {
    fontSize: 15,
    color: colors.green[600],
    fontWeight: '700',
  },
  postponeIcon: {
    fontSize: 15,
    color: colors.amber[600],
  },
  archiveIcon: {
    fontSize: 15,
    color: colors.gray[500],
  },
  deleteIcon: {
    color: colors.red[400],
  },
  // Status bottom sheet
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  handle: {
    backgroundColor: colors.gray[300],
    width: 40,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing['3xl'],
    gap: spacing.xs,
  },
  sheetTitle: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize.lg,
    color: colors.ink.DEFAULT,
    marginBottom: spacing.sm,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.sm,
  },
  statusOptionActive: {
    backgroundColor: colors.blue[50],
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  statusOptionLabel: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  checkmark: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.blue[600],
    fontWeight: fontWeight.bold,
  },
});
