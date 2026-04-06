/**
 * Shared form fields used by both AddActivityModal and EditActivityModal.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { TextInput } from '../ui/TextInput';
import { DatePickerField } from '../ui/DatePickerField';
import { SelectPickerField } from '../ui/SelectPickerField';
import type { SelectOption } from '../ui/SelectPickerField';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';
import { MAX_A_PRIORITY_PER_DAY } from '@pm/domain';

export type SectionType = 'work' | 'outside' | 'unplanned' | 'delegated';
export type PriorityValue = 'A' | 'B' | null;

export interface ActivityFormValues {
  title: string;
  section_type: SectionType;
  priority: PriorityValue;
  activity_date: string;
  estimated_hours: string;
  linked_project_id: string | null;
  delegated_contact_id: string | null;
  note: string;
}

interface Props {
  values: ActivityFormValues;
  onChange: (patch: Partial<ActivityFormValues>) => void;
  projectOptions: SelectOption[];
  contactOptions: SelectOption[];
  aPriorityCount: number;
  error?: string | null;
}

const SECTION_OPTIONS: { label: string; value: SectionType }[] = [
  { label: 'Work', value: 'work' },
  { label: 'Outside', value: 'outside' },
  { label: 'Unplanned', value: 'unplanned' },
  { label: 'Delegated', value: 'delegated' },
];

const PRIORITY_OPTIONS: { label: string; value: string }[] = [
  { label: 'None', value: 'none' },
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
];

export function ActivityForm({ values, onChange, projectOptions, contactOptions, aPriorityCount, error }: Props) {
  const aCapped = aPriorityCount >= MAX_A_PRIORITY_PER_DAY;

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Title */}
      <TextInput
        label="Title"
        value={values.title}
        onChangeText={(v) => onChange({ title: v })}
        placeholder="What needs to be done?"
        returnKeyType="next"
      />

      {/* Section type */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Section</Text>
        <View style={styles.segmented}>
          {SECTION_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.seg, values.section_type === opt.value && styles.segActive]}
              onPress={() => onChange({ section_type: opt.value, linked_project_id: null, delegated_contact_id: null })}
            >
              <Text style={[styles.segText, values.section_type === opt.value && styles.segTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Priority */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Priority</Text>
        {aCapped && (
          <Text style={styles.capWarning}>
            Max {MAX_A_PRIORITY_PER_DAY} A-priorities reached for this day.
          </Text>
        )}
        <View style={styles.segmented}>
          {PRIORITY_OPTIONS.map((opt) => {
            const disabled = opt.value === 'A' && aCapped && values.priority !== 'A';
            const currentVal = values.priority ?? 'none';
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.seg, currentVal === opt.value && styles.segActive, disabled && styles.segDisabled]}
                onPress={() => !disabled && onChange({ priority: opt.value === 'none' ? null : (opt.value as PriorityValue) })}
                disabled={disabled}
              >
                <Text style={[styles.segText, currentVal === opt.value && styles.segTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Date */}
      <View style={styles.fieldGroup}>
        <DatePickerField
          label="Date"
          value={values.activity_date ? new Date(values.activity_date + 'T12:00:00') : null}
          onChange={(d) => {
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            onChange({ activity_date: iso });
          }}
          minimumDate={new Date()}
        />
      </View>

      {/* Estimated hours */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Estimated hours</Text>
        <RNTextInput
          style={styles.hoursInput}
          value={values.estimated_hours}
          onChangeText={(v) => onChange({ estimated_hours: v })}
          keyboardType="decimal-pad"
          placeholder="e.g. 1.5"
          placeholderTextColor={colors.gray[400]}
        />
      </View>

      {/* Project (Work section only) */}
      {values.section_type === 'work' && (
        <View style={styles.fieldGroup}>
          <SelectPickerField
            label="Project (required)"
            value={values.linked_project_id}
            options={projectOptions}
            onChange={(v) => onChange({ linked_project_id: v })}
            placeholder="Select project…"
          />
        </View>
      )}

      {/* Contact (Delegated section only) */}
      {values.section_type === 'delegated' && (
        <View style={styles.fieldGroup}>
          <SelectPickerField
            label="Delegate to (required)"
            value={values.delegated_contact_id}
            options={contactOptions}
            onChange={(v) => onChange({ delegated_contact_id: v })}
            placeholder="Select contact…"
          />
        </View>
      )}

      {/* Note */}
      <View style={styles.fieldGroup}>
        <TextInput
          label="Note (optional)"
          value={values.note}
          onChangeText={(v) => onChange({ note: v })}
          placeholder="Any extra context…"
          multiline
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  error: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.red[600],
    backgroundColor: colors.red[50],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  fieldGroup: { gap: spacing.xs },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
  },
  capWarning: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.amber[600],
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  seg: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  segActive: {
    backgroundColor: colors.blue[600],
  },
  segDisabled: {
    opacity: 0.4,
  },
  segText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  segTextActive: {
    color: '#FFFFFF',
    fontWeight: fontWeight.semibold,
  },
  hoursInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    minHeight: 44,
  },
});
