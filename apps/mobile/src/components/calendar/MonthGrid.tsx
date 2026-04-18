import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AvailabilityStatus, CalendarEvent, YearEntry } from '@pm/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// Dot color per event/entry type
const DOT_COLOR: Record<string, string> = {
  meeting: colors.blue[400],
  appointment: colors.green[500],
  birthday: '#EC4899',
  renewal: colors.amber[500],
  other: colors.gray[400],
  travel: colors.purple[500],
  away: colors.amber[500],
};

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Day-cell background per availability status (for travel/away overlaps)
const AVAIL_CELL: Record<AvailabilityStatus, { bg: string; opacity: number }> = {
  away:      { bg: colors.amber[50],  opacity: 1 },
  partial:   { bg: colors.amber[50],  opacity: 0.55 },
  available: { bg: colors.gray[100],  opacity: 1 },
};

// Rank so that if multiple entries overlap one day, the "strongest" wins
const AVAIL_RANK: Record<AvailabilityStatus, number> = { away: 3, partial: 2, available: 1 };

interface Props {
  year: number;
  month: number; // 0-indexed (0 = January)
  events: CalendarEvent[];
  yearEntries: YearEntry[];
  selectedDate: string | null;
  todayISO: string;
  onDayPress: (dateISO: string) => void;
}

export function MonthGrid({ year, month, events, yearEntries, selectedDate, todayISO, onDayPress }: Props) {
  const monthStr = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthStart = `${year}-${monthStr}-01`;
  const monthEnd = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  // dot types per date
  const eventMap = new Map<string, Set<string>>();
  // availability per date (strongest-wins)
  const availMap = new Map<string, AvailabilityStatus>();

  // Calendar events → dots
  for (const ev of events) {
    if (!eventMap.has(ev.date)) eventMap.set(ev.date, new Set());
    eventMap.get(ev.date)!.add(ev.event_type);
  }

  // Birthdays recur annually by MM-DD
  for (const entry of yearEntries) {
    if (entry.type !== 'birthday') continue;
    const monthDay = entry.start_date.slice(5);
    if (monthDay.slice(0, 2) !== monthStr) continue;
    const bd = `${year}-${monthDay}`;
    if (!eventMap.has(bd)) eventMap.set(bd, new Set());
    eventMap.get(bd)!.add('birthday');
  }

  // Travel/away — clip to month, stamp availability + dots per day
  for (const entry of yearEntries) {
    if (entry.type !== 'travel' && entry.type !== 'away') continue;
    const start = entry.start_date;
    const end = entry.end_date ?? entry.start_date;
    if (end < monthStart || start > monthEnd) continue;

    const rangeStart = start < monthStart ? monthStart : start;
    const rangeEnd = end > monthEnd ? monthEnd : end;
    const sDay = Number(rangeStart.split('-')[2]);
    const eDay = Number(rangeEnd.split('-')[2]);
    const status = entry.availability_status ?? 'away';

    for (let d = sDay; d <= eDay; d++) {
      const dateISO = `${year}-${monthStr}-${String(d).padStart(2, '0')}`;
      const existing = availMap.get(dateISO);
      if (!existing || AVAIL_RANK[status] > AVAIL_RANK[existing]) {
        availMap.set(dateISO, status);
      }
      if (!eventMap.has(dateISO)) eventMap.set(dateISO, new Set());
      eventMap.get(dateISO)!.add(entry.type);
    }
  }

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7)
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={styles.headerCell}>
            <Text style={styles.headerText}>{d}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.dayCell} />;

            const dd = String(day).padStart(2, '0');
            const dateISO = `${year}-${monthStr}-${dd}`;
            const isToday = dateISO === todayISO;
            const isSelected = dateISO === selectedDate;
            const availStatus = availMap.get(dateISO);
            const dotTypes = Array.from(eventMap.get(dateISO) ?? []);

            // Background: availability overlay (overridden by selected)
            const availStyle = availStatus ? AVAIL_CELL[availStatus] : null;

            return (
              <TouchableOpacity
                key={di}
                style={[
                  styles.dayCell,
                  availStyle && { backgroundColor: availStyle.bg, opacity: availStyle.opacity },
                  isSelected && styles.dayCellSelected,
                ]}
                onPress={() => onDayPress(dateISO)}
                activeOpacity={0.7}
              >
                <View style={[styles.dayCircle, isToday && styles.todayCircle]}>
                  <Text
                    style={[
                      styles.dayNumber,
                      isToday && styles.todayNumber,
                      isSelected && !isToday && styles.selectedNumber,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {dotTypes.length > 0 && (
                  <View style={styles.dotsRow}>
                    {dotTypes.slice(0, 3).map((type, i) => (
                      <View
                        key={i}
                        style={[styles.dot, { backgroundColor: DOT_COLOR[type] ?? colors.gray[400] }]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  headerRow: { flexDirection: 'row', marginBottom: spacing.sm },
  headerCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  headerText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: 10,
  },
  dayCellSelected: {
    backgroundColor: colors.blue[100],
    opacity: 1,
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: { backgroundColor: colors.blue[500] },
  dayNumber: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.DEFAULT },
  todayNumber: { color: '#FFFFFF', fontWeight: '700' },
  selectedNumber: { color: colors.blue[700], fontWeight: '600' },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    height: 5,
    alignItems: 'center',
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
