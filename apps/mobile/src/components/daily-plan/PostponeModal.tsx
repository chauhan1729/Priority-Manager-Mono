import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { DatePickerField } from '../ui/DatePickerField';
import { usePostponeActivity } from '../../hooks/useActivities';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';
import { addDays, todayISO } from '../../lib/dateUtils';

interface Props {
  activityId: string | null;
  currentDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PostponeModal({ activityId, currentDate, onClose, onSuccess }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['45%'], []);
  const postpone = usePostponeActivity();
  const [toDate, setToDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (activityId) {
      setToDate(null);
      setError(null);
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [activityId]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  function toISO(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function handlePostpone() {
    if (!activityId || !toDate) { setError('Select a date.'); return; }
    const iso = toISO(toDate);
    postpone.mutate(
      { activityId, toDate: iso, currentDate },
      {
        onSuccess: () => { onSuccess(); sheetRef.current?.close(); },
        onError: (e) => setError(e instanceof Error ? e.message : 'Failed to postpone.'),
      }
    );
  }

  const tomorrow = new Date(addDays(todayISO(), 1) + 'T12:00:00');

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
        <Text style={styles.title}>Postpone Activity</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Quick shortcuts */}
        <View style={styles.shortcuts}>
          {[1, 2, 7].map((n) => {
            const label = n === 1 ? 'Tomorrow' : n === 2 ? 'In 2 days' : 'Next week';
            return (
              <TouchableOpacity
                key={n}
                style={styles.shortcut}
                onPress={() => setToDate(new Date(addDays(currentDate, n) + 'T12:00:00'))}
              >
                <Text style={styles.shortcutText}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <DatePickerField
          label="Or pick a date"
          value={toDate}
          onChange={setToDate}
          minimumDate={tomorrow}
        />

        <TouchableOpacity
          style={[styles.btn, (!toDate || postpone.isPending) && styles.btnDim]}
          onPress={handlePostpone}
          disabled={!toDate || postpone.isPending}
        >
          <Text style={styles.btnText}>
            {postpone.isPending ? 'Postponing…' : 'Postpone'}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl },
  handle: { backgroundColor: colors.gray[300], width: 40 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },
  title: { fontFamily: fontFamily.handwriting, fontSize: fontSize.xl, color: colors.ink.DEFAULT },
  error: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.red[600], backgroundColor: colors.red[50], borderRadius: borderRadius.md, padding: spacing.sm },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  shortcut: { flex: 1, borderWidth: 1, borderColor: colors.blue[100], borderRadius: borderRadius.md, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: '#FFFFFF' },
  shortcutText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.blue[600], fontWeight: fontWeight.medium },
  btn: { backgroundColor: colors.blue[600], borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  btnDim: { opacity: 0.4 },
  btnText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: '#FFFFFF' },
});
