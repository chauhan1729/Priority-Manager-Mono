import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { Activity } from '@pm/types';
import { localTimeToUTC } from '@pm/domain';
import { useScheduleActivity } from '../../hooks/useScheduleInstances';
import { Badge } from '../ui/Badge';
import { TimePickerField } from '../ui/TimePickerField';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

interface Props {
  /** ISO datetime string of the tapped slot (e.g. "2025-04-16T09:00:00"), or null when closed */
  slotStartISO: string | null;
  unscheduledActivities: Activity[];
  projectMap: Map<string, string>;
  scheduleDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

function roundUpToNext15(date: Date): Date {
  const ms = date.getTime();
  const interval = 15 * 60 * 1000;
  return new Date(Math.ceil(ms / interval) * interval);
}

function parseSlotTime(slotISO: string): Date {
  // slotISO is like "2025-04-16T09:00:00" — treat as local time
  return new Date(slotISO);
}

export function SlotScheduleModal({
  slotStartISO,
  unscheduledActivities,
  projectMap,
  scheduleDate,
  onClose,
  onSuccess,
}: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%'], []);
  const scheduleActivity = useScheduleActivity();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date>(roundUpToNext15(new Date()));
  const [focusMinutes, setFocusMinutes] = useState<string>('60');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slotStartISO) {
      const slotDate = parseSlotTime(slotStartISO);
      setStartTime(slotDate);
      setSelectedId(unscheduledActivities.length === 1 ? unscheduledActivities[0]!.id : null);
      setFocusMinutes('60');
      setError(null);
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [slotStartISO, unscheduledActivities]);

  // Update focusMinutes when activity selected
  useEffect(() => {
    if (selectedId) {
      const act = unscheduledActivities.find((a) => a.id === selectedId);
      if (act) setFocusMinutes(String(act.remaining_minutes));
    }
  }, [selectedId]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  function buildUTCString(timeDate: Date): string {
    const hhmm = `${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return localTimeToUTC(scheduleDate, hhmm, tz).toISOString();
  }

  function handleSchedule() {
    if (!selectedId) { setError('Select an activity.'); return; }
    const focus = parseInt(focusMinutes, 10);
    if (isNaN(focus) || focus <= 0) { setError('Focus minutes must be a positive number.'); return; }

    const selectedActivity = unscheduledActivities.find((a) => a.id === selectedId);
    if (selectedActivity && focus > selectedActivity.remaining_minutes) {
      setError(`Cannot exceed remaining time (${selectedActivity.remaining_minutes} min).`);
      return;
    }

    const startAt = buildUTCString(startTime);
    const endMs = startTime.getTime() + focus * 60_000;
    const endAt = buildUTCString(new Date(endMs));

    scheduleActivity.mutate(
      { activityId: selectedId, scheduleDate, startAt, endAt, focusMinutes: focus },
      {
        onSuccess: () => { onSuccess(); sheetRef.current?.close(); },
        onError: (e) => setError(e instanceof Error ? e.message : 'Failed to schedule.'),
      }
    );
  }

  const selectedActivity = unscheduledActivities.find((a) => a.id === selectedId);

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
      <View style={styles.content}>
        <Text style={styles.title}>Schedule from Slot</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Activity picker */}
        <Text style={styles.label}>Activity</Text>
        <ScrollView style={styles.activityList} showsVerticalScrollIndicator={false}>
          {unscheduledActivities.length === 0 ? (
            <Text style={styles.emptyText}>No unscheduled activities for this date.</Text>
          ) : (
            unscheduledActivities.map((a) => {
              const isSelected = a.id === selectedId;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.activityRow, isSelected && styles.activityRowSelected]}
                  onPress={() => { setSelectedId(a.id); setError(null); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.activityRowLeft}>
                    {a.priority ? <Badge variant={a.priority} /> : null}
                    <Text
                      style={[styles.activityTitle, isSelected && styles.activityTitleSelected]}
                      numberOfLines={1}
                    >
                      {a.title}
                    </Text>
                  </View>
                  <Text style={[styles.activityMeta, isSelected && styles.activityMetaSelected]}>
                    {a.remaining_minutes} min
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Time + duration */}
        <TimePickerField label="Start time" value={startTime} onChange={setStartTime} />

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Focus minutes</Text>
            <TextInput
              style={styles.input}
              value={focusMinutes}
              onChangeText={(v) => { setFocusMinutes(v); setError(null); }}
              keyboardType="number-pad"
              placeholderTextColor={colors.gray[400]}
            />
            {selectedActivity && (
              <Text style={styles.hint}>Max: {selectedActivity.remaining_minutes} min</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, (!selectedId || scheduleActivity.isPending) && styles.btnDim]}
          onPress={handleSchedule}
          disabled={!selectedId || scheduleActivity.isPending}
        >
          <Text style={styles.btnText}>
            {scheduleActivity.isPending ? 'Scheduling…' : 'Add to Timeline'}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl },
  handle: { backgroundColor: colors.gray[300], width: 40 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'], flex: 1 },
  title: { fontFamily: fontFamily.handwriting, fontSize: fontSize['2xl'], color: colors.ink.DEFAULT },
  label: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light },
  error: {
    fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.red[600],
    backgroundColor: colors.red[50], borderRadius: borderRadius.md, padding: spacing.sm,
  },
  activityList: { maxHeight: 180, borderWidth: 1, borderColor: colors.blue[100], borderRadius: borderRadius.lg, backgroundColor: '#FFFFFF' },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light, padding: spacing.md, textAlign: 'center' },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.blue[50],
  },
  activityRowSelected: { backgroundColor: colors.blue[600] },
  activityRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, minWidth: 0 },
  activityTitle: { flex: 1, fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.DEFAULT },
  activityTitleSelected: { color: '#FFFFFF', fontWeight: fontWeight.semibold },
  activityMeta: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.gray[400] },
  activityMetaSelected: { color: 'rgba(255,255,255,0.8)' },
  row: { flexDirection: 'row', gap: spacing.md },
  flex1: { flex: 1 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.blue[100],
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT, minHeight: 44,
  },
  hint: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.gray[400], marginTop: 2 },
  btn: { backgroundColor: colors.blue[600], borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  btnDim: { opacity: 0.4 },
  btnText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: '#FFFFFF' },
});
