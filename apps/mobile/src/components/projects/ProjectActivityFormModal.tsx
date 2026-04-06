import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
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
import { canCreateActivityOnDate } from '@pm/domain';
import { useCreateProjectActivity } from '../../hooks/useProjects';
import { useContacts } from '../../hooks/useContacts';
import { DatePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';
import { todayISO } from '../../lib/dateUtils';

const PRIORITIES = [
  { label: 'None', value: null },
  { label: 'A',    value: 'A' },
  { label: 'B',    value: 'B' },
  { label: 'C',    value: 'C' },
];

const HOURS_CHIPS = [
  { label: '0.25h', value: 0.25 },
  { label: '0.5h',  value: 0.5 },
  { label: '1h',    value: 1 },
  { label: '2h',    value: 2 },
  { label: 'Custom', value: 0 },
];

// ---- Contact picker (nested modal) ----------------------------------------

interface ContactPickerProps {
  visible: boolean;
  contacts: { id: string; full_name: string }[];
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  onClose: () => void;
}

function ContactPickerModal({ visible, contacts, selectedId, onSelect, onClose }: ContactPickerProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => query.trim()
      ? contacts.filter((c) => c.full_name.toLowerCase().includes(query.toLowerCase()))
      : contacts,
    [contacts, query],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={cp.container}>
        <View style={cp.header}>
          <TouchableOpacity onPress={onClose}><Text style={cp.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={cp.title}>Select Contact</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={cp.searchBox}>
          <RNTextInput
            style={cp.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            placeholderTextColor={colors.gray[400]}
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[cp.row, item.id === selectedId && cp.rowSelected]}
              onPress={() => { onSelect(item.id, item.full_name); onClose(); }}
            >
              <Text style={[cp.rowText, item.id === selectedId && cp.rowTextSelected]}>
                {item.full_name}
              </Text>
              {item.id === selectedId && <Text style={cp.check}>✓</Text>}
            </TouchableOpacity>
          )}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </Modal>
  );
}

const cp = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.blue[100], backgroundColor: '#FFFFFF',
  },
  title: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: '600', color: colors.ink.DEFAULT },
  cancel: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[500] },
  searchBox: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#FFFFFF' },
  searchInput: {
    backgroundColor: colors.gray[50], borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  rowSelected: { backgroundColor: colors.blue[50] },
  rowText: { flex: 1, fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT },
  rowTextSelected: { color: colors.blue[700], fontWeight: '500' },
  check: { color: colors.blue[600], fontSize: 16 },
});

// ---- Main form modal -------------------------------------------------------

interface Props {
  visible: boolean;
  projectId: string;
  onClose: () => void;
}

