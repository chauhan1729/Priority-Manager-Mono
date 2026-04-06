import React, { useCallback, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { Activity } from '@pm/types';
import { Badge } from '../ui/Badge';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';
import {
  useUpdateActivityStatus,
  useDeleteActivity,
  useArchiveActivity,
} from '../../hooks/useActivities';

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
  projectName?: string;
  contactName?: string;
  onEdit: (activity: Activity) => void;
}

function ActivityCardBase({ activity, projectName, contactName, onEdit }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['45%'], []);

  const updateStatus = useUpdateActivityStatus();
  const deleteActivity = useDeleteActivity();
  const archiveActivity = useArchiveActivity();

  const isDone = activity.status === 'completed' || activity.status === 'cancelled';
  const estimatedHours = (activity.estimated_minutes / 60).toFixed(1);

  function openStatusSheet() {
    sheetRef.current?.expand();
  }

  function handleStatusSelect(status: string) {
    sheetRef.current?.close();
    if (status === 'completed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.selectionAsync();
    }
    updateStatus.mutate({ activityId: activity.id, status });
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

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  return (
    <>
      <View style={styles.card}>
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
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{estimatedHours}h</Text>
            {projectName ? (
              <Text style={styles.metaProject} numberOfLines={1}>
                · {projectName}
              </Text>
            ) : null}
            {contactName ? (
              <Text style={styles.metaDelegated} numberOfLines={1}>
                · {contactName}
              </Text>
            ) : null}
          </View>

          {activity.note ? (
            <Text style={styles.note} numberOfLines={2}>
              "{activity.note}"
            </Text>
          ) : null}

          {/* Archive button for done activities */}
          {isDone && !activity.archived ? (
            <TouchableOpacity onPress={handleArchive} hitSlop={8}>
              <Text style={styles.archiveLink}>Archive</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Right: status badge + actions */}
        <View style={styles.right}>
          <TouchableOpacity onPress={openStatusSheet}>
            <Badge variant={activity.status} />
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => onEdit(activity)} hitSlop={8} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} hitSlop={8} style={styles.actionBtn}>
              <Text style={[styles.actionIcon, styles.deleteIcon]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
  metaProject: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[600],
    marginLeft: 2,
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
  archiveLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
    textDecorationLine: 'underline',
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
