import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import type { CalendarEvent, Meeting, YearEntry } from '@pm/types';
import {
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '../../hooks/useCalendarEvents';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---- types ----------------------------------------------------------------

export type DetailItem =
  | { kind: 'calendar_event'; data: CalendarEvent }
  | { kind: 'orphan_meeting'; data: Meeting }
  | { kind: 'birthday'; data: YearEntry }
  | { kind: 'away'; data: YearEntry; spansFrom: string; spansTo: string };

export interface EventDetailSheetProps {
  item: DetailItem | null;
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
  travel: 'Travel',
  away: 'Away',
};

const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  meeting:     { bg: colors.blue[100],  text: colors.blue[700] },
  appointment: { bg: colors.green[50],  text: colors.green[700] },
  birthday:    { bg: '#FCE7F3',         text: '#9D174D' },
  renewal:     { bg: colors.amber[50],  text: colors.amber[700] },
  other:       { bg: colors.gray[100],  text: colors.gray[600] },
  travel:      { bg: colors.purple[50], text: colors.purple[700] },
  away:        { bg: colors.purple[50], text: colors.purple[700] },
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  upcoming:  { bg: colors.blue[50],  text: colors.blue[600] },
  completed: { bg: colors.green[50], text: colors.green[700] },
  cancelled: { bg: colors.gray[100], text: colors.gray[500] },
  missed:    { bg: colors.red[50],   text: colors.red[600] },
};

const FALLBACK_STYLE = { bg: colors.gray[100], text: colors.gray[600] };

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

export function EventDetailSheet({ item, contactMap, onClose, onEdit }: EventDetailSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '80%'], []);

  const deleteMutation = useDeleteCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();

  // Open/close sheet when item changes
  useEffect(() => {
    if (item) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [item]);

  const handleClose = useCallback(() => {
    sheetRef.current?.close();
    onClose();
  }, [onClose]);

  const handleDeleteCalendarEvent = useCallback(
    (event: CalendarEvent) => {
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
                { eventId: event.id },
                { onSuccess: handleClose },
              );
            },
          },
        ],
      );
    },
    [deleteMutation, handleClose],
  );

  const handleStatusChange = useCallback(
    (event: CalendarEvent, status: 'completed' | 'cancelled' | 'missed') => {
      updateMutation.mutate({ id: event.id, status });
    },
    [updateMutation],
  );

  const handleOpenMeetingPlanner = useCallback(() => {
    handleClose();
    router.push('/meeting-planner');
  }, [handleClose]);

  const handleOpenYearAtAGlance = useCallback(() => {
    handleClose();
    router.push('/year-at-a-glance');
  }, [handleClose]);

  if (!item) return null;

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
        {item.kind === 'calendar_event' ? (
          <CalendarEventBody
            event={item.data}
            contactMap={contactMap}
            onEdit={onEdit}
            onDelete={handleDeleteCalendarEvent}
            onStatusChange={handleStatusChange}
            onOpenMeetingPlanner={handleOpenMeetingPlanner}
            deletePending={deleteMutation.isPending}
            deleteError={deleteMutation.isError ? (deleteMutation.error as Error).message : null}
          />
        ) : item.kind === 'orphan_meeting' ? (
          <OrphanMeetingBody
            meeting={item.data}
            contactMap={contactMap}
            onOpenMeetingPlanner={handleOpenMeetingPlanner}
          />
        ) : item.kind === 'birthday' ? (
          <BirthdayBody entry={item.data} onOpenYaaG={handleOpenYearAtAGlance} />
        ) : (
          <AwayBody
            entry={item.data}
            spansFrom={item.spansFrom}
            spansTo={item.spansTo}
            onOpenYaaG={handleOpenYearAtAGlance}
          />
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ---- Calendar event body ---------------------------------------------------

interface CalendarEventBodyProps {
  event: CalendarEvent;
  contactMap: Map<string, string>;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onStatusChange: (event: CalendarEvent, status: 'completed' | 'cancelled' | 'missed') => void;
  onOpenMeetingPlanner: () => void;
  deletePending: boolean;
  deleteError: string | null;
}

function CalendarEventBody({
  event,
  contactMap,
  onEdit,
  onDelete,
  onStatusChange,
  onOpenMeetingPlanner,
  deletePending,
  deleteError,
}: CalendarEventBodyProps) {
  const typeStyle = TYPE_COLOR[event.event_type] ?? FALLBACK_STYLE;
  const statusStyle = STATUS_COLOR[event.status] ?? FALLBACK_STYLE;
  const contactName = event.linked_contact_id ? contactMap.get(event.linked_contact_id) : null;
  const isMeeting = event.event_type === 'meeting';
  const isPastOrDone =
    event.status === 'completed' || event.status === 'cancelled' || event.status === 'missed';

  return (
    <>
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

      {/* Metadata rows */}
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
            onPress={() => onStatusChange(event, 'completed')}
          >
            <Text style={[styles.statusBtnText, { color: colors.green[700] }]}>Mark Done</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusBtn, { backgroundColor: colors.red[50] }]}
            onPress={() => onStatusChange(event, 'missed')}
          >
            <Text style={[styles.statusBtnText, { color: colors.red[600] }]}>Mark Missed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusBtn, { backgroundColor: colors.gray[100] }]}
            onPress={() => onStatusChange(event, 'cancelled')}
          >
            <Text style={[styles.statusBtnText, { color: colors.gray[600] }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* "Open in Meeting Planner" for meeting events */}
      {isMeeting && event.linked_meeting_id && (
        <TouchableOpacity style={styles.openPlannerBtn} onPress={onOpenMeetingPlanner}>
          <Text style={styles.openPlannerBtnText}>Open in Meeting Planner →</Text>
        </TouchableOpacity>
      )}

      {/* Action buttons */}
      <View style={styles.actionRow}>
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
          onPress={() => onDelete(event)}
          disabled={deletePending}
        >
          <Text style={styles.deleteBtnText}>
            {deletePending ? 'Deleting…' : 'Delete'}
          </Text>
        </TouchableOpacity>
      </View>

      {deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
    </>
  );
}

