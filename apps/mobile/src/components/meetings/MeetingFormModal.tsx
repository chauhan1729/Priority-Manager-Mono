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
import type { Meeting, MeetingRecurrenceRule } from '@pm/types';
import {
  type CreateMeetingInput,
  type UpdateMeetingInput,
  useCreateMeeting,
  useUpdateMeeting,
} from '../../hooks/useMeetings';
import { useContacts } from '../../hooks/useContacts';
import { DatePickerField, TimePickerField } from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';
import { todayISO } from '../../lib/dateUtils';

// ---- constants -------------------------------------------------------------

const DURATION_CHIPS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
  { label: 'Custom', value: 0 },
];

const RECURRENCE_OPTIONS: { label: string; value: MeetingRecurrenceRule }[] = [
  { label: 'None', value: null },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

// ---- Contact picker (inline search modal) ----------------------------------

interface ContactPickerModalProps {
  visible: boolean;
  contacts: { id: string; full_name: string }[];
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  onClose: () => void;
}

function ContactPickerModal({ visible, contacts, selectedId, onSelect, onClose }: ContactPickerModalProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      query.trim()
        ? contacts.filter((c) =>
            c.full_name.toLowerCase().includes(query.toLowerCase()),
          )
        : contacts,
    [contacts, query],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={cpStyles.container}>
        <View style={cpStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={cpStyles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={cpStyles.title}>Select Contact</Text>
          <View style={cpStyles.placeholder} />
        </View>
        <View style={cpStyles.searchBox}>
          <RNTextInput
            style={cpStyles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search contacts…"
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
              style={[cpStyles.contactRow, item.id === selectedId && cpStyles.contactRowSelected]}
              onPress={() => { onSelect(item.id, item.full_name); onClose(); }}
            >
              <Text style={[cpStyles.contactName, item.id === selectedId && cpStyles.contactNameSelected]}>
                {item.full_name}
              </Text>
              {item.id === selectedId && <Text style={cpStyles.checkmark}>✓</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={cpStyles.empty}>
              <Text style={cpStyles.emptyText}>No contacts found.</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </Modal>
  );
}

const cpStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
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
  title: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  cancel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[500],
  },
  placeholder: { width: 50 },
  searchBox: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  searchInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  contactRowSelected: { backgroundColor: colors.blue[50] },
  contactName: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  contactNameSelected: { color: colors.blue[700], fontWeight: '500' },
  checkmark: { color: colors.blue[600], fontSize: 16 },
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
  },
});

// ---- Main form modal -------------------------------------------------------

interface Props {
  visible: boolean;
  editMeeting?: Meeting | null;
  initialDate?: string;
  onClose: () => void;
}

