import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AvailabilityStatus, YearEntry, YearEntryType } from '@pm/types';
import {
  type CreateYearEntryInput,
  type UpdateYearEntryInput,
  useCreateYearEntry,
  useUpdateYearEntry,
} from '../../hooks/useYearEntries';
import { DatePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ENTRY_TYPES: { label: string; value: YearEntryType; icon: string }[] = [
  { label: 'Travel',   value: 'travel',   icon: '✈' },
  { label: 'Away',     value: 'away',     icon: '🏠' },
  { label: 'Birthday', value: 'birthday', icon: '🎂' },
];

const AVAILABILITY_OPTIONS: { label: string; value: AvailabilityStatus }[] = [
  { label: 'Available', value: 'available' },
  { label: 'Partial',   value: 'partial' },
  { label: 'Away',      value: 'away' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  editEntry?: YearEntry | null;
  initialDate?: string;
  onClose: () => void;
}

export function YearEntryFormModal({ visible, editEntry, initialDate, onClose }: Props) {
  const isEdit = !!editEntry;

  const [type, setType] = useState<YearEntryType>('travel');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(initialDate ?? '');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [createTripPlan, setCreateTripPlan] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateYearEntry();
  const updateMutation = useUpdateYearEntry();
  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending;

  const isBirthday = type === 'birthday';

  useEffect(() => {
    if (!visible) return;
    if (editEntry) {
      setType(editEntry.type);
      setTitle(editEntry.title);
      setStartDate(editEntry.start_date);
      setEndDate(editEntry.end_date ?? '');
      setLocation(editEntry.location ?? '');
      setAvailability(editEntry.availability_status ?? 'available');
      setCreateTripPlan(editEntry.create_linked_trip_plan);
      setNote(editEntry.note ?? '');
    } else {
      setType('travel');
      setTitle('');
      setStartDate(initialDate ?? '');
      setEndDate('');
      setLocation('');
      setAvailability('available');
      setCreateTripPlan(false);
      setNote('');
    }
    setError(null);
  }, [visible, editEntry, initialDate]);

  // Reset birthday-incompatible fields when switching to birthday
  useEffect(() => {
    if (isBirthday) {
      setEndDate('');
      setCreateTripPlan(false);
    }
  }, [isBirthday]);

  const handleSave = () => {
    setError(null);

    if (isEdit && editEntry) {
      const input: UpdateYearEntryInput = {
        id: editEntry.id,
        title: title.trim(),
        start_date: startDate,
        end_date: isBirthday ? null : (endDate || null),
        location: isBirthday ? null : (location.trim() || null),
        note: note.trim() || null,
        availability_status: isBirthday ? null : availability,
        create_linked_trip_plan: isBirthday ? false : createTripPlan,
      };
      updateMutation.mutate(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    } else {
      const input: CreateYearEntryInput = {
        type,
        title: title.trim(),
        start_date: startDate,
        end_date: isBirthday ? null : (endDate || null),
        location: isBirthday ? null : (location.trim() || null),
        note: note.trim() || null,
        availability_status: isBirthday ? null : availability,
        create_linked_trip_plan: isBirthday ? false : createTripPlan,
      };
      createMutation.mutate(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    }
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
          <TouchableOpacity onPress={onClose} disabled={isPending}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Entry' : 'New Entry'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isPending}>
            <Text style={[styles.saveText, isPending && styles.textDisabled]}>
              {isPending ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Type picker (read-only on edit — type is immutable) */}
          {!isEdit && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chipRow}>
                {ENTRY_TYPES.map((t) => {
                  const isSelected = type === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setType(t.value)}
                    >
                      <Text style={styles.chipIcon}>{t.icon}</Text>
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>
              {isBirthday ? "Person's Name" : 'Title'} *
            </Text>
            <RNTextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={isBirthday ? 'e.g. Mom' : 'e.g. Japan Trip'}
              placeholderTextColor={colors.gray[400]}
              autoFocus={!isEdit}
            />
          </View>

          {/* Start date */}
          <View style={styles.section}>
            <DatePickerField
              label={isBirthday ? 'Birthday' : 'Start Date'}
              value={startDate}
              onChange={setStartDate}
            />
          </View>

          {/* End date (hidden for birthday) */}
          {!isBirthday && (
            <View style={styles.section}>
              <DatePickerField
                label="End Date (optional)"
                value={endDate}
                onChange={setEndDate}
              />
            </View>
          )}

          {/* Location (hidden for birthday) */}
          {!isBirthday && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Location (optional)</Text>
              <RNTextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Tokyo, Japan"
                placeholderTextColor={colors.gray[400]}
              />
            </View>
          )}

          {/* Availability status (hidden for birthday) */}
          {!isBirthday && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Availability *</Text>
              <View style={styles.chipRow}>
                {AVAILABILITY_OPTIONS.map((opt) => {
                  const isSelected = availability === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setAvailability(opt.value)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Create linked trip plan toggle (hidden for birthday and when already has project) */}
          {!isBirthday && !(isEdit && editEntry?.linked_project_id) && (
            <View style={[styles.section, styles.toggleRow]}>
              <View style={styles.toggleLabel}>
                <Text style={styles.toggleTitle}>Create linked trip plan</Text>
                <Text style={styles.toggleSub}>
                  Creates a project in Project Planner for this trip
                </Text>
              </View>
              <Switch
                value={createTripPlan}
                onValueChange={setCreateTripPlan}
                trackColor={{ false: colors.gray[200], true: colors.blue[400] }}
                thumbColor={createTripPlan ? colors.blue[600] : colors.gray[400]}
              />
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <RNTextInput
              style={[styles.input, styles.multilineInput]}
              value={note}
              onChangeText={setNote}
              placeholder="Any details or context…"
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
  },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  toggleLabel: { flex: 1 },
  toggleTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  toggleSub: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
    marginTop: 2,
  },
});
