import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import type { Contact, Expense, ExpenseCategory, Project } from '@pm/types';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCE_LABELS,
  EXPENSE_RECURRENCE_RULES,
  isValidExpenseAmount,
  isValidExpenseCategory,
} from '@pm/domain';
import {
  type CreateExpenseData,
  type UpdateExpenseData,
  useCreateExpense,
  useUpdateExpense,
} from '../../hooks/useExpenses';
import { DatePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  editExpense: Expense | null;
  initialMonthKey: string;
  projects: Project[];
  contacts: Contact[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpenseFormModal({
  visible,
  editExpense,
  initialMonthKey,
  projects,
  contacts,
  onClose,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = `${initialMonthKey}-01`;

  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [category, setCategory] = useState<ExpenseCategory>('personal');
  const [merchant, setMerchant] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [linkedContactId, setLinkedContactId] = useState<string | null>(null);
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [projectOpen, setProjectOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();

  // Populate from editExpense
  useEffect(() => {
    if (visible) {
      if (editExpense) {
        setTitle(editExpense.title);
        setAmountText(String(editExpense.amount));
        setDate(editExpense.expense_date);
        setCategory(editExpense.category);
        setMerchant(editExpense.merchant_payee ?? '');
        setPaymentMethod(editExpense.payment_method ?? '');
        setLinkedProjectId(editExpense.linked_project_id);
        setLinkedContactId(editExpense.linked_contact_id);
        setRecurrenceRule(editExpense.recurrence_rule);
        setNote(editExpense.note ?? '');
      } else {
        setTitle('');
        setAmountText('');
        setDate(defaultDate <= today ? today : defaultDate);
        setCategory('personal');
        setMerchant('');
        setPaymentMethod('');
        setLinkedProjectId(null);
        setLinkedContactId(null);
        setRecurrenceRule(null);
        setNote('');
      }
      setProjectOpen(false);
      setContactOpen(false);
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editExpense?.id]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Validation', 'Title is required.');
      return;
    }
    const amount = parseFloat(amountText);
    if (!isValidExpenseAmount(amount)) {
      Alert.alert('Validation', 'Enter a valid non-negative amount.');
      return;
    }
    if (!isValidExpenseCategory(category)) {
      Alert.alert('Validation', 'Select a valid category.');
      return;
    }

    setSaving(true);
    try {
      if (editExpense) {
        const data: UpdateExpenseData = {
          title: trimmedTitle,
          amount,
          expense_date: date,
          category,
          merchant_payee: merchant.trim() || null,
          payment_method: paymentMethod.trim() || null,
          linked_project_id: linkedProjectId,
          linked_contact_id: linkedContactId,
          recurrence_rule: recurrenceRule,
          note: note.trim() || null,
        };
        await new Promise<void>((resolve, reject) =>
          updateMutation.mutate(
            { id: editExpense.id, data },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          ),
        );
      } else {
        const data: CreateExpenseData = {
          title: trimmedTitle,
          amount,
          expense_date: date,
          category,
          merchant_payee: merchant.trim() || null,
          payment_method: paymentMethod.trim() || null,
          linked_project_id: linkedProjectId,
          linked_contact_id: linkedContactId,
          recurrence_rule: recurrenceRule,
          note: note.trim() || null,
        };
        await new Promise<void>((resolve, reject) =>
          createMutation.mutate(data, {
            onSuccess: () => resolve(),
            onError: (e) => reject(e),
          }),
        );
      }
      onClose();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === linkedProjectId);
  const selectedContact = contacts.find((c) => c.id === linkedContactId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {editExpense ? 'Edit Expense' : 'Add Expense'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Title</Text>
            <RNTextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Netflix subscription"
              placeholderTextColor={colors.gray[400]}
              returnKeyType="next"
            />
          </View>

          {/* Amount */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Amount ($)</Text>
            <RNTextInput
              style={styles.input}
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor={colors.gray[400]}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date</Text>
            <DatePickerField value={date} onChange={setDate} />
          </View>

          {/* Category */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipGrid}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Merchant */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Merchant / Payee</Text>
            <RNTextInput
              style={styles.input}
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Optional"
              placeholderTextColor={colors.gray[400]}
            />
          </View>

          {/* Payment method */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Payment Method</Text>
            <RNTextInput
              style={styles.input}
              value={paymentMethod}
              onChangeText={setPaymentMethod}
              placeholder="e.g. Credit Card"
              placeholderTextColor={colors.gray[400]}
            />
          </View>

          {/* Recurrence */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Recurrence</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, recurrenceRule === null && styles.chipActive]}
                onPress={() => setRecurrenceRule(null)}
              >
                <Text style={[styles.chipText, recurrenceRule === null && styles.chipTextActive]}>
                  None
                </Text>
              </TouchableOpacity>
              {EXPENSE_RECURRENCE_RULES.map((rule) => (
                <TouchableOpacity
                  key={rule}
                  style={[styles.chip, recurrenceRule === rule && styles.chipActive]}
                  onPress={() => setRecurrenceRule(rule)}
                >
                  <Text style={[styles.chipText, recurrenceRule === rule && styles.chipTextActive]}>
                    {EXPENSE_RECURRENCE_LABELS[rule]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Linked Project */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Linked Project</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => { setProjectOpen((o) => !o); setContactOpen(false); }}
            >
              <Text style={selectedProject ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                {selectedProject ? selectedProject.name : 'Select a project…'}
              </Text>
              <Text style={styles.pickerChevron}>{projectOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {projectOpen && (
              <View style={styles.pickerList}>
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => { setLinkedProjectId(null); setProjectOpen(false); }}
                >
                  <Text style={styles.pickerItemNone}>None</Text>
                </TouchableOpacity>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.pickerItem, linkedProjectId === p.id && styles.pickerItemActive]}
                    onPress={() => { setLinkedProjectId(p.id); setProjectOpen(false); }}
                  >
                    <Text style={[styles.pickerItemText, linkedProjectId === p.id && styles.pickerItemTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Linked Contact */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Linked Contact</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => { setContactOpen((o) => !o); setProjectOpen(false); }}
            >
              <Text style={selectedContact ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                {selectedContact ? selectedContact.full_name : 'Select a contact…'}
              </Text>
              <Text style={styles.pickerChevron}>{contactOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {contactOpen && (
              <View style={styles.pickerList}>
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => { setLinkedContactId(null); setContactOpen(false); }}
                >
                  <Text style={styles.pickerItemNone}>None</Text>
                </TouchableOpacity>
                {contacts.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.pickerItem, linkedContactId === c.id && styles.pickerItemActive]}
                    onPress={() => { setLinkedContactId(c.id); setContactOpen(false); }}
                  >
                    <Text style={[styles.pickerItemText, linkedContactId === c.id && styles.pickerItemTextActive]}>
                      {c.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Note */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Note</Text>
            <RNTextInput
              style={[styles.input, styles.textarea]}
              value={note}
              onChangeText={setNote}
              placeholder="Optional note…"
              placeholderTextColor={colors.gray[400]}
              multiline
              numberOfLines={3}
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
  root: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: { minWidth: 60 },
  cancelBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[500],
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
    textAlign: 'center',
  },
  saveBtn: {
    minWidth: 60,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.blue[600],
  },
  saveBtnDisabled: { backgroundColor: colors.blue[300] },
  saveBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  fieldGroup: { gap: spacing.xs },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.ink.light,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textarea: { minHeight: 80, paddingTop: spacing.sm },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: colors.blue[600],
    backgroundColor: colors.blue[50],
  },
  chipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[600],
  },
  chipTextActive: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.blue[700],
    fontWeight: '600',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pickerBtnText: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  pickerBtnPlaceholder: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
  },
  pickerChevron: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.gray[400],
  },
  pickerList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[50],
  },
  pickerItemActive: { backgroundColor: colors.blue[50] },
  pickerItemNone: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
    fontStyle: 'italic',
  },
  pickerItemText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  pickerItemTextActive: {
    color: colors.blue[700],
    fontWeight: '600',
  },
});
