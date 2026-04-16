import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ProjectResource, ResourceStatus, ResourceType } from '@pm/types';
import {
  useCreateResource,
  useDeleteResource,
  useUpdateResource,
  useUpdateResourceStatus,
} from '../../hooks/useProjects';
import { DatePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RESOURCE_TYPES: { label: string; value: ResourceType }[] = [
  { label: 'Budget',       value: 'budget' },
  { label: 'Employee',     value: 'employee' },
  { label: 'Contractor',   value: 'contractor' },
  { label: 'New Hire',     value: 'new_hire' },
  { label: 'Tool/Software',value: 'tool_software' },
  { label: 'Equipment',    value: 'equipment' },
  { label: 'Other',        value: 'other' },
];

const RESOURCE_STATUSES: { label: string; value: ResourceStatus }[] = [
  { label: 'Needed',    value: 'needed' },
  { label: 'Requested', value: 'requested' },
  { label: 'Approved',  value: 'approved' },
  { label: 'Acquired',  value: 'acquired' },
  { label: 'Delayed',   value: 'delayed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_STYLE: Record<ResourceStatus, { bg: string; text: string }> = {
  needed:    { bg: colors.gray[100],   text: colors.gray[600] },
  requested: { bg: colors.blue[100],   text: colors.blue[700] },
  approved:  { bg: colors.green[100],  text: colors.green[700] },
  acquired:  { bg: colors.green[100],  text: colors.green[700] },
  delayed:   { bg: colors.amber[100],  text: colors.amber[700] },
  cancelled: { bg: colors.red[100],    text: colors.red[600] },
};

// ---------------------------------------------------------------------------
// Form modal (create + edit)
// ---------------------------------------------------------------------------

interface FormModalProps {
  visible: boolean;
  projectId: string;
  editResource?: ProjectResource | null;
  onClose: () => void;
}

function ResourceFormModal({ visible, projectId, editResource, onClose }: FormModalProps) {
  const isEdit = !!editResource;

  const [title, setTitle] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('budget');
  const [status, setStatus] = useState<ResourceStatus>('needed');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [neededByDate, setNeededByDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateResource();
  const updateMutation = useUpdateResource();
  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending;

  useEffect(() => {
    if (!visible) return;
    if (editResource) {
      setTitle(editResource.title);
      setResourceType(editResource.resource_type);
      setStatus(editResource.status);
      setCost(editResource.estimated_cost != null ? String(editResource.estimated_cost) : '');
      setNote(editResource.note ?? '');
      setNeededByDate(editResource.needed_by_date ?? '');
    } else {
      setTitle('');
      setResourceType('budget');
      setStatus('needed');
      setCost('');
      setNote('');
      setNeededByDate('');
    }
    setError(null);
  }, [visible, editResource]);

  const handleSave = () => {
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }

    if (isEdit && editResource) {
      updateMutation.mutate(
        {
          resourceId: editResource.id,
          projectId,
          resource_type: resourceType,
          title: title.trim(),
          note: note.trim() || null,
          estimated_cost: cost ? parseFloat(cost) : null,
          status,
          needed_by_date: neededByDate || null,
        },
        { onSuccess: onClose, onError: (e: Error) => setError(e.message) },
      );
      return;
    }

    createMutation.mutate(
      {
        projectId,
        resource_type: resourceType,
        title: title.trim(),
        note: note.trim() || null,
        estimated_cost: cost ? parseFloat(cost) : null,
        status,
        needed_by_date: neededByDate || null,
      },
      {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose}><Text style={modal.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={modal.title}>{isEdit ? 'Edit Resource' : 'New Resource'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isPending}>
            <Text style={[modal.save, isPending && modal.disabled]}>
              {isPending ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          {error && (
            <View style={modal.errorBox}><Text style={modal.errorText}>{error}</Text></View>
          )}
          <View style={modal.field}>
            <Text style={modal.label}>Title *</Text>
            <RNTextInput
              style={modal.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Cloud storage license"
              placeholderTextColor={colors.gray[400]}
              autoFocus={!isEdit}
            />
          </View>
          <View style={modal.field}>
            <Text style={modal.label}>Type</Text>
            <View style={modal.chipRow}>
              {RESOURCE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[modal.chip, resourceType === t.value && modal.chipActive]}
                  onPress={() => setResourceType(t.value)}
                >
                  <Text style={[modal.chipText, resourceType === t.value && modal.chipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={modal.field}>
            <Text style={modal.label}>Status</Text>
            <View style={modal.chipRow}>
              {RESOURCE_STATUSES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[modal.chip, status === s.value && modal.chipActive]}
                  onPress={() => setStatus(s.value)}
                >
                  <Text style={[modal.chipText, status === s.value && modal.chipTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={modal.field}>
            <Text style={modal.label}>Estimated Cost (optional)</Text>
            <RNTextInput
              style={modal.input}
              value={cost}
              onChangeText={setCost}
              placeholder="0.00"
              placeholderTextColor={colors.gray[400]}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={modal.field}>
            <DatePickerField
              label="Needed By (optional)"
              value={neededByDate && /^\d{4}-\d{2}-\d{2}$/.test(neededByDate)
                ? new Date(`${neededByDate}T12:00:00`)
                : null}
              onChange={(d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setNeededByDate(`${y}-${m}-${day}`);
              }}
            />
          </View>
          <View style={modal.field}>
            <Text style={modal.label}>Note (optional)</Text>
            <RNTextInput
              style={[modal.input, modal.multilineInput]}
              value={note}
              onChangeText={setNote}
              placeholder="Any context…"
              placeholderTextColor={colors.gray[400]}
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

interface Props {
  projectId: string;
  resources: ProjectResource[];
}

export function ResourcesTab({ projectId, resources }: Props) {
  const [formVisible, setFormVisible] = useState(false);
  const [editResource, setEditResource] = useState<ProjectResource | null>(null);
  const [statusPickerFor, setStatusPickerFor] = useState<string | null>(null);
  const updateStatus = useUpdateResourceStatus();
  const deleteResource = useDeleteResource();

  const budgetTotal = resources.reduce(
    (sum, r) => (r.estimated_cost != null ? sum + r.estimated_cost : sum),
    0,
  );
  const budgetLabel =
    budgetTotal > 0
      ? ` · Budget: ${budgetTotal.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`
      : '';

  const handleStatusSelect = (resource: ProjectResource, status: ResourceStatus) => {
    updateStatus.mutate({ resourceId: resource.id, projectId, status });
    setStatusPickerFor(null);
  };

  const handleDelete = (resource: ProjectResource) => {
    Alert.alert('Delete Resource', `Delete "${resource.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteResource.mutate({ resourceId: resource.id, projectId }),
      },
    ]);
  };

  const renderItem = ({ item }: { item: ProjectResource }) => {
    const sc = STATUS_STYLE[item.status] ?? STATUS_STYLE.needed;
    const typeLabel = RESOURCE_TYPES.find((t) => t.value === item.resource_type)?.label ?? item.resource_type;
    const dateLabel = item.needed_by_date
      ? new Date(item.needed_by_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardBody}>
            <Text style={styles.resourceTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.resourceMeta}>
              {typeLabel}
              {item.estimated_cost != null ? ` · $${item.estimated_cost.toFixed(2)}` : ''}
              {dateLabel ? ` · By ${dateLabel}` : ''}
            </Text>
            {item.note ? <Text style={styles.resourceNote} numberOfLines={1}>{item.note}</Text> : null}
          </View>
          <View style={styles.cardRight}>
            {/* Tappable status chip — opens inline picker */}
            <TouchableOpacity
              style={[styles.statusBadge, { backgroundColor: sc.bg }]}
              onPress={() => setStatusPickerFor(statusPickerFor === item.id ? null : item.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusText, { color: sc.text }]}>
                {RESOURCE_STATUSES.find((s) => s.value === item.status)?.label ?? item.status}
              </Text>
            </TouchableOpacity>
            {/* Icon buttons */}
            <View style={styles.iconRow}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setEditResource(item)}
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
        </View>
        {/* Inline status picker */}
        {statusPickerFor === item.id && (
          <View style={styles.statusPicker}>
            {RESOURCE_STATUSES.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.statusOption, item.status === s.value && styles.statusOptionActive]}
                onPress={() => handleStatusSelect(item, s.value)}
              >
                <Text style={[styles.statusOptionText, item.status === s.value && styles.statusOptionTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>
          {resources.length} resource{resources.length !== 1 ? 's' : ''}
          {budgetLabel}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setFormVisible(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={resources}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No resources yet. Tap + Add to create one.</Text>
          </View>
        }
      />

      <ResourceFormModal
        visible={formVisible || !!editResource}
        projectId={projectId}
        editResource={editResource}
        onClose={() => {
          setFormVisible(false);
          setEditResource(null);
        }}
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
  multilineInput: { minHeight: 64, textAlignVertical: 'top', paddingTop: spacing.sm },
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
    backgroundColor: '#FFFFFF', marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.blue[100], overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, gap: spacing.sm },
  cardBody: { flex: 1, gap: 3 },
  resourceTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '500', color: colors.ink.DEFAULT },
  resourceMeta: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.ink.light },
  resourceNote: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.gray[400], fontStyle: 'italic' },
  cardRight: { alignItems: 'flex-end', gap: spacing.xs },
  iconRow: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: {
    width: 32, height: 32, borderRadius: borderRadius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gray[50], borderWidth: 1, borderColor: colors.gray[200],
  },
  iconBtnDanger: { backgroundColor: colors.red[50], borderColor: colors.red[200] },
  iconBtnText: { fontSize: 14 },
  iconBtnTextDanger: { fontSize: 14 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  statusText: { fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600' },
  deleteBtn: { padding: spacing.xs },
  deleteText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.red[400] },
  statusPicker: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray[100], backgroundColor: colors.gray[50],
  },
  statusOption: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray[200],
  },
  statusOptionActive: { backgroundColor: colors.blue[600], borderColor: colors.blue[600] },
  statusOptionText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.ink.light },
  statusOptionTextActive: { color: '#FFFFFF', fontWeight: '600' },
  empty: { paddingVertical: spacing['3xl'], alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.gray[400], textAlign: 'center' },
});
