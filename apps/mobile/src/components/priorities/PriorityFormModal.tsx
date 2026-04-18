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
import type {
  AnnualGoal,
  MonthlyPriority,
  MonthlyPrioritySection,
  MonthlyPriorityStatus,
  ProgressMode,
  Project,
} from '@pm/types';
import { MP_STATUS_LABELS } from '@pm/domain';
import {
  type CreateMonthlyPriorityInput,
  type UpdateMonthlyPriorityInput,
  useCreateMonthlyPriority,
  useUpdateMonthlyPriority,
  useUpdatePriorityProgress,
} from '../../hooks/useMonthlyPriorities';
import { DatePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SECTIONS: { label: string; value: MonthlyPrioritySection }[] = [
  { label: 'Business / Career', value: 'business_career' },
  { label: 'Personal',          value: 'personal' },
];

const STATUSES: MonthlyPriorityStatus[] = [
  'planned', 'in_progress', 'on_hold', 'completed', 'dropped',
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  editPriority?: MonthlyPriority | null;
  initialSection?: MonthlyPrioritySection;
  monthKey: string;
  annualGoals: AnnualGoal[];
  projects: Project[];
  /** Pre-fill form from this priority's values; save as NEW in `monthKey` (for month-end "Rewrite") */
  rewriteFromPriority?: MonthlyPriority | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriorityFormModal({
  visible,
  editPriority,
  initialSection = 'business_career',
  monthKey,
  annualGoals,
  projects,
  rewriteFromPriority,
  onClose,
}: Props) {
  const isEdit = !!editPriority;
  const isRewrite = !isEdit && !!rewriteFromPriority;

  const [section, setSection] = useState<MonthlyPrioritySection>(initialSection);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [startedDate, setStartedDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [linkedGoalId, setLinkedGoalId] = useState<string | null>(null);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [progressMode, setProgressMode] = useState<ProgressMode>('manual');
  const [manualProgress, setManualProgress] = useState(0);
  const [status, setStatus] = useState<MonthlyPriorityStatus>('planned');
  const [note, setNote] = useState('');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const createMutation = useCreateMonthlyPriority();
  const updateMutation = useUpdateMonthlyPriority();
  const progressMutation = useUpdatePriorityProgress();
  const isPending =
    isEdit
      ? updateMutation.isPending || progressMutation.isPending
      : createMutation.isPending;

  useEffect(() => {
    if (!visible) return;
    if (editPriority) {
      setSection(editPriority.section);
      setTitle(editPriority.title);
      setCategory(editPriority.category ?? '');
      setStartedDate(editPriority.started_date ?? '');
      setTargetDate(editPriority.target_date ?? '');
      setLinkedGoalId(editPriority.linked_annual_goal_id);
      setLinkedProjectId(editPriority.linked_project_id);
      setProgressMode(editPriority.progress_mode);
      setManualProgress(editPriority.manual_progress_percent ?? 0);
      setStatus(editPriority.status);
      setNote(editPriority.note ?? '');
      setPinned(editPriority.pinned);
    } else if (rewriteFromPriority) {
      // Pre-fill from source priority, but target the new monthKey
      setSection(rewriteFromPriority.section);
      setTitle(rewriteFromPriority.title);
      setCategory(rewriteFromPriority.category ?? '');
      setStartedDate(''); // fresh start for new month
      setTargetDate(rewriteFromPriority.target_date ?? '');
      setLinkedGoalId(rewriteFromPriority.linked_annual_goal_id);
      setLinkedProjectId(rewriteFromPriority.linked_project_id);
      setProgressMode(rewriteFromPriority.progress_mode);
      setManualProgress(0); // reset progress on rewrite
      setStatus('planned'); // always reset to planned for new month
      setNote(rewriteFromPriority.note ?? '');
      setPinned(rewriteFromPriority.pinned);
    } else {
      setSection(initialSection);
      setTitle('');
      setCategory('');
      setStartedDate('');
      setTargetDate('');
      setLinkedGoalId(null);
      setLinkedProjectId(null);
      setProgressMode('manual');
      setManualProgress(0);
      setStatus('planned');
      setNote('');
      setPinned(false);
    }
    setError(null);
    setShowGoalPicker(false);
    setShowProjectPicker(false);
  }, [visible, editPriority, initialSection, rewriteFromPriority]);

  // Reset auto_project mode if project gets unlinked
  useEffect(() => {
    if (!linkedProjectId && progressMode === 'auto_project') {
      setProgressMode('manual');
    }
  }, [linkedProjectId, progressMode]);

  const handleSave = () => {
    setError(null);
    if (isEdit && editPriority) {
      const input: UpdateMonthlyPriorityInput & { month_key: string } = {
        id: editPriority.id,
        month_key: editPriority.month_key,
        title: title.trim(),
        category: category.trim() || null,
        started_date: startedDate || null,
        target_date: targetDate || null,
        linked_annual_goal_id: linkedGoalId,
        linked_project_id: linkedProjectId,
        progress_mode: progressMode,
        status,
        note: note.trim() || null,
        pinned,
      };
      updateMutation.mutate(input, {
        onSuccess: () => {
          // Save manual progress separately if changed
          if (
            progressMode === 'manual' &&
            manualProgress !== (editPriority.manual_progress_percent ?? 0)
          ) {
            progressMutation.mutate(
              { id: editPriority.id, progressPercent: manualProgress, month_key: editPriority.month_key },
              { onSuccess: onClose, onError: (e: Error) => setError(e.message) },
            );
          } else {
            onClose();
          }
        },
        onError: (e: Error) => setError(e.message),
      });
    } else {
      const input: CreateMonthlyPriorityInput = {
        section,
        title: title.trim(),
        month_key: monthKey,
        category: category.trim() || null,
        started_date: startedDate || null,
        target_date: targetDate || null,
        linked_annual_goal_id: linkedGoalId,
        linked_project_id: linkedProjectId,
        progress_mode: progressMode,
        note: note.trim() || null,
        pinned,
      };
      createMutation.mutate(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    }
  };

  const selectedGoal = annualGoals.find((g) => g.id === linkedGoalId);
  const selectedProject = projects.find((p) => p.id === linkedProjectId);

  const renderProgressControl = () => {
    if (progressMode === 'auto_project') {
      return (
        <View style={styles.autoProgressNote}>
          <Text style={styles.autoProgressText}>
            Progress is automatically computed from the linked project.
          </Text>
        </View>
      );
    }
    return (
      <>
        <View style={styles.progressPresets}>
          {[0, 25, 50, 75, 100].map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[styles.presetBtn, manualProgress === preset && styles.presetBtnActive]}
              onPress={() => setManualProgress(preset)}
            >
              <Text style={[styles.presetBtnText, manualProgress === preset && styles.presetBtnTextActive]}>
                {preset}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.fineRow}>
          {[-10, -5].map((d) => (
            <TouchableOpacity
              key={d}
              style={styles.fineBtn}
              onPress={() => setManualProgress((p) => Math.max(0, p + d))}
            >
              <Text style={styles.fineBtnText}>{d}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.fineValue}>
            <Text style={styles.fineValueText}>{manualProgress}%</Text>
          </View>
          {[5, 10].map((d) => (
            <TouchableOpacity
              key={d}
              style={styles.fineBtn}
              onPress={() => setManualProgress((p) => Math.min(100, p + d))}
            >
              <Text style={styles.fineBtnText}>+{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
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
          <Text style={styles.headerTitle}>
            {isEdit ? 'Edit Priority' : isRewrite ? 'Rewrite for New Month' : 'New Priority'}
          </Text>
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
                  const isSel = section === s.value;
                  return (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.chip, isSel && styles.chipActive]}
                      onPress={() => setSection(s.value)}
                    >
                      <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
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
              placeholder="e.g. Launch Q2 marketing campaign"
              placeholderTextColor={colors.gray[400]}
              autoFocus={!isEdit}
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Category (optional)</Text>
            <RNTextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Marketing, Health, Learning"
              placeholderTextColor={colors.gray[400]}
            />
          </View>

          {/* Dates */}
          <View style={styles.section}>
            <DatePickerField
              label="Started Date (optional)"
              value={isoDateToDate(startedDate)}
              onChange={(d) => setStartedDate(dateToIsoDate(d))}
            />
          </View>
          <View style={styles.section}>
            <DatePickerField
              label="Target Date (optional)"
              value={isoDateToDate(targetDate)}
              onChange={(d) => setTargetDate(dateToIsoDate(d))}
            />
          </View>

          {/* Status (edit only) */}
          {isEdit && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.chipRow}>
                {STATUSES.map((s) => {
                  const isSel = status === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, isSel && styles.chipActive]}
                      onPress={() => setStatus(s)}
                    >
                      <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                        {MP_STATUS_LABELS[s]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Pinned toggle */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.toggleRow, pinned && styles.toggleRowActive]}
              onPress={() => setPinned((p) => !p)}
            >
              <Text style={[styles.toggleText, pinned && styles.toggleTextActive]}>
                📌 Pin this priority
              </Text>
            </TouchableOpacity>
          </View>

          {/* Linked annual goal */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Linked Annual Goal (optional)</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => { setShowGoalPicker(!showGoalPicker); setShowProjectPicker(false); }}
            >
              <Text style={selectedGoal ? styles.pickerBtnTextSelected : styles.pickerBtnText}>
                {selectedGoal ? selectedGoal.title : 'Select a goal…'}
              </Text>
              <Text style={styles.pickerCaret}>{showGoalPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showGoalPicker && (
              <View style={styles.pickerList}>
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => { setLinkedGoalId(null); setShowGoalPicker(false); }}
                >
                  <Text style={styles.pickerItemText}>None</Text>
                </TouchableOpacity>
                {annualGoals.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.pickerItem, linkedGoalId === g.id && styles.pickerItemActive]}
                    onPress={() => { setLinkedGoalId(g.id); setShowGoalPicker(false); }}
                  >
                    <Text style={styles.pickerItemText} numberOfLines={2}>{g.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Linked project */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Linked Project (optional)</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => { setShowProjectPicker(!showProjectPicker); setShowGoalPicker(false); }}
            >
              <Text style={selectedProject ? styles.pickerBtnTextSelected : styles.pickerBtnText}>
                {selectedProject ? selectedProject.name : 'Select a project…'}
              </Text>
              <Text style={styles.pickerCaret}>{showProjectPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showProjectPicker && (
              <View style={styles.pickerList}>
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => { setLinkedProjectId(null); setShowProjectPicker(false); }}
                >
                  <Text style={styles.pickerItemText}>None</Text>
                </TouchableOpacity>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.pickerItem, linkedProjectId === p.id && styles.pickerItemActive]}
                    onPress={() => { setLinkedProjectId(p.id); setShowProjectPicker(false); }}
                  >
                    <Text style={styles.pickerItemText} numberOfLines={1}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Progress mode */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Progress Mode</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, progressMode === 'manual' && styles.chipActive]}
                onPress={() => setProgressMode('manual')}
              >
                <Text style={[styles.chipText, progressMode === 'manual' && styles.chipTextActive]}>
                  Manual
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chip,
                  progressMode === 'auto_project' && styles.chipActive,
                  !linkedProjectId && styles.chipDisabled,
                ]}
                disabled={!linkedProjectId}
                onPress={() => setProgressMode('auto_project')}
              >
                <Text style={[
                  styles.chipText,
                  progressMode === 'auto_project' && styles.chipTextActive,
                  !linkedProjectId && styles.chipTextDisabled,
                ]}>
                  Auto (Project)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Manual progress control */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Progress</Text>
            {renderProgressControl()}
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <RNTextInput
              style={[styles.input, styles.multilineInput]}
              value={note}
              onChangeText={setNote}
              placeholder="Any context or details…"
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: colors.blue[600], borderColor: colors.blue[600] },
  chipDisabled: { borderColor: colors.gray[200], backgroundColor: colors.gray[50] },
  chipText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  chipTextDisabled: { color: colors.gray[300] },

  // Toggle (pinned)
  toggleRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: '#FFFFFF',
  },
  toggleRowActive: { borderColor: colors.blue[400], backgroundColor: colors.blue[50] },
  toggleText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
  },
  toggleTextActive: { color: colors.blue[700], fontWeight: '600' },

  // Picker
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },
  pickerBtnText: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
  },
  pickerBtnTextSelected: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  pickerCaret: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
  pickerList: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.md,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[50],
  },
  pickerItemActive: { backgroundColor: colors.blue[50] },
  pickerItemText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },

  // Progress control
  autoProgressNote: {
    padding: spacing.md,
    backgroundColor: colors.blue[50],
    borderRadius: borderRadius.md,
  },
  autoProgressText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.blue[700],
  },
  progressPresets: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  presetBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
  },
  presetBtnActive: { backgroundColor: colors.blue[600], borderColor: colors.blue[600] },
  presetBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: '500', color: colors.ink.light },
  presetBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
  fineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  fineBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.blue[200],
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  fineBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '600', color: colors.blue[700] },
  fineValue: { flex: 2, alignItems: 'center' },
  fineValueText: { fontFamily: fontFamily.sans, fontSize: fontSize.lg, fontWeight: '700', color: colors.blue[600] },
});
