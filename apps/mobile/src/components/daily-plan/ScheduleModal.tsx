import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { Activity } from '@pm/types';
import { useScheduleActivity } from '../../hooks/useScheduleInstances';
import { TimePickerField } from '../ui/TimePickerField';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

interface Props {
  activity: Activity | null;
  scheduleDate: string;
  onClose: () => void;
  onSuccess: (startAt: string) => void;
}

function roundUpToNext15(date: Date): Date {
  const ms = date.getTime();
  const interval = 15 * 60 * 1000;
  return new Date(Math.ceil(ms / interval) * interval);
}

export function ScheduleModal({ activity, scheduleDate, onClose, onSuccess }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['55%'], []);
  const scheduleActivity = useScheduleActivity();

  const defaultStart = roundUpToNext15(new Date());

  const [startTime, setStartTime] = useState<Date>(defaultStart);
  const [focusMinutes, setFocusMinutes] = useState<string>(
    String(activity?.remaining_minutes ?? 60)
  );
  const [error, setError] = useState<string | null>(null);

  // Open sheet when activity changes
  React.useEffect(() => {
    if (activity) {
      setStartTime(roundUpToNext15(new Date()));
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

  function buildUTCString(timeDate: Date): string {
    // Interpret HH:MM as local time on `scheduleDate`, then emit UTC ISO.
    // JS's Date constructor treats TZ-less datetime strings as local time,
    // so toISOString() gives the correct UTC equivalent. Works on all
    // RN engines without relying on Intl.DateTimeFormat's timeZone option.
    const hh = String(timeDate.getHours()).padStart(2, '0');
    const mm = String(timeDate.getMinutes()).padStart(2, '0');
    return new Date(`${scheduleDate}T${hh}:${mm}:00`).toISOString();
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

    // End time is derived from start + focus minutes
    const endDate = new Date(startTime.getTime() + focus * 60_000);
    const startAt = buildUTCString(startTime);
    const endAt = buildUTCString(endDate);

    scheduleActivity.mutate(
      { activityId: activity.id, scheduleDate, startAt, endAt, focusMinutes: focus },
      {
        onSuccess: () => { onSuccess(startAt); sheetRef.current?.close(); },
        onError: (e) => setError(e instanceof Error ? e.message : 'Failed to schedule.'),
      }
    );
  }

  // Preview end time for the summary row
  const previewEndTime = (() => {
    const focus = parseInt(focusMinutes, 10);
    if (isNaN(focus) || focus <= 0) return null;
    return new Date(startTime.getTime() + focus * 60_000);
  })();
  const formatTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

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

        {/* Summary: start – end · focus */}
        {previewEndTime && (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              <Text style={styles.summaryEmph}>{formatTime(startTime)}</Text>
              {' – '}
              <Text style={styles.summaryEmph}>{formatTime(previewEndTime)}</Text>
              {' · '}
              {focusMinutes} min
            </Text>
          </View>
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
  summary: {
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.blue[50],
  },
  summaryText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
  },
  summaryEmph: {
    color: colors.ink.DEFAULT,
    fontWeight: fontWeight.semibold,
  },
  btn: { backgroundColor: colors.blue[600], borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  btnDim: { opacity: 0.5 },
  btnText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: '#FFFFFF' },
});
