import React, { useEffect, useState } from 'react';
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
import { isDateInAwayPeriod } from '@pm/domain';
import type { CalendarEvent, CalendarEventType, RecurrenceRule } from '@pm/types';
import type { YearEntry } from '@pm/types';
import {
  type CreateCalendarEventInput,
  type UpdateCalendarEventInput,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
} from '../../hooks/useCalendarEvents';
import { useContacts } from '../../hooks/useContacts';
import {
  DatePickerField,
  SelectPickerField,
  TextInput,
  TimePickerField,
} from '../ui';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';
import { todayISO } from '../../lib/dateUtils';

// ---- constants -------------------------------------------------------------

const EVENT_TYPES: { value: CalendarEventType; label: string }[] = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'other', label: 'Other' },
];

const RECURRENCE_OPTIONS: { value: RecurrenceRule; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DURATION_OPTIONS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
];

// ---- component -------------------------------------------------------------

interface Props {
  visible: boolean;
  initialDate?: string;
  editEvent?: CalendarEvent | null;
  yearEntries: YearEntry[];
  onClose: () => void;
}

export function CalendarEventFormModal({ visible, initialDate, editEvent, yearEntries, onClose }: Props) {
  const isEdit = !!editEvent;

  const [eventType, setEventType] = useState<CalendarEventType>('meeting');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [startTime, setStartTime] = useState('09:00');
  const [durationStr, setDurationStr] = useState('60');
  const [contactId, setContactId] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: contacts = [] } = useContacts();
  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();

  const mutation = isEdit ? updateMutation : createMutation;

  // Reset form when modal opens
  useEffect(() => {
    if (!visible) return;
    if (editEvent) {
      setEventType(editEvent.event_type as CalendarEventType);
      setTitle(editEvent.title);
      setDate(editEvent.date);
      setStartTime(
        editEvent.start_at
          ? new Date(editEvent.start_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          : '09:00',
      );
      setDurationStr(String(editEvent.duration_minutes ?? 60));
      setContactId(editEvent.linked_contact_id);
      setLocation(editEvent.location ?? '');
      setNotes(editEvent.notes ?? '');
      setRecurrence(editEvent.recurrence_rule);
    } else {
      setEventType('meeting');
      setTitle('');
      setDate(initialDate ?? todayISO());
      setStartTime('09:00');
      setDurationStr('60');
      setContactId(null);
      setLocation('');
      setNotes('');
      setRecurrence(null);
    }
    setError(null);
  }, [visible, editEvent, initialDate]);

  const hasTiming = eventType === 'meeting' || eventType === 'appointment';
  const isAway = isDateInAwayPeriod(date, yearEntries);
  const durationMinutes = parseInt(durationStr, 10) || 60;

  const contactOptions = contacts.map((c) => ({
    value: c.id,
    label: c.full_name,
  }));

  const handleSave = () => {
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (eventType === 'meeting' && !contactId) {
      setError('A contact is required for meetings.');
      return;
    }

    if (isEdit && editEvent) {
      const input: UpdateCalendarEventInput = {
        id: editEvent.id,
        title: title.trim(),
        date,
        ...(hasTiming && { start_time: startTime, duration_minutes: durationMinutes }),
        ...(eventType !== 'meeting' && { location: location.trim() || null }),
        notes: notes.trim() || null,
        recurrence_rule: recurrence,
        ...(eventType === 'meeting' && contactId && { linked_contact_id: contactId }),
      };
      (updateMutation.mutate as (input: UpdateCalendarEventInput, opts: any) => void)(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    } else {
      const input: CreateCalendarEventInput = {
        event_type: eventType,
        title: title.trim(),
        date,
        ...(hasTiming && { start_time: startTime, duration_minutes: durationMinutes }),
        ...(eventType === 'meeting' && contactId && { linked_contact_id: contactId }),
        ...(eventType !== 'meeting' && { location: location.trim() || null }),
        notes: notes.trim() || null,
        recurrence_rule: recurrence,
      };
      (createMutation.mutate as (input: CreateCalendarEventInput, opts: any) => void)(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    }
  };

  const isPending = mutation.isPending;

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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={isPending}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Event' : 'New Event'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isPending}>
            <Text style={[styles.saveText, isPending && styles.textDisabled]}>
              {isPending ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Away warning */}
          {isAway && (
            <View style={styles.awayWarning}>
              <Text style={styles.awayWarningText}>
                You have a travel/away entry on this date. Consider whether you want to schedule this event.
              </Text>
            </View>
          )}

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Type selector (create only) */}
          {!isEdit && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Event Type</Text>
              <View style={styles.typeRow}>
                {EVENT_TYPES.map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.typeBtn, eventType === value && styles.typeBtnActive]}
                    onPress={() => setEventType(value)}
                  >
                    <Text style={[styles.typeBtnText, eventType === value && styles.typeBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Title */}
          <View style={styles.section}>
            <TextInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder={eventType === 'meeting' ? 'e.g. Quarterly review' : 'e.g. Doctor appointment'}
            />
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

          {/* Start time + Duration (meeting / appointment) */}
          {hasTiming && (
            <View style={styles.section}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <TimePickerField
                    label="Start Time"
                    value={startTime}
                    onChange={setStartTime}
                  />
                </View>
                <View style={[styles.flex, { marginLeft: spacing.sm }]}>
                  <SelectPickerField
                    label="Duration"
                    value={durationStr}
                    options={DURATION_OPTIONS}
                    onSelect={setDurationStr}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Contact (meetings) */}
          {eventType === 'meeting' && (
            <View style={styles.section}>
              <SelectPickerField
                label="Contact"
                value={contactId ?? ''}
                options={[{ value: '', label: 'Select contact…' }, ...contactOptions]}
                onSelect={(v) => setContactId(v || null)}
              />
            </View>
          )}

          {/* Location (appointment / other) */}
          {eventType !== 'meeting' && (
            <View style={styles.section}>
              <TextInput
                label="Location (optional)"
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. St. Mary's Hospital"
              />
            </View>
          )}

          {/* Notes / Agenda */}
          <View style={styles.section}>
            <TextInput
              label={eventType === 'meeting' ? 'Agenda (optional)' : 'Notes (optional)'}
              value={notes}
              onChangeText={setNotes}
              placeholder={eventType === 'meeting' ? 'Topics to cover…' : 'Additional details…'}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Recurrence */}
          <View style={styles.section}>
            <SelectPickerField
              label="Recurrence"
              value={recurrence ?? ''}
              options={RECURRENCE_OPTIONS.map((r) => ({ value: r.value ?? '', label: r.label }))}
              onSelect={(v) => setRecurrence((v || null) as RecurrenceRule)}
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
  awayWarning: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.amber[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.amber[200],
  },
  awayWarningText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.amber[700],
    lineHeight: 18,
  },
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
  sectionLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: '#FFFFFF',
  },
  typeBtnActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  typeBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.ink.light,
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
  },
});
