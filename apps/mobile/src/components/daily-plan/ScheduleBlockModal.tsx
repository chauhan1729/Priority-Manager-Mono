import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  useUnscheduleActivity,
  useUnscheduleRunningBlock,
  useUpdateScheduleBlockStatus,
} from '../../hooks/useScheduleInstances';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

export interface ScheduleBlockInfo {
  instanceId: string;
  activityId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  focusMinutes: number | null;
  statusSnapshot: string | null;
  sourceType: string;
  scheduleDate: string;
  meetingAgenda?: string | null;
  projectName?: string | null;
}

interface Props {
  block: ScheduleBlockInfo | null;
  onClose: () => void;
  onPostpone?: (activityId: string) => void;
  onCompleted?: () => void;
}

const BLOCK_STATUSES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'working', label: 'Working' },
  { value: 'completed', label: 'Completed' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'missed', label: 'Missed' },
] as const;

export function ScheduleBlockModal({ block, onClose, onPostpone, onCompleted }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%'], []);
  const updateStatus = useUpdateScheduleBlockStatus();
  const unschedule = useUnscheduleActivity();
  const unscheduleRunning = useUnscheduleRunningBlock();

  const [showRunningChoice, setShowRunningChoice] = useState(false);

  React.useEffect(() => {
    if (block) sheetRef.current?.expand();
    else sheetRef.current?.close();
    setShowRunningChoice(false);
  }, [block]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  function handleStatusChange(status: typeof BLOCK_STATUSES[number]['value']) {
    if (!block) return;
    if (status === 'completed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.selectionAsync();
    }
    updateStatus.mutate(
      { instanceId: block.instanceId, status, scheduleDate: block.scheduleDate },
      {
        onSuccess: () => {
          sheetRef.current?.close();
          if (status === 'completed') onCompleted?.();
        },
      }
    );
  }

  function handleUnschedule() {
    if (!block?.activityId) return;
    Alert.alert('Remove Block', 'Remove this scheduled block?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          unschedule.mutate(
            { instanceId: block.instanceId, activityId: block.activityId!, scheduleDate: block.scheduleDate },
            { onSuccess: () => sheetRef.current?.close() }
          ),
      },
    ]);
  }

  function handleUnscheduleRunning(mode: 'full' | 'split') {
    if (!block?.activityId) return;
    Haptics.selectionAsync();
    unscheduleRunning.mutate(
      { instanceId: block.instanceId, activityId: block.activityId, mode, scheduleDate: block.scheduleDate },
      { onSuccess: () => sheetRef.current?.close() },
    );
  }

  // Running = started but not ended (regardless of status_snapshot)
  const now = Date.now();
  const startMs = block ? new Date(block.startAt).getTime() : 0;
  const endMs = block ? new Date(block.endAt).getTime() : 0;
  const isPast = block ? startMs < now : false;
  const isEnded = block ? endMs < now : false;
  const isRunning = block ? isPast && !isEnded : false;
  const isCompleted = block?.statusSnapshot === 'completed';
  const canUnschedule = block?.sourceType === 'activity' && !!block?.activityId && !isCompleted;
  const canUpdateStatus = isPast && !isCompleted;

  // Elapsed / remaining math for running-block split choice
  const focusMin = block?.focusMinutes ?? 0;
  const elapsedMin = isRunning && block ? Math.max(1, Math.floor((now - startMs) / 60_000)) : 0;
  const remainingMin = Math.max(0, focusMin - elapsedMin);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheet}
      handleIndicatorStyle={styles.handle}
      onClose={onClose}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {block && (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>{block.title}</Text>
              {block.sourceType === 'meeting' && (
                <View style={styles.meetingPill}>
                  <Text style={styles.meetingPillText}>Meeting</Text>
                </View>
              )}
            </View>
            <Text style={styles.time}>
              {formatTime(block.startAt)} – {formatTime(block.endAt)}
              {block.focusMinutes ? `  ·  ${block.focusMinutes} min focus` : ''}
              {block.projectName ? `  ·  ${block.projectName}` : ''}
            </Text>

            {isRunning && (
              <Text style={styles.runningLabel}>Currently running</Text>
            )}

            {block.sourceType === 'meeting' && block.meetingAgenda ? (
              <View style={styles.agendaBox}>
                <Text style={styles.agendaLabel}>AGENDA</Text>
                <Text style={styles.agendaText}>{block.meetingAgenda}</Text>
              </View>
            ) : null}

            {/* Status picker — only for past, non-completed blocks (web parity) */}
            {canUpdateStatus && (
              <>
                <Text style={styles.sectionLabel}>Update Status</Text>
                <View style={styles.statusRow}>
                  {BLOCK_STATUSES.map((s) => (
                    <TouchableOpacity
                      key={s.value}
                      style={[
                        styles.statusBtn,
                        block.statusSnapshot === s.value && styles.statusBtnActive,
                      ]}
                      onPress={() => handleStatusChange(s.value)}
                      disabled={updateStatus.isPending}
                    >
                      <Text style={[styles.statusBtnText, block.statusSnapshot === s.value && styles.statusBtnTextActive]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {isCompleted && (
              <Text style={styles.completedNote}>This block is completed.</Text>
            )}

            {/* Future block: Move back to unscheduled (single button) */}
            {canUnschedule && !isRunning && !isPast && (
              <TouchableOpacity style={styles.actionRow} onPress={handleUnschedule}>
                <Text style={styles.actionText}>↩  Move back to unscheduled</Text>
              </TouchableOpacity>
            )}

            {/* Running block: inline card with 2 choices (web parity) */}
            {canUnschedule && isRunning && !showRunningChoice && (
              <TouchableOpacity
                style={[styles.actionRow, styles.runningEntryBtn]}
                onPress={() => setShowRunningChoice(true)}
              >
                <Text style={[styles.actionText, { color: colors.amber[700] }]}>
                  ↩  Move back to unscheduled…
                </Text>
              </TouchableOpacity>
            )}

            {canUnschedule && isRunning && showRunningChoice && (
              <View style={styles.runningCard}>
                <Text style={styles.runningPrompt}>
                  This block has been running ~{elapsedMin}m. How do you want to handle it?
                </Text>
                <TouchableOpacity
                  style={styles.runningChoiceBtn}
                  onPress={() => handleUnscheduleRunning('split')}
                  disabled={unscheduleRunning.isPending}
                >
                  <Text style={styles.runningChoiceText}>
                    Mark elapsed ({elapsedMin}m) as completed, return {remainingMin}m to unscheduled
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.runningChoiceBtn}
                  onPress={() => handleUnscheduleRunning('full')}
                  disabled={unscheduleRunning.isPending}
                >
                  <Text style={styles.runningChoiceText}>
                    Move entire block ({focusMin}m) to unscheduled
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowRunningChoice(false)}>
                  <Text style={styles.runningCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Postpone to another date (activity blocks, not completed) */}
            {canUnschedule && onPostpone && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => { onPostpone(block.activityId!); sheetRef.current?.close(); }}
              >
                <Text style={styles.actionText}>→  Postpone to another date</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionRow, styles.dismissRow]}
              onPress={() => sheetRef.current?.close()}
            >
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl },
  handle: { backgroundColor: colors.gray[300], width: 40 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  title: { flex: 1, fontFamily: fontFamily.handwriting, fontSize: fontSize.xl, color: colors.ink.DEFAULT },
  meetingPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.violet[100],
  },
  meetingPillText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    color: colors.violet[700],
  },
  agendaBox: {
    backgroundColor: colors.violet[100],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: 2,
  },
  agendaLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    color: colors.violet[700],
    letterSpacing: 0.5,
  },
  agendaText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
    lineHeight: 18,
  },
  time: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light, marginTop: -spacing.xs },
  sectionLabel: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xs },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statusBtn: { borderWidth: 1, borderColor: colors.blue[100], borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: '#FFFFFF' },
  statusBtnActive: { backgroundColor: colors.blue[600], borderColor: colors.blue[600] },
  statusBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.ink.DEFAULT },
  statusBtnTextActive: { color: '#FFFFFF', fontWeight: fontWeight.semibold },
  completedNote: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  actionRow: { paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.blue[100] },
  actionText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.blue[600] },
  runningLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.amber[700],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  runningEntryBtn: {
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.amber[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.amber[50],
  },
  runningCard: {
    borderWidth: 1,
    borderColor: colors.amber[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.amber[50],
    padding: spacing.md,
    gap: spacing.sm,
  },
  runningPrompt: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.amber[700],
    fontWeight: fontWeight.medium,
  },
  runningChoiceBtn: {
    borderWidth: 1,
    borderColor: colors.amber[300],
    borderRadius: borderRadius.md,
    backgroundColor: '#FFFFFF',
    padding: spacing.sm + 2,
  },
  runningChoiceText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  runningCancelText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.amber[600],
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  dismissRow: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  dismissText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.light,
  },
});
