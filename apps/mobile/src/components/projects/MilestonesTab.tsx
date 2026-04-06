import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { MilestoneStatus, ProjectMilestone } from '@pm/types';
import {
  useCreateMilestone,
  useDeleteMilestone,
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

const STATUS_CYCLE: MilestoneStatus[] = ['pending', 'completed', 'missed'];

function nextStatus(current: MilestoneStatus): MilestoneStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]!;
}

// ---- Add milestone modal ---------------------------------------------------

interface AddModalProps {
  visible: boolean;
  projectId: string;
  onClose: () => void;
}

function AddMilestoneModal({ visible, projectId, onClose }: AddModalProps) {
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateMilestone();

  const handleSave = () => {
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    createMutation.mutate(
      { projectId, title: title.trim(), target_date: targetDate || null },
      {
        onSuccess: () => { setTitle(''); setTargetDate(''); onClose(); },
        onError: (e: Error) => setError(e.message),
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose}><Text style={modal.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={modal.title}>New Milestone</Text>
          <TouchableOpacity onPress={handleSave} disabled={createMutation.isPending}>
            <Text style={[modal.save, createMutation.isPending && modal.disabled]}>
              {createMutation.isPending ? 'Saving…' : 'Save'}
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
            autoFocus
          />
        </View>
        <View style={modal.field}>
          <DatePickerField label="Target Date (optional)" value={targetDate} onChange={setTargetDate} />
        </View>
      </View>
    </Modal>
  );
}

// ---- Main tab ---------------------------------------------------------------

interface Props {
  projectId: string;
  milestones: ProjectMilestone[];
}

export function MilestonesTab({ projectId, milestones }: Props) {
  const [addVisible, setAddVisible] = useState(false);
  const updateStatus = useUpdateMilestoneStatus();
  const deleteMilestone = useDeleteMilestone();

  const handleToggle = (milestone: ProjectMilestone) => {
    updateStatus.mutate({
      milestoneId: milestone.id,
      projectId,
      status: nextStatus(milestone.status),
    });
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
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: sc.bg }]}
            onPress={() => handleToggle(item)}
          >
            <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>{milestones.length} milestone{milestones.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={milestones}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No milestones yet. Tap + Add to create one.</Text>
          </View>
        }
      />

      <AddMilestoneModal
        visible={addVisible}
        projectId={projectId}
        onClose={() => setAddVisible(false)}
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
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100], backgroundColor: '#FFFFFF',
  },
  tabTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light },
  addBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.blue[600] },
  addBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '600', color: '#FFFFFF' },
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
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  statusText: { fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600' },
  deleteBtn: { padding: spacing.xs },
  deleteText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.red[400] },
  empty: { paddingVertical: spacing['3xl'], alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.gray[400], textAlign: 'center' },
});
