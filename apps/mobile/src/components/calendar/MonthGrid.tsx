import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isDateInAwayPeriod } from '@pm/domain';
import type { CalendarEvent, YearEntry } from '@pm/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// Dot color per event type
const DOT_COLOR: Record<string, string> = {
  meeting: colors.blue[400],
  appointment: colors.green[500],
  birthday: '#EC4899',
  renewal: colors.amber[500],
  other: colors.gray[400],
};

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
  // Build event type map: dateISO -> Set<event_type>
  const eventMap = new Map<string, Set<string>>();
  for (const ev of events) {
    if (!eventMap.has(ev.date)) eventMap.set(ev.date, new Set());
    eventMap.get(ev.date)!.add(ev.event_type);
  }

  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build flat cell array (null = empty padding)
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7)
  );

  return (
    <View style={styles.container}>
      {/* Column headers */}
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={styles.headerCell}>
            <Text style={styles.headerText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.dayCell} />;

            const mm = String(month + 1).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            const dateISO = `${year}-${mm}-${dd}`;

            const isToday = dateISO === todayISO;
            const isSelected = dateISO === selectedDate;
            const isAway = isDateInAwayPeriod(dateISO, yearEntries);
            const dotTypes = Array.from(eventMap.get(dateISO) ?? []);

            return (
              <TouchableOpacity
                key={di}
                style={[styles.dayCell, isAway && styles.dayCellAway, isSelected && styles.dayCellSelected]}
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

const CELL_SIZE = 42;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  headerText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: 8,
  },
  dayCellAway: {
    backgroundColor: colors.amber[50],
  },
  dayCellSelected: {
    backgroundColor: colors.blue[50],
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: colors.blue[500],
  },
  dayNumber: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  todayNumber: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedNumber: {
    color: colors.blue[700],
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 1,
    height: 5,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
