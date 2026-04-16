import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { canCreateActivityOnDate } from '@pm/domain';
import { useCreateActivity } from '../../hooks/useActivities';
import { DatePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';
import { todayISO } from '../../lib/dateUtils';

const DURATION_CHIPS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: 'Custom', value: 0 },
];

interface Props {
  visible: boolean;
  contactId: string;
  contactName: string;
  onClose: () => void;
}

function isoToDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DelegatedActivityFormModal({ visible, contactId, contactName, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date>(() => isoToDate(todayISO()));
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [isCustom, setIsCustom] = useState(false);
  const [customDuration, setCustomDuration] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateActivity();

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDate(isoToDate(todayISO()));
    setDurationMinutes(30);
    setIsCustom(false);
    setCustomDuration('');
    setNote('');
    setError(null);
  }, [visible]);

  const effectiveDuration = isCustom ? (parseInt(customDuration, 10) || 30) : durationMinutes;

  const handleSave = () => {
    setError(null);
    const isoDate = dateToIso(date);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!canCreateActivityOnDate(isoDate)) { setError('Cannot create activities in the past.'); return; }
    if (effectiveDuration <= 0) { setError('Duration must be positive.'); return; }

    createMutation.mutate(
      {
        title: title.trim(),
        activity_date: isoDate,
        section_type: 'delegated',
        delegated_contact_id: contactId,
        estimated_minutes: effectiveDuration,
        note: note.trim() || null,
      },
      {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      },
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={createMutation.isPending}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delegated Task</Text>
          <TouchableOpacity onPress={handleSave} disabled={createMutation.isPending}>
            <Text style={[styles.saveText, createMutation.isPending && styles.textDisabled]}>
              {createMutation.isPending ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Contact (read-only) */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Delegated To</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyText}>{contactName}</Text>
            </View>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Task Title</Text>
            <RNTextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Send updated proposal"
              placeholderTextColor={colors.gray[400]}
              autoFocus
            />
          </View>

          {/* Date */}
          <View style={styles.section}>
            <DatePickerField
              label="Due Date"
              value={date}
              onChange={setDate}
              minimumDate={isoToDate(todayISO())}
            />
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Estimated Duration</Text>
            <View style={styles.chipRow}>
              {DURATION_CHIPS.map((chip) => {
                const isSelected = chip.value === 0
                  ? isCustom
                  : !isCustom && durationMinutes === chip.value;
                return (
                  <TouchableOpacity
                    key={chip.value}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => {
                      if (chip.value === 0) {
                        setIsCustom(true);
                      } else {
                        setIsCustom(false);
                        setDurationMinutes(chip.value);
                      }
                    }}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isCustom && (
              <View style={styles.customDurationRow}>
                <RNTextInput
                  style={styles.customDurationInput}
                  value={customDuration}
                  onChangeText={setCustomDuration}
                  placeholder="Minutes"
                  placeholderTextColor={colors.gray[400]}
                  keyboardType="number-pad"
                />
                <Text style={styles.customDurationUnit}>min</Text>
              </View>
            )}
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <RNTextInput
              style={[styles.input, styles.multilineInput]}
              value={note}
              onChangeText={setNote}
              placeholder="Any context or instructions…"
              placeholderTextColor={colors.gray[400]}
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  cancelText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[500],
  },
  saveText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.blue[600],
  },
  textDisabled: { opacity: 0.5 },
  scroll: { flex: 1 },
  errorBox: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.red[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.red[200],
  },
  errorText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.red[600],
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  readonlyField: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  readonlyText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.light,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  chipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
  },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  customDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  customDurationInput: {
    width: 80,
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
  },
  customDurationUnit: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
  },
});
