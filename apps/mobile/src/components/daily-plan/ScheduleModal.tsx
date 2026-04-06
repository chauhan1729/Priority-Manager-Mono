import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { Activity } from '@pm/types';
import { useScheduleActivity } from '../../hooks/useScheduleInstances';
import { TimePickerField } from '../ui/TimePickerField';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';
import { localTimeToUTC } from '@pm/domain';

interface Props {
  activity: Activity | null;
  scheduleDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

function timeToDate(scheduleDate: string, hours: number, minutes: number): Date {
  return new Date(scheduleDate + `T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
}

function roundUpToNext15(date: Date): Date {
  const ms = date.getTime();
  const interval = 15 * 60 * 1000;
  return new Date(Math.ceil(ms / interval) * interval);
}

export function ScheduleModal({ activity, scheduleDate, onClose, onSuccess }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%'], []);
  const scheduleActivity = useScheduleActivity();

  const defaultStart = roundUpToNext15(new Date());
  const defaultEnd = new Date(defaultStart.getTime() + (activity?.remaining_minutes ?? 60) * 60_000);

  const [startTime, setStartTime] = useState<Date>(defaultStart);
  const [endTime, setEndTime] = useState<Date>(defaultEnd);
  const [focusMinutes, setFocusMinutes] = useState<string>(
    String(activity?.remaining_minutes ?? 60)
  );
  const [error, setError] = useState<string | null>(null);

  // Open sheet when activity changes
  React.useEffect(() => {
    if (activity) {
      const s = roundUpToNext15(new Date());
      const e = new Date(s.getTime() + (activity.remaining_minutes ?? 60) * 60_000);
      setStartTime(s);
      setEndTime(e);
      setFocusMinutes(String(activity.remaining_minutes ?? 60));
      setError(null);
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [activity]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  function buildUTCString(date: Date, timeDate: Date): string {
    // Use local-time hours/minutes and combine with schedule date
    const hhmm = `${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`;
    // Use Intl to detect local timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return localTimeToUTC(scheduleDate, hhmm, tz).toISOString();
  }

  function handleSchedule() {
    if (!activity) return;
    const focus = parseInt(focusMinutes, 10);
    if (isNaN(focus) || focus <= 0) {
      setError('Focus minutes must be a positive number.');
      return;
    }
    if (focus > activity.remaining_minutes) {
      setError(`Focus minutes cannot exceed remaining time (${activity.remaining_minutes} min).`);
      return;
    }
    if (endTime <= startTime) {
      setError('End time must be after start time.');
      return;
    }

    const startAt = buildUTCString(new Date(scheduleDate), startTime);
    const endAt = buildUTCString(new Date(scheduleDate), endTime);

    scheduleActivity.mutate(
      { activityId: activity.id, scheduleDate, startAt, endAt, focusMinutes: focus },
      {
        onSuccess: () => { onSuccess(); sheetRef.current?.close(); },
        onError: (e) => setError(e instanceof Error ? e.message : 'Failed to schedule.'),
      }
    );
  }

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
      <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Schedule Activity</Text>
        {activity && (
          <Text style={styles.activityName} numberOfLines={2}>{activity.title}</Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TimePickerField label="Start time" value={startTime} onChange={setStartTime} />

        <View style={styles.fieldGap} />

        <TimePickerField label="End time" value={endTime} onChange={setEndTime} />

        <View style={styles.fieldGap} />

        <Text style={styles.label}>Focus minutes</Text>
        <TextInput
          style={styles.input}
          value={focusMinutes}
          onChangeText={(v) => { setFocusMinutes(v); setError(null); }}
          keyboardType="number-pad"
          placeholder="e.g. 60"
          placeholderTextColor={colors.gray[400]}
        />
        {activity && (
          <Text style={styles.hint}>Remaining: {activity.remaining_minutes} min</Text>
        )}

        <TouchableOpacity
          style={[styles.btn, scheduleActivity.isPending && styles.btnDim]}
          onPress={handleSchedule}
          disabled={scheduleActivity.isPending}
        >
          <Text style={styles.btnText}>
            {scheduleActivity.isPending ? 'Scheduling…' : 'Add to Timeline'}
          </Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl },
  handle: { backgroundColor: colors.gray[300], width: 40 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },
  title: { fontFamily: fontFamily.handwriting, fontSize: fontSize['2xl'], color: colors.ink.DEFAULT },
  activityName: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.light, marginTop: -spacing.xs },
  error: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.red[600], backgroundColor: colors.red[50], borderRadius: borderRadius.md, padding: spacing.sm },
  label: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.blue[100],
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT, minHeight: 44,
  },
  hint: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.gray[400], marginTop: -spacing.xs },
  fieldGap: { height: spacing.xs },
  btn: { backgroundColor: colors.blue[600], borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  btnDim: { opacity: 0.5 },
  btnText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: '#FFFFFF' },
});
