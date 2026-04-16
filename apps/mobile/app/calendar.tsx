import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CalendarEvent } from '@pm/types';
import {
  useCalendarEventsForMonth,
  useMonthNote,
  useUpsertMonthNote,
} from '../src/hooks/useCalendarEvents';
import { useContacts } from '../src/hooks/useContacts';
import { useYearEntries } from '../src/hooks/useYearEntries';
import { MonthGrid } from '../src/components/calendar/MonthGrid';
import { EventDetailSheet } from '../src/components/calendar/EventDetailSheet';
import { CalendarEventFormModal } from '../src/components/calendar/CalendarEventFormModal';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily } from '../src/theme/typography';
import { todayISO } from '../src/lib/dateUtils';

// ---- helpers ---------------------------------------------------------------

function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

const TYPE_LABEL: Record<string, string> = {
  meeting: 'Meeting',
  appointment: 'Appt',
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

// ---- Day event row ---------------------------------------------------------

interface EventRowProps {
  event: CalendarEvent;
  contactMap: Map<string, string>;
  onPress: () => void;
}

function EventRow({ event, contactMap, onPress }: EventRowProps) {
  const typeStyle = TYPE_COLOR[event.event_type] ?? TYPE_COLOR.other;
  const contactName = event.linked_contact_id ? contactMap.get(event.linked_contact_id) : null;

  const timeLabel = event.start_at
    ? new Date(event.start_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : 'All day';

  return (
    <TouchableOpacity style={styles.eventRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.eventTime}>{timeLabel}</Text>
      <View style={styles.eventBody}>
        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
        {contactName && <Text style={styles.eventMeta} numberOfLines={1}>{contactName}</Text>}
      </View>
      <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
        <Text style={[styles.typeBadgeText, { color: typeStyle.text }]}>
          {TYPE_LABEL[event.event_type] ?? event.event_type}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ---- Monthly notes ---------------------------------------------------------

interface MonthlyNotesProps {
  monthKey: string;
}

function MonthlyNotes({ monthKey }: MonthlyNotesProps) {
  const { data: savedNotes } = useMonthNote(monthKey);
  const upsert = useUpsertMonthNote();
  const [text, setText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<string | null>(null);

  // Sync incoming notes
  useEffect(() => {
    if (savedNotes !== undefined && savedNotes !== savedRef.current) {
      savedRef.current = savedNotes;
      setText(savedNotes ?? '');
    }
  }, [savedNotes]);

  const handleChange = (val: string) => {
    setText(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      savedRef.current = val;
      upsert.mutate({ monthKey, notes: val });
    }, 800);
  };

  return (
    <View style={styles.notesSection}>
      <Text style={styles.notesSectionLabel}>Monthly Notes</Text>
      <RNTextInput
        style={styles.notesInput}
        value={text}
        onChangeText={handleChange}
        placeholder="Notes for this month…"
        placeholderTextColor={colors.gray[400]}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

// ---- Main screen -----------------------------------------------------------

export default function CalendarScreen() {
  const today = todayISO();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

  const monthKey = toMonthKey(year, month);

  const { data: events = [] } = useCalendarEventsForMonth(monthKey);
  const { data: contacts = [] } = useContacts();
  const { data: yearEntries = [] } = useYearEntries(year);

  const contactMap = new Map(contacts.map((c) => [c.id, c.full_name]));

  // Events for the selected day
  const dayEvents = events
    .filter((e) => e.date === selectedDate)
    .sort((a, b) => {
      if (!a.start_at && !b.start_at) return 0;
      if (!a.start_at) return 1;
      if (!b.start_at) return -1;
      return a.start_at.localeCompare(b.start_at);
    });

  // -- Month navigation -------------------------------------------------------
  const goToPrevMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 0) { setYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 11) { setYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // Swipe gesture for month change
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -40) goToNextMonth();
        else if (gs.dx > 40) goToPrevMonth();
      },
    }),
  ).current;

  // -- Event handlers ---------------------------------------------------------
  const handleDayPress = useCallback((dateISO: string) => {
    setSelectedDate(dateISO);
    setDetailEvent(null);
  }, []);

  const handleEventPress = useCallback((event: CalendarEvent) => {
    setDetailEvent(event);
  }, []);

  const handleEdit = useCallback((event: CalendarEvent) => {
    setDetailEvent(null);
    setEditEvent(event);
    setFormVisible(true);
  }, []);

  const handleAddPress = () => {
    setEditEvent(null);
    setFormVisible(true);
  };

  const handleFormClose = () => {
    setFormVisible(false);
    setEditEvent(null);
  };

  const handleSheetClose = () => {
    setDetailEvent(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Month navigation header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.navBtn} onPress={goToPrevMonth}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{formatMonthLabel(year, month)}</Text>
        <TouchableOpacity style={styles.navBtn} onPress={goToNextMonth}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddPress}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Month grid with swipe support */}
      <View style={styles.gridWrapper} {...panResponder.panHandlers}>
        <MonthGrid
          year={year}
          month={month}
          events={events}
          yearEntries={yearEntries}
          selectedDate={selectedDate}
          todayISO={today}
          onDayPress={handleDayPress}
        />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Selected day header */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayHeaderText}>
          {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={styles.dayEventCount}>
          {dayEvents.length === 0 ? 'No events' : `${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* Day events list */}
      <FlatList
        data={dayEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventRow
            event={item}
            contactMap={contactMap}
            onPress={() => handleEventPress(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyDay}>
            <Text style={styles.emptyDayText}>No events on this day.</Text>
            <TouchableOpacity onPress={handleAddPress}>
              <Text style={styles.emptyDayLink}>Add an event</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={<MonthlyNotes monthKey={monthKey} />}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />

      {/* Event detail sheet */}
      <EventDetailSheet
        event={detailEvent}
        contactMap={contactMap}
        onClose={handleSheetClose}
        onEdit={handleEdit}
      />

      {/* Form modal */}
      <CalendarEventFormModal
        visible={formVisible}
        initialDate={selectedDate}
        editEvent={editEvent}
        yearEntries={yearEntries}
        onClose={handleFormClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  navBtn: {
    padding: spacing.sm,
  },
  navArrow: {
    fontFamily: fontFamily.sans,
    fontSize: 24,
    color: colors.blue[600],
    lineHeight: 28,
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '300',
  },

  // Grid
  gridWrapper: {
    backgroundColor: '#FFFFFF',
    paddingBottom: spacing.sm,
  },

  divider: {
    height: 1,
    backgroundColor: colors.blue[100],
  },

  // Day section
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dayHeaderText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  dayEventCount: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
  },

  // List
  list: { flex: 1 },
  listContent: { paddingBottom: spacing['3xl'] },

  // Event row
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.sm,
  },
  eventTime: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.gray[400],
    width: 52,
  },
  eventBody: {
    flex: 1,
  },
  eventTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  eventMeta: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.ink.light,
    marginTop: 1,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  typeBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
  },

  // Empty state
  emptyDay: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyDayText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
    marginBottom: spacing.sm,
  },
  emptyDayLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.blue[600],
    fontWeight: '500',
  },

  // Monthly notes
  notesSection: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
  },
  notesSectionLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  notesInput: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
    minHeight: 80,
    lineHeight: 20,
  },
});
