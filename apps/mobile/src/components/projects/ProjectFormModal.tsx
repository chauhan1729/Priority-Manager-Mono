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
import type { Project, ProjectStatus } from '@pm/types';
import {
  type CreateProjectInput,
  type UpdateProjectInput,
  useCreateProject,
  useUpdateProject,
} from '../../hooks/useProjects';
import { DatePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

const STATUS_OPTIONS: { label: string; value: ProjectStatus }[] = [
  { label: 'Planned',     value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'On Hold',     value: 'on_hold' },
  { label: 'Completed',   value: 'completed' },
  { label: 'Cancelled',   value: 'cancelled' },
];

// ISO ↔ Date adapters
function isoDateToDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T12:00:00`);
}
function dateToIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  visible: boolean;
  editProject?: Project | null;
  onClose: () => void;
}

export function ProjectFormModal({ visible, editProject, onClose }: Props) {
  const isEdit = !!editProject;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planned');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending;

  useEffect(() => {
    if (!visible) return;
    if (editProject) {
      setName(editProject.name);
      setDescription(editProject.description ?? '');
      setStatus(editProject.status);
      setStartDate(editProject.start_date ?? '');
      setEndDate(editProject.target_end_date ?? '');
    } else {
      setName('');
      setDescription('');
      setStatus('planned');
      setStartDate('');
      setEndDate('');
    }
    setError(null);
  }, [visible, editProject]);

  const handleSave = () => {
    setError(null);
    if (!name.trim()) { setError('Project name is required.'); return; }

    if (isEdit && editProject) {
      const input: UpdateProjectInput = {
        id: editProject.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
        start_date: startDate || null,
        target_end_date: endDate || null,
      };
      updateMutation.mutate(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    } else {
      const input: CreateProjectInput = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        start_date: startDate || null,
        target_end_date: endDate || null,
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
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={isPending}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Project' : 'New Project'}</Text>
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

          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Project Name *</Text>
            <RNTextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Product Launch Q3"
              placeholderTextColor={colors.gray[400]}
              autoFocus={!isEdit}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <RNTextInput
              style={[styles.input, styles.multilineInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="Brief summary of the project goals…"
              placeholderTextColor={colors.gray[400]}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Status */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = status === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => setStatus(opt.value)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Start date */}
          <View style={styles.section}>
            <DatePickerField
              label="Start Date (optional)"
              value={isoDateToDate(startDate)}
              onChange={(d) => setStartDate(dateToIsoDate(d))}
            />
          </View>

          {/* Target end date */}
          <View style={styles.section}>
            <DatePickerField
              label="Target End Date (optional)"
              value={isoDateToDate(endDate)}
              onChange={(d) => setEndDate(dateToIsoDate(d))}
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
