import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MilestoneStatus, ProjectMilestone } from '@pm/types';
import {
  useCreateMilestone,
  useDeleteMilestone,
  useUpdateMilestone,
  useUpdateMilestoneStatus,
} from '../../hooks/useProjects';
import { DatePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

const STATUS_STYLE: Record<MilestoneStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: colors.gray[100],  text: colors.gray[600],  label: 'Pending' },
  completed: { bg: colors.green[100], text: colors.green[700], label: 'Completed' },
  missed:    { bg: colors.red[100],   text: colors.red[600],   label: 'Missed' },
};

const STATUS_OPTIONS: { label: string; value: MilestoneStatus }[] = [
  { label: 'Pending',   value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Missed',    value: 'missed' },
];

// ISO ↔ Date adapters
function isoToDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T12:00:00`);
}
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- Form modal (create + edit) --------------------------------------------

interface FormModalProps {
  visible: boolean;
  projectId: string;
  editMilestone?: ProjectMilestone | null;
  onClose: () => void;
}

function MilestoneFormModal({ visible, projectId, editMilestone, onClose }: FormModalProps) {
  const isEdit = !!editMilestone;

  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('pending');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateMilestone();
  const updateMutation = useUpdateMilestone();
  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending;

  useEffect(() => {
    if (!visible) return;
    if (editMilestone) {
      setTitle(editMilestone.title);
      setTargetDate(editMilestone.target_date ?? '');
      setStatus(editMilestone.status);
    } else {
      setTitle('');
      setTargetDate('');
      setStatus('pending');
    }
    setError(null);
  }, [visible, editMilestone]);

  const handleSave = () => {
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }

    if (isEdit && editMilestone) {
      updateMutation.mutate(
        {
          milestoneId: editMilestone.id,
          projectId,
          title: title.trim(),
          target_date: targetDate || null,
          status,
        },
        { onSuccess: onClose, onError: (e: Error) => setError(e.message) },
      );
    } else {
      createMutation.mutate(
        { projectId, title: title.trim(), target_date: targetDate || null },
        { onSuccess: onClose, onError: (e: Error) => setError(e.message) },
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={modal.container} edges={['top', 'bottom']}>
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose}><Text style={modal.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={modal.title}>{isEdit ? 'Edit Milestone' : 'New Milestone'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isPending}>
            <Text style={[modal.save, isPending && modal.disabled]}>
              {isPending ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
        {error && (
          <View style={modal.errorBox}><Text style={modal.errorText}>{error}</Text></View>
        )}
        <View style={modal.field}>
          <Text style={modal.label}>Title *</Text>
          <RNTextInput
            style={modal.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. MVP shipped"
            placeholderTextColor={colors.gray[400]}
            autoFocus={!isEdit}
          />
        </View>
        <View style={modal.field}>
          <DatePickerField
            label="Target Date (optional)"
            value={isoToDate(targetDate)}
            onChange={(d) => setTargetDate(dateToIso(d))}
          />
        </View>
        {isEdit && (
          <View style={modal.field}>
            <Text style={modal.label}>Status</Text>
            <View style={modal.chipRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[modal.chip, status === opt.value && modal.chipActive]}
                  onPress={() => setStatus(opt.value)}
                >
                  <Text style={[modal.chipText, status === opt.value && modal.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ---- Main tab ---------------------------------------------------------------

interface Props {
  projectId: string;
  milestones: ProjectMilestone[];
}

export function MilestonesTab({ projectId, milestones }: Props) {
  const [formVisible, setFormVisible] = useState(false);
  const [editMilestone, setEditMilestone] = useState<ProjectMilestone | null>(null);
  const updateStatus = useUpdateMilestoneStatus();
  const deleteMilestone = useDeleteMilestone();

  const handleStatusPress = (milestone: ProjectMilestone) => {
    const options = STATUS_OPTIONS;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Status: ${STATUS_STYLE[milestone.status].label}`,
          options: ['Cancel', ...options.map((o) => o.label)],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx > 0) {
            const picked = options[idx - 1];
            if (picked && picked.value !== milestone.status) {
              updateStatus.mutate(
                { milestoneId: milestone.id, projectId, status: picked.value },
                { onError: (e: Error) => Alert.alert('Error', e.message) },
              );
            }
          }
        },
      );
    } else {
      Alert.alert(
        'Change Status',
        `Currently: ${STATUS_STYLE[milestone.status].label}`,
        [
          { text: 'Cancel', style: 'cancel' },
          ...options
            .filter((o) => o.value !== milestone.status)
            .map((o) => ({
              text: o.label,
              onPress: () =>
                updateStatus.mutate(
                  { milestoneId: milestone.id, projectId, status: o.value },
                  { onError: (e: Error) => Alert.alert('Error', e.message) },
                ),
            })),
        ],
      );
    }
  };

  const handleDelete = (milestone: ProjectMilestone) => {
    Alert.alert('Delete Milestone', `Delete "${milestone.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMilestone.mutate({ milestoneId: milestone.id, projectId }),
      },
    ]);
  };

  const handleCloseForm = () => {
    setFormVisible(false);
    setEditMilestone(null);
  };

  const renderItem = ({ item }: { item: ProjectMilestone }) => {
    const sc = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending;
    const dateLabel = item.target_date
      ? new Date(item.target_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardBody}>
          <Text style={styles.milestoneTitle} numberOfLines={2}>{item.title}</Text>
          {dateLabel && <Text style={styles.milestoneMeta}>Due {dateLabel}</Text>}
        </View>
        <View style={styles.cardActions}>
          {/* Tappable status chip — opens picker */}
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: sc.bg }]}
            onPress={() => handleStatusPress(item)}
            activeOpacity={0.7}
          >
            <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
          </TouchableOpacity>
          {/* Icon buttons */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setEditMilestone(item)}
            accessibilityLabel="Edit"
          >
            <Text style={styles.iconBtnText}>✎</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnDanger]}
            onPress={() => handleDelete(item)}
            accessibilityLabel="Delete"
          >
            <Text style={styles.iconBtnTextDanger}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>{milestones.length} milestone{milestones.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setFormVisible(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* List rendered with .map() — see ActivitiesTab for rationale. */}
      <View style={styles.listContent}>
        {milestones.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No milestones yet. Tap + Add to create one.</Text>
          </View>
        ) : (
          milestones.map((item) => (
            <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
          ))
        )}
      </View>

      <MilestoneFormModal
        visible={formVisible || !!editMilestone}
        projectId={projectId}
        editMilestone={editMilestone}
        onClose={handleCloseForm}
      />
    </View>
  );
}

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.blue[100], backgroundColor: '#FFFFFF',
  },
  title: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: '600', color: colors.ink.DEFAULT },
  cancel: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[500] },
  save: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: '600', color: colors.blue[600] },
  disabled: { opacity: 0.5 },
  errorBox: {
    margin: spacing.md, padding: spacing.md, backgroundColor: colors.red[50],
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.red[200],
  },
  errorText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.red[600] },
  field: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  label: {
    fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: '600',
    color: colors.gray[400], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1, borderColor: colors.blue[200], borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT, backgroundColor: '#FFFFFF',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray[300], backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: colors.blue[600], borderColor: colors.blue[600] },
  chipText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100], backgroundColor: '#FFFFFF',
  },
  tabTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.blue[600],
  },
  addBtnText: {
    fontFamily: fontFamily.sans, fontSize: 20, fontWeight: '400', color: '#FFFFFF', lineHeight: 22,
  },
  listContent: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.blue[100],
    padding: spacing.md, gap: spacing.sm,
  },
  cardBody: { flex: 1, gap: 3 },
  milestoneTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '500', color: colors.ink.DEFAULT },
  milestoneMeta: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.ink.light },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  statusText: { fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  iconBtnDanger: {
    backgroundColor: colors.red[50],
    borderColor: colors.red[200],
  },
  iconBtnText: { fontSize: 14 },
  iconBtnTextDanger: { fontSize: 14 },
  empty: { paddingVertical: spacing['3xl'], alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.gray[400], textAlign: 'center' },
});