// ---- Orphan meeting body ---------------------------------------------------

function OrphanMeetingBody({
  meeting,
  contactMap,
  onOpenMeetingPlanner,
}: {
  meeting: Meeting;
  contactMap: Map<string, string>;
  onOpenMeetingPlanner: () => void;
}) {
  const typeStyle = TYPE_COLOR.meeting!;
  const statusStyle = STATUS_COLOR[meeting.status] ?? FALLBACK_STYLE;
  const contactName = contactMap.get(meeting.linked_contact_id) ?? null;
  const start = new Date(meeting.start_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const end = new Date(meeting.end_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <View style={styles.headerRow}>
        <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
          <Text style={[styles.typeBadgeText, { color: typeStyle.text }]}>Meeting</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
            {meeting.status}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{meeting.title}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Date</Text>
        <Text style={styles.metaValue}>{formatDate(meeting.date)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Time</Text>
        <Text style={styles.metaValue}>{start} – {end}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Duration</Text>
        <Text style={styles.metaValue}>{meeting.duration_minutes} min</Text>
      </View>
      {contactName && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Contact</Text>
          <Text style={styles.metaValue}>{contactName}</Text>
        </View>
      )}
      {meeting.recurrence_rule && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Recurs</Text>
          <Text style={styles.metaValue}>{meeting.recurrence_rule}</Text>
        </View>
      )}

      {meeting.agenda ? (
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>Agenda</Text>
          <Text style={styles.notesText}>{meeting.agenda}</Text>
        </View>
      ) : null}

      {meeting.key_takeaways ? (
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>Key Takeaways</Text>
          <Text style={styles.notesText}>{meeting.key_takeaways}</Text>
        </View>
      ) : null}

      <Text style={styles.yaaGHint}>
        This meeting is managed in Meeting Planner.
      </Text>

      <TouchableOpacity style={styles.openPlannerBtn} onPress={onOpenMeetingPlanner}>
        <Text style={styles.openPlannerBtnText}>Open in Meeting Planner →</Text>
      </TouchableOpacity>
    </>
  );
}