export function ProjectActivityFormModal({ visible, projectId, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISO());
  const [sectionType, setSectionType] = useState<'work' | 'delegated'>('work');
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [hours, setHours] = useState(1);
  const [isCustom, setIsCustom] = useState(false);
  const [customHours, setCustomHours] = useState('');
  const [priority, setPriority] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);

  const createMutation = useCreateProjectActivity();
  const { data: contacts = [] } = useContacts();

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDate(todayISO());
    setSectionType('work');
    setContactId(null);
    setContactName('');
    setHours(1);
    setIsCustom(false);
    setCustomHours('');
    setPriority(null);
    setNote('');
    setError(null);
  }, [visible]);

  const effectiveHours = isCustom ? (parseFloat(customHours) || 1) : hours;

  const handleSave = () => {
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!canCreateActivityOnDate(date)) { setError('Cannot create activities in the past.'); return; }
    if (sectionType === 'delegated' && !contactId) { setError('Select a contact for delegation.'); return; }
    if (effectiveHours <= 0) { setError('Estimated time must be positive.'); return; }

    createMutation.mutate(
      {
        projectId,
        title: title.trim(),
        activity_date: date,
        section_type: sectionType,
        delegated_contact_id: sectionType === 'delegated' ? contactId : null,
        estimated_hours: effectiveHours,
        priority: priority,
        note: note.trim() || null,
      },
      {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      },
    );
  };

  return (
    <>
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
            <TouchableOpacity onPress={onClose} disabled={createMutation.isPending}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Activity</Text>
            <TouchableOpacity onPress={handleSave} disabled={createMutation.isPending}>
              <Text style={[styles.saveText, createMutation.isPending && styles.textDisabled]}>
                {createMutation.isPending ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Title */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Title *</Text>
              <RNTextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Draft proposal document"
                placeholderTextColor={colors.gray[400]}
                autoFocus
              />
            </View>

            {/* Type */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chipRow}>
                {(['work', 'delegated'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, sectionType === type && styles.chipActive]}
                    onPress={() => setSectionType(type)}
                  >
                    <Text style={[styles.chipText, sectionType === type && styles.chipTextActive]}>
                      {type === 'work' ? 'Work' : 'Delegated'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Contact picker (delegated only) */}
            {sectionType === 'delegated' && (
              <View style={styles.section}>
                <Text style={styles.fieldLabel}>Delegated To *</Text>
                <TouchableOpacity
                  style={styles.contactPicker}
                  onPress={() => setContactPickerVisible(true)}
                >
                  <Text style={[styles.contactPickerText, !contactName && styles.placeholder]}>
                    {contactName || 'Select a contact…'}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Date */}
            <View style={styles.section}>
              <DatePickerField
                label="Date"
                value={date}
                onChange={setDate}
                minimumDate={todayISO()}
              />
            </View>

            {/* Hours */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Estimated Time</Text>
              <View style={styles.chipRow}>
                {HOURS_CHIPS.map((chip) => {
                  const isSelected = chip.value === 0
                    ? isCustom
                    : !isCustom && hours === chip.value;
                  return (
                    <TouchableOpacity
                      key={chip.value}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => {
                        if (chip.value === 0) { setIsCustom(true); }
                        else { setIsCustom(false); setHours(chip.value); }
                      }}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {isCustom && (
                <View style={styles.customRow}>
                  <RNTextInput
                    style={styles.customInput}
                    value={customHours}
                    onChangeText={setCustomHours}
                    placeholder="Hours"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.customUnit}>hours</Text>
                </View>
              )}
            </View>

            {/* Priority */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Priority (optional)</Text>
              <View style={styles.chipRow}>
                {PRIORITIES.map((p) => {
                  const isSelected = priority === p.value;
                  return (
                    <TouchableOpacity
                      key={String(p.value)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setPriority(p.value)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
      </Modal>

      <ContactPickerModal
        visible={contactPickerVisible}
        contacts={contacts}
        selectedId={contactId}
        onSelect={(id, name) => { setContactId(id); setContactName(name); }}
        onClose={() => setContactPickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.blue[100], backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: '600', color: colors.ink.DEFAULT },
  cancelText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[500] },
  saveText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: '600', color: colors.blue[600] },
  textDisabled: { opacity: 0.5 },
  scroll: { flex: 1 },
  errorBox: {
    margin: spacing.md, padding: spacing.md,
    backgroundColor: colors.red[50], borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.red[200],
  },
  errorText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.red[600] },
  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  fieldLabel: {
    fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: '600',
    color: colors.gray[400], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1, borderColor: colors.blue[200], borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT, backgroundColor: '#FFFFFF',
  },
  multilineInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray[300], backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: colors.blue[600], borderColor: colors.blue[600] },
  chipText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  contactPicker: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.blue[200],
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: '#FFFFFF',
  },
  contactPickerText: { flex: 1, fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT },
  placeholder: { color: colors.gray[400] },
  chevron: { fontFamily: fontFamily.sans, fontSize: 20, color: colors.gray[400] },
  customRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  customInput: {
    width: 80, borderWidth: 1, borderColor: colors.blue[200], borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT,
    backgroundColor: '#FFFFFF', textAlign: 'center',
  },
  customUnit: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },
});
