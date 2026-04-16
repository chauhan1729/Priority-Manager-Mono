/**
 * Reusable full-screen modal wrapping ActivityForm.
 * Used by both AddActivityModal and EditActivityModal.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityForm, ActivityFormValues } from './ActivityForm';
import type { SelectOption } from '../ui/SelectPickerField';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

interface Props {
  visible: boolean;
  title: string;
  initialValues: ActivityFormValues;
  projectOptions: SelectOption[];
  contactOptions: SelectOption[];
  aPriorityCount: number;
  submitting: boolean;
  readOnly?: boolean | undefined;
  onSubmit: (values: ActivityFormValues) => void;
  onClose: () => void;
}

export function ActivityFormModal({
  visible,
  title,
  initialValues,
  projectOptions,
  contactOptions,
  aPriorityCount,
  submitting,
  readOnly = false,
  onSubmit,
  onClose,
}: Props) {
  const [values, setValues] = useState<ActivityFormValues>(initialValues);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset form whenever modal opens with new initialValues
  React.useEffect(() => {
    if (visible) {
      setValues(initialValues);
      setFormError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleChange(patch: Partial<ActivityFormValues>) {
    setValues((prev) => ({ ...prev, ...patch }));
    setFormError(null);
  }

  function handleSubmit() {
    if (!values.title.trim()) { setFormError('Title is required.'); return; }
    const hours = parseFloat(values.estimated_hours);
    if (isNaN(hours) || hours <= 0) { setFormError('Estimated hours must be a positive number.'); return; }
    if (values.section_type === 'work' && !values.linked_project_id) {
      setFormError('Work activities must be linked to a project.');
      return;
    }
    if (values.section_type === 'delegated' && !values.delegated_contact_id) {
      setFormError('Delegated activities require a contact.');
      return;
    }
    onSubmit(values);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>{readOnly ? 'Close' : 'Cancel'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            {readOnly ? (
              <View style={{ width: 50 }} />
            ) : (
              <TouchableOpacity onPress={handleSubmit} disabled={submitting} hitSlop={8}>
                <Text style={[styles.save, submitting && styles.saveDim]}>
                  {submitting ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {readOnly ? (
              <View style={styles.readOnlyBox}>
                <Text style={styles.readOnlyHeading}>{values.title}</Text>
                <Text style={styles.readOnlyNote}>
                  This activity is completed and cannot be edited.
                </Text>
                {values.note ? (
                  <Text style={styles.readOnlyBody}>"{values.note}"</Text>
                ) : null}
              </View>
            ) : (
              <ActivityForm
                values={values}
                onChange={handleChange}
                projectOptions={projectOptions}
                contactOptions={contactOptions}
                aPriorityCount={aPriorityCount}
                error={formError}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  kav: { flex: 1 },
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
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize.xl,
    color: colors.ink.DEFAULT,
  },
  cancel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.light,
  },
  save: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.blue[600],
  },
  saveDim: { opacity: 0.5 },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  readOnlyBox: {
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: 12,
  },
  readOnlyHeading: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.ink.DEFAULT,
  },
  readOnlyNote: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
    fontStyle: 'italic',
  },
  readOnlyBody: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    marginTop: spacing.xs,
  },
});