// ---- Birthday body ---------------------------------------------------------

function BirthdayBody({ entry, onOpenYaaG }: { entry: YearEntry; onOpenYaaG: () => void }) {
  const typeStyle = TYPE_COLOR.birthday!;
  const [, mm, dd] = entry.start_date.split('-');
  const monthName = new Date(2000, Number(mm) - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
  });
  const dayNum = Number(dd);

  return (
    <>
      <View style={styles.headerRow}>
        <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
          <Text style={[styles.typeBadgeText, { color: typeStyle.text }]}>🎂 Birthday</Text>
        </View>
      </View>

      <Text style={styles.title}>{entry.title}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>When</Text>
        <Text style={styles.metaValue}>
          Every {monthName} {dayNum}
        </Text>
      </View>

      {entry.location ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Location</Text>
          <Text style={styles.metaValue}>{entry.location}</Text>
        </View>
      ) : null}

      {entry.note ? (
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{entry.note}</Text>
        </View>
      ) : null}

      <Text style={styles.yaaGHint}>
        Birthdays are managed in Year at a Glance.
      </Text>

      <TouchableOpacity style={styles.yaaGBtn} onPress={onOpenYaaG}>
        <Text style={styles.yaaGBtnText}>Edit in Year at a Glance →</Text>
      </TouchableOpacity>
    </>
  );
}

// ---- Away/Travel body ------------------------------------------------------

function AwayBody({
  entry,
  spansFrom,
  spansTo,
  onOpenYaaG,
}: {
  entry: YearEntry;
  spansFrom: string;
  spansTo: string;
  onOpenYaaG: () => void;
}) {
  const typeStyle = TYPE_COLOR[entry.type] ?? FALLBACK_STYLE;
  const typeLabel = TYPE_LABEL[entry.type] ?? entry.type;
  const isMultiDay = spansFrom !== spansTo;

  return (
    <>
      <View style={styles.headerRow}>
        <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
          <Text style={[styles.typeBadgeText, { color: typeStyle.text }]}>
            ✈ {typeLabel}
          </Text>
        </View>
        {entry.availability_status && (
          <View style={[styles.statusBadge, { backgroundColor: colors.gray[100] }]}>
            <Text style={[styles.statusBadgeText, { color: colors.gray[700] }]}>
              {entry.availability_status}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{entry.title}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>When</Text>
        <Text style={styles.metaValue}>
          {isMultiDay
            ? `${formatDate(spansFrom)} → ${formatDate(spansTo)}`
            : formatDate(spansFrom)}
        </Text>
      </View>

      {entry.location ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Location</Text>
          <Text style={styles.metaValue}>{entry.location}</Text>
        </View>
      ) : null}

      {entry.note ? (
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{entry.note}</Text>
        </View>
      ) : null}

      <Text style={styles.yaaGHint}>
        Travel and away periods are managed in Year at a Glance.
      </Text>

      <TouchableOpacity style={styles.yaaGBtn} onPress={onOpenYaaG}>
        <Text style={styles.yaaGBtnText}>Edit in Year at a Glance →</Text>
      </TouchableOpacity>
    </>
  );
}

// ---- styles ---------------------------------------------------------------

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
  openPlannerBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.blue[50],
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  openPlannerBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.blue[700],
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

  // YaaG hint
  yaaGHint: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[500],
    fontStyle: 'italic',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  yaaGBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.blue[50],
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  yaaGBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.blue[700],
  },
});
