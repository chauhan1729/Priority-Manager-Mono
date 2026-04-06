import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { CalendarEvent } from '@pm/types';
import {
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '../../hooks/useCalendarEvents';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---- types ----------------------------------------------------------------

interface Contact {
  id: string;
  full_name: string;
}

export interface EventDetailSheetProps {
  event: CalendarEvent | null;
  contactMap: Map<string, string>;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
}

// ---- helpers ---------------------------------------------------------------

const TYPE_LABEL: Record<string, string> = {
  meeting: 'Meeting',
  appointment: 'Appointment',
  birthday: 'Birthday',
  renewal: 'Renewal',
  other: 'Other',
};

const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  meeting: { bg: colors.blue[100], text: colors.blue[700] },
  appointment: { bg: colors.green[50], text: colors.green[700] },
  birthday: { bg: '#FCE7F3', text: '#9D174D' },
  renewal: { bg: colors.amber[50], text: colors.amber[700] },
  other: { bg: colors.gray[100], text: colors.gray[600] },
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  upcoming: { bg: colors.blue[50], text: colors.blue[600] },
  completed: { bg: colors.green[50], text: colors.green[700] },
  cancelled: { bg: colors.gray[100], text: colors.gray[500] },
  missed: { bg: colors.red[50], text: colors.red[600] },
};

function formatEventTime(event: CalendarEvent): string {
  if (!event.start_at) return event.date;
  const start = new Date(event.start_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (!event.end_at) return start;
  const end = new Date(event.end_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${start} – ${end}`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---- component -------------------------------------------------------------

export function EventDetailSheet({ event, contactMap, onClose, onEdit }: EventDetailSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '80%'], []);

  const deleteMutation = useDeleteCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();

  // Open/close sheet when event changes
  useEffect(() => {
    if (event) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [event]);

  const handleClose = useCallback(() => {
    sheetRef.current?.close();
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    if (!event) return;
    Alert.alert(
      'Delete Event',
      `Delete "${event.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(
              { eventId: event.id, eventType: event.event_type, linkedMeetingId: event.linked_meeting_id },
              { onSuccess: handleClose },
            );
          },
        },
      ],
    );
  }, [event, deleteMutation, handleClose]);

  const handleStatusChange = useCallback(
    (status: 'completed' | 'cancelled' | 'missed') => {
      if (!event) return;
      updateMutation.mutate({ id: event.id, status });
    },
    [event, updateMutation],
  );

  if (!event) return null;

  const typeStyle = TYPE_COLOR[event.event_type] ?? TYPE_COLOR.other;
  const statusStyle = STATUS_COLOR[event.status] ?? STATUS_COLOR.upcoming;
  const contactName = event.linked_contact_id ? contactMap.get(event.linked_contact_id) : null;
  const isMeeting = event.event_type === 'meeting';
  const isPastOrDone = event.status === 'completed' || event.status === 'cancelled' || event.status === 'missed';

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      onClose={onClose}
      enablePanDownToClose
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
            <Text style={[styles.typeBadgeText, { color: typeStyle.text }]}>
              {TYPE_LABEL[event.event_type] ?? event.event_type}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {event.status}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* Date & time */}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{formatDate(event.date)}</Text>
        </View>
        {event.start_at && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Time</Text>
            <Text style={styles.metaValue}>{formatEventTime(event)}</Text>
          </View>
        )}
        {event.duration_minutes && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Duration</Text>
            <Text style={styles.metaValue}>{event.duration_minutes} min</Text>
          </View>
        )}
        {contactName && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Contact</Text>
            <Text style={styles.metaValue}>{contactName}</Text>
          </View>
        )}
        {event.location && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Location</Text>
            <Text style={styles.metaValue}>{event.location}</Text>
          </View>
        )}
        {event.recurrence_rule && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Recurs</Text>
            <Text style={styles.metaValue}>{event.recurrence_rule}</Text>
          </View>
        )}

        {/* Notes / Agenda */}
        {event.notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>{isMeeting ? 'Agenda' : 'Notes'}</Text>
            <Text style={styles.notesText}>{event.notes}</Text>
          </View>
        ) : null}

        {/* Status quick-actions (future events) */}
        {!isPastOrDone && (
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: colors.green[50] }]}
              onPress={() => handleStatusChange('completed')}
            >
              <Text style={[styles.statusBtnText, { color: colors.green[700] }]}>Mark Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: colors.red[50] }]}
              onPress={() => handleStatusChange('missed')}
            >
              <Text style={[styles.statusBtnText, { color: colors.red[600] }]}>Mark Missed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: colors.gray[100] }]}
              onPress={() => handleStatusChange('cancelled')}
            >
              <Text style={[styles.statusBtnText, { color: colors.gray[600] }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {/* Only allow edit for non-birthday/renewal and non-cancelled/completed */}
          {event.event_type !== 'birthday' && event.event_type !== 'renewal' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn]}
              onPress={() => onEdit(event)}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Text style={styles.deleteBtnText}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Text>
          </TouchableOpacity>
        </View>

        {deleteMutation.isError && (
          <Text style={styles.errorText}>{(deleteMutation.error as Error).message}</Text>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    backgroundColor: colors.gray[300],
    width: 40,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  typeBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  title: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  metaLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
    width: 72,
  },
  metaValue: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  notesBlock: {
    marginTop: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  notesLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray[400],
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
  },
  statusBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  statusBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  editBtn: {
    backgroundColor: colors.blue[600],
  },
  editBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteBtn: {
    backgroundColor: colors.red[50],
    borderWidth: 1,
    borderColor: colors.red[200],
  },
  deleteBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.red[600],
  },
  errorText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.red[500],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
