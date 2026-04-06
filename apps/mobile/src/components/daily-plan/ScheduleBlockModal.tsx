import React, { useCallback, useMemo, useRef } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Badge } from '../ui/Badge';
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
}

interface Props {
  block: ScheduleBlockInfo | null;
  onClose: () => void;
  onPostpone?: (activityId: string) => void;
}

const BLOCK_STATUSES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'working', label: 'Working' },
  { value: 'completed', label: 'Completed' },
  { value: 'postponed', label: 'Postponed' },
  { value: 'missed', label: 'Missed' },
] as const;

export function ScheduleBlockModal({ block, onClose, onPostpone }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['55%'], []);
  const updateStatus = useUpdateScheduleBlockStatus();
  const unschedule = useUnscheduleActivity();
  const unscheduleRunning = useUnscheduleRunningBlock();

  React.useEffect(() => {
    if (block) sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [block]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  function handleStatusChange(status: typeof BLOCK_STATUSES[number]['value']) {
    if (!block) return;
    updateStatus.mutate(
      { instanceId: block.instanceId, status, scheduleDate: block.scheduleDate },
      { onSuccess: () => sheetRef.current?.close() }
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
    const label = mode === 'full' ? 'Remove entirely (restore all time)' : 'Keep elapsed portion';
    Alert.alert('Unschedule Running Block', label + '?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () =>
          unscheduleRunning.mutate(
            { instanceId: block.instanceId, activityId: block.activityId!, mode, scheduleDate: block.scheduleDate },
            { onSuccess: () => sheetRef.current?.close() }
          ),
      },
    ]);
  }

  const isRunning = block?.statusSnapshot === 'working';
  const canUnschedule = block?.sourceType === 'activity' && block?.activityId;

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
            <Text style={styles.title} numberOfLines={2}>{block.title}</Text>
            <Text style={styles.time}>
              {formatTime(block.startAt)} – {formatTime(block.endAt)}
              {block.focusMinutes ? `  ·  ${block.focusMinutes} min focus` : ''}
            </Text>

            {/* Status picker */}
            <Text style={styles.sectionLabel}>Status</Text>
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

            {/* Postpone */}
            {canUnschedule && onPostpone && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => { onPostpone(block.activityId!); sheetRef.current?.close(); }}
              >
                <Text style={styles.actionText}>📅  Postpone to another date</Text>
              </TouchableOpacity>
            )}

            {/* Unschedule running */}
            {isRunning && canUnschedule && (
              <>
                <Text style={styles.sectionLabel}>Running block options</Text>
                <TouchableOpacity style={styles.actionRow} onPress={() => handleUnscheduleRunning('split')}>
                  <Text style={styles.actionText}>✂  Keep elapsed, restore remaining</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionRow} onPress={() => handleUnscheduleRunning('full')}>
                  <Text style={[styles.actionText, { color: colors.red[500] }]}>✕  Remove entirely, restore all time</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Unschedule future */}
            {!isRunning && canUnschedule && (
              <TouchableOpacity style={styles.actionRow} onPress={handleUnschedule}>
                <Text style={[styles.actionText, { color: colors.red[500] }]}>✕  Remove from timeline</Text>
              </TouchableOpacity>
            )}
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
  title: { fontFamily: fontFamily.handwriting, fontSize: fontSize.xl, color: colors.ink.DEFAULT },
  time: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light, marginTop: -spacing.xs },
  sectionLabel: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xs },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statusBtn: { borderWidth: 1, borderColor: colors.blue[100], borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: '#FFFFFF' },
  statusBtnActive: { backgroundColor: colors.blue[600], borderColor: colors.blue[600] },
  statusBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.ink.DEFAULT },
  statusBtnTextActive: { color: '#FFFFFF', fontWeight: fontWeight.semibold },
  actionRow: { paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.blue[100] },
  actionText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.blue[600] },
});