export function MeetingFormModal({ visible, editMeeting, initialDate, onClose }: Props) {
  const isEdit = !!editMeeting;

  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customDuration, setCustomDuration] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [agenda, setAgenda] = useState('');
  const [recurrence, setRecurrence] = useState<MeetingRecurrenceRule>(null);
  const [error, setError] = useState<string | null>(null);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);

  const { data: contacts = [] } = useContacts();
  const createMutation = useCreateMeeting();
  const updateMutation = useUpdateMeeting();
  const mutation = isEdit ? updateMutation : createMutation;

  // Reset form when modal opens
  useEffect(() => {
    if (!visible) return;
    if (editMeeting) {
      setTitle(editMeeting.title);
      setContactId(editMeeting.linked_contact_id);
      // contactName resolved by contacts list
      setDate(editMeeting.date);
      // Extract local time from start_at
      setStartTime(
        new Date(editMeeting.start_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      );
      const dur = editMeeting.duration_minutes;
      const preset = DURATION_CHIPS.find((c) => c.value === dur && c.value !== 0);
      if (preset) {
        setDurationMinutes(dur);
        setIsCustom(false);
        setCustomDuration('');
      } else {
        setDurationMinutes(dur);
        setIsCustom(true);
        setCustomDuration(String(dur));
      }
      setAgenda(editMeeting.agenda ?? '');
      setRecurrence(editMeeting.recurrence_rule);
    } else {
      setTitle('');
      setContactId(null);
      setContactName('');
      setDate(initialDate ?? todayISO());
      setStartTime('09:00');
      setDurationMinutes(60);
      setIsCustom(false);
      setCustomDuration('');
      setAgenda('');
      setRecurrence(null);
    }
    setError(null);
  }, [visible, editMeeting, initialDate]);

  // Resolve contact name from contacts list
  useEffect(() => {
    if (contactId) {
      const c = contacts.find((x) => x.id === contactId);
      if (c) setContactName(c.full_name);
    }
  }, [contactId, contacts]);

  const effectiveDuration = isCustom ? (parseInt(customDuration, 10) || 60) : durationMinutes;

  const handleSave = () => {
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!contactId) { setError('A contact is required.'); return; }
    if (effectiveDuration <= 0) { setError('Duration must be positive.'); return; }

    if (isEdit && editMeeting) {
      const input: UpdateMeetingInput = {
        id: editMeeting.id,
        title: title.trim(),
        linked_contact_id: contactId,
        date,
        start_time: startTime,
        duration_minutes: effectiveDuration,
        agenda: agenda.trim() || null,
        recurrence_rule: recurrence ?? undefined,
      };
      (updateMutation.mutate as (i: UpdateMeetingInput, opts: any) => void)(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    } else {
      const input: CreateMeetingInput = {
        title: title.trim(),
        linked_contact_id: contactId,
        date,
        start_time: startTime,
        duration_minutes: effectiveDuration,
        agenda: agenda.trim() || null,
        recurrence_rule: recurrence ?? undefined,
      };
      (createMutation.mutate as (i: CreateMeetingInput, opts: any) => void)(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    }
  };

  const isPending = mutation.isPending;

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={isPending}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEdit ? 'Edit Meeting' : 'New Meeting'}</Text>
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

            {/* Title */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Title</Text>
              <RNTextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Quarterly review"
                placeholderTextColor={colors.gray[400]}
              />
            </View>

            {/* Contact picker */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Contact</Text>
              <TouchableOpacity
                style={styles.contactPicker}
                onPress={() => setContactPickerVisible(true)}
              >
                <Text
                  style={[styles.contactPickerText, !contactName && styles.contactPickerPlaceholder]}
                >
                  {contactName || 'Select a contact…'}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Date */}
            <View style={styles.section}>
              <DatePickerField
                label="Date"
                value={date}
                onChange={setDate}
                minimumDate={isEdit ? undefined : todayISO()}
              />
            </View>

            {/* Start time */}
            <View style={styles.section}>
              <TimePickerField label="Start Time" value={startTime} onChange={setStartTime} />
            </View>

            {/* Duration chips */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Duration</Text>
              <View style={styles.chipRow}>
                {DURATION_CHIPS.map((chip) => {
                  const isSelected =
                    chip.value === 0 ? isCustom : !isCustom && durationMinutes === chip.value;
                  return (
                    <TouchableOpacity
                      key={chip.value}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => {
                        if (chip.value === 0) {
                          setIsCustom(true);
                        } else {
                          setIsCustom(false);
                          setDurationMinutes(chip.value);
                        }
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
                <View style={styles.customDurationRow}>
                  <RNTextInput
                    style={styles.customDurationInput}
                    value={customDuration}
                    onChangeText={setCustomDuration}
                    placeholder="Minutes"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.customDurationUnit}>min</Text>
                </View>
              )}
            </View>

            {/* Agenda */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Agenda (optional)</Text>
              <RNTextInput
                style={[styles.input, styles.multilineInput]}
                value={agenda}
                onChangeText={setAgenda}
                placeholder="Topics to cover, goals for the meeting…"
                placeholderTextColor={colors.gray[400]}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Recurrence */}
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Recurrence</Text>
              <View style={styles.chipRow}>
                {RECURRENCE_OPTIONS.map((opt) => {
                  const isSelected = recurrence === opt.value;
                  return (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setRecurrence(opt.value)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Contact search (nested modal) */}
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
  contactPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  contactPickerText: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  contactPickerPlaceholder: { color: colors.gray[400] },
  chevron: {
    fontFamily: fontFamily.sans,
    fontSize: 20,
    color: colors.gray[400],
  },

  // Duration chips
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
  customDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  customDurationInput: {
    width: 80,
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
  },
  customDurationUnit: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
  },
});
