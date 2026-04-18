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
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AnnualGoal, AnnualGoalSection, AnnualGoalStatus } from '@pm/types';
import {
  type CreateAnnualGoalInput,
  type UpdateAnnualGoalInput,
  useCreateAnnualGoal,
  useUpdateAnnualGoal,
} from '../../hooks/useAnnualGoals';
import { DatePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SECTIONS: { label: string; value: AnnualGoalSection }[] = [
  { label: 'Business', value: 'business' },
  { label: 'Career',   value: 'career' },
  { label: 'Personal', value: 'personal' },
];

const STATUSES: { label: string; value: AnnualGoalStatus }[] = [
  { label: 'Not Started', value: 'not_started' },
  { label: 'Active',      value: 'active' },
  { label: 'On Track',    value: 'on_track' },
  { label: 'At Risk',     value: 'at_risk' },
  { label: 'Completed',   value: 'completed' },
  { label: 'Dropped',     value: 'dropped' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  editGoal?: AnnualGoal | null;
  initialSection?: AnnualGoalSection;
  initialYear?: number;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GoalFormModal({
  visible,
  editGoal,
  initialSection = 'business',
  initialYear,
  onClose,
}: Props) {
  const isEdit = !!editGoal;

  const [section, setSection] = useState<AnnualGoalSection>(initialSection);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<AnnualGoalStatus>('not_started');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateAnnualGoal();
  const updateMutation = useUpdateAnnualGoal();
  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending;

  useEffect(() => {
    if (!visible) return;
    if (editGoal) {
      setSection(editGoal.section);
      setTitle(editGoal.title);
      setDescription(editGoal.description ?? '');
      setWhyItMatters(editGoal.why_it_matters ?? '');
      setTargetDate(editGoal.target_date ?? '');
      setStatus(editGoal.status);
      setNotes(editGoal.notes ?? '');
    } else {
      setSection(initialSection);
      setTitle('');
      setDescription('');
      setWhyItMatters('');
      // Default target date to Dec 31 of the initial year
      setTargetDate(initialYear ? `${initialYear}-12-31` : '');
      setStatus('not_started');
      setNotes('');
    }
    setError(null);
  }, [visible, editGoal, initialSection, initialYear]);

  const handleSave = () => {
    setError(null);
    if (isEdit && editGoal) {
      const input: UpdateAnnualGoalInput = {
        id: editGoal.id,
        title: title.trim(),
        description: description.trim(),
        why_it_matters: whyItMatters.trim(),
        target_date: targetDate || null,
        status,
        notes: notes.trim() || null,
      };
      updateMutation.mutate(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    } else {
      const input: CreateAnnualGoalInput = {
        section,
        title: title.trim(),
        description: description.trim(),
        why_it_matters: whyItMatters.trim(),
        target_date: targetDate || null,
        notes: notes.trim() || null,
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
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={isPending}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Goal' : 'New Goal'}</Text>
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

          {/* Section (read-only on edit) */}
          {!isEdit && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Section</Text>
              <View style={styles.chipRow}>
                {SECTIONS.map((s) => {
                  const isSelected = section === s.value;
                  return (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setSection(s.value)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <RNTextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Launch new product line"
              placeholderTextColor={colors.gray[400]}
              autoFocus={!isEdit}
            />
          </View>

          {/* Status (edit only) */}
          {isEdit && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.chipRow}>
                {STATUSES.map((s) => {
                  const isSelected = status === s.value;
                  return (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setStatus(s.value)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Target date */}
          <View style={styles.section}>
            <DatePickerField
              label="Target Date (optional)"
              value={targetDate ? new Date(`${targetDate}T12:00:00`) : null}
              onChange={(d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setTargetDate(`${y}-${m}-${day}`);
              }}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <RNTextInput
              style={[styles.input, styles.multilineInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="What does achieving this goal look like?"
              placeholderTextColor={colors.gray[400]}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Why it matters */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Why it matters (optional)</Text>
            <RNTextInput
              style={[styles.input, styles.multilineInput]}
              value={whyItMatters}
              onChangeText={setWhyItMatters}
              placeholder="The deeper reason this goal is important…"
              placeholderTextColor={colors.gray[400]}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <RNTextInput
              style={[styles.input, styles.multilineInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional context…"
              placeholderTextColor={colors.gray[400]}
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
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
});
