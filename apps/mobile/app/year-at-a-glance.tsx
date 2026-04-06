import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  birthdayDateForYear,
  entryOverlapsYear,
} from '@pm/domain';
import type { AvailabilityStatus, YearEntry, YearEntryType } from '@pm/types';
import { useYearEntries, useDeleteYearEntry } from '../src/hooks/useYearEntries';
import { YearEntryFormModal } from '../src/components/year/YearEntryFormModal';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily } from '../src/theme/typography';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TYPE_CONFIG: Record<YearEntryType, { icon: string; dot: string; label: string }> = {
  travel:   { icon: '✈',  dot: colors.blue[500],   label: 'Travel' },
  away:     { icon: '🏠', dot: colors.amber[500],  label: 'Away' },
  birthday: { icon: '🎂', dot: '#F472B6',           label: 'Birthday' }, // pink-400
};

const AVAILABILITY_STYLE: Record<AvailabilityStatus, { bg: string; text: string }> = {
  available: { bg: colors.green[100],  text: colors.green[700] },
  partial:   { bg: colors.amber[100],  text: colors.amber[700] },
  away:      { bg: colors.red[100],    text: colors.red[600] },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month is 1-indexed here
}

/**
 * Returns all entries that have any overlap with the given month (1-indexed).
 */
function getEntriesForMonth(entries: YearEntry[], year: number, month: number): YearEntry[] {
  const mm = String(month).padStart(2, '0');
  const firstDay = `${year}-${mm}-01`;
  const lastDay = `${year}-${mm}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

  return entries.filter((entry) => {
    if (entry.type === 'birthday') {
      // Annual recurrence: match by month only
      const entryMonth = entry.start_date.slice(5, 7);
      return entryMonth === mm;
    }
    // Travel / away: date range overlap
    const entryEnd = entry.end_date ?? entry.start_date;
    return entry.start_date <= lastDay && entryEnd >= firstDay;
  });
}

/**
 * Format a date range for display.
 */
function formatDateRange(entry: YearEntry, year: number): string {
  if (entry.type === 'birthday') {
    const dateForYear = birthdayDateForYear(entry, year);
    if (!dateForYear) return 'Every year';
    const [, mm, dd] = dateForYear.split('-');
    return `Every ${MONTH_NAMES[Number(mm) - 1]} ${Number(dd)}`;
  }
  const start = formatShortDate(entry.start_date);
  if (!entry.end_date || entry.end_date === entry.start_date) return start;
  return `${start} – ${formatShortDate(entry.end_date)}`;
}

function formatShortDate(iso: string): string {
  const [, mm, dd] = iso.split('-');
  return `${MONTH_NAMES[Number(mm) - 1]?.slice(0, 3)} ${Number(dd)}`;
}

// ---------------------------------------------------------------------------
// Entry card
// ---------------------------------------------------------------------------

interface EntryCardProps {
  entry: YearEntry;
  year: number;
  onEdit: () => void;
  onDelete: () => void;
}

function EntryCard({ entry, year, onEdit, onDelete }: EntryCardProps) {
  const cfg = TYPE_CONFIG[entry.type];
  const avail = entry.availability_status
    ? AVAILABILITY_STYLE[entry.availability_status]
    : null;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.row}>
        <Text style={cardStyles.icon}>{cfg.icon}</Text>
        <View style={cardStyles.body}>
          <Text style={cardStyles.title} numberOfLines={1}>{entry.title}</Text>
          <Text style={cardStyles.dateRange}>{formatDateRange(entry, year)}</Text>
          {entry.location ? (
            <Text style={cardStyles.location} numberOfLines={1}>📍 {entry.location}</Text>
          ) : null}
        </View>
        <View style={cardStyles.badges}>
          {avail && (
            <View style={[cardStyles.availBadge, { backgroundColor: avail.bg }]}>
              <Text style={[cardStyles.availText, { color: avail.text }]}>
                {entry.availability_status}
              </Text>
            </View>
          )}
          {entry.linked_project_id && (
            <Text style={cardStyles.linkedIcon} accessibilityLabel="Linked project">🗂</Text>
          )}
        </View>
      </View>

      <View style={cardStyles.actions}>
        <TouchableOpacity style={cardStyles.actionBtn} onPress={onEdit}>
          <Text style={cardStyles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[cardStyles.actionBtn, cardStyles.actionBtnDanger]} onPress={onDelete}>
          <Text style={cardStyles.actionTextDanger}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.blue[100],
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.sm,
  },
  icon: { fontSize: 20, marginTop: 2 },
  body: { flex: 1, gap: 3 },
  title: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  dateRange: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },
  location: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
  badges: { alignItems: 'flex-end', gap: spacing.xs },
  availBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  availText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  linkedIcon: { fontSize: 14 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.gray[100],
  },
  actionBtnDanger: {},
  actionText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.blue[600],
  },
  actionTextDanger: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.red[600],
  },
});

// ---------------------------------------------------------------------------
// Month cell (in 2-column grid)
// ---------------------------------------------------------------------------

interface MonthCellProps {
  year: number;
  month: number; // 1-indexed
  entries: YearEntry[];
  isExpanded: boolean;
  onToggle: () => void;
  onEditEntry: (entry: YearEntry) => void;
  onDeleteEntry: (entry: YearEntry) => void;
  onAddEntry: () => void;
}

function MonthCell({
  year, month, entries, isExpanded,
  onToggle, onEditEntry, onDeleteEntry, onAddEntry,
}: MonthCellProps) {
  const monthEntries = useMemo(
    () => getEntriesForMonth(entries, year, month),
    [entries, year, month],
  );

  // Unique entry types present this month for dot indicators
  const dotTypes = useMemo(() => {
    const seen = new Set<YearEntryType>();
    monthEntries.forEach((e) => seen.add(e.type));
    return [...seen] as YearEntryType[];
  }, [monthEntries]);

  return (
    <View style={monthStyles.wrapper}>
      <TouchableOpacity
        style={[monthStyles.cell, isExpanded && monthStyles.cellExpanded]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[monthStyles.monthName, isExpanded && monthStyles.monthNameExpanded]}>
          {MONTH_NAMES[month - 1]}
        </Text>
        {/* Dot indicators */}
        <View style={monthStyles.dotsRow}>
          {dotTypes.map((t) => (
            <View
              key={t}
              style={[monthStyles.dot, { backgroundColor: TYPE_CONFIG[t].dot }]}
            />
          ))}
          {monthEntries.length === 0 && (
            <View style={monthStyles.emptyDot} />
          )}
        </View>
        {monthEntries.length > 0 && (
          <Text style={monthStyles.count}>{monthEntries.length}</Text>
        )}
      </TouchableOpacity>

      {/* Expanded entry list */}
      {isExpanded && (
        <View style={monthStyles.expanded}>
          {monthEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              year={year}
              onEdit={() => onEditEntry(entry)}
              onDelete={() => onDeleteEntry(entry)}
            />
          ))}
          <TouchableOpacity style={monthStyles.addInMonth} onPress={onAddEntry}>
            <Text style={monthStyles.addInMonthText}>+ Add entry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const monthStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    margin: spacing.xs,
  },
  cell: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    alignItems: 'flex-start',
    minHeight: 72,
  },
  cellExpanded: {
    borderColor: colors.blue[400],
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  monthName: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
    marginBottom: spacing.xs,
  },
  monthNameExpanded: { color: colors.blue[700] },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray[200],
  },
  count: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
    marginTop: 3,
  },
  expanded: {
    backgroundColor: colors.blue[50],
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.blue[400],
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    padding: spacing.sm,
  },
  addInMonth: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  addInMonthText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.blue[600],
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function YearAtAGlanceScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editEntry, setEditEntry] = useState<YearEntry | null>(null);

  const { data: entries = [], isLoading } = useYearEntries(year);
  const deleteMutation = useDeleteYearEntry();

  const handleToggleMonth = (month: number) => {
    setExpandedMonth((prev) => (prev === month ? null : month));
  };

  const handleEditEntry = (entry: YearEntry) => {
    setEditEntry(entry);
    setFormVisible(true);
  };

  const handleDeleteEntry = (entry: YearEntry) => {
    Alert.alert(
      'Delete Entry',
      `Delete "${entry.title}"?${entry.linked_project_id ? ' The linked trip plan project will be kept.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(
              { id: entry.id },
              { onError: (e: Error) => Alert.alert('Error', e.message) },
            ),
        },
      ],
    );
  };

  const handleAddPress = () => {
    setEditEntry(null);
    setFormVisible(true);
  };

  const handleFormClose = () => {
    setFormVisible(false);
    setEditEntry(null);
  };

  // Build grid rows: 6 rows × 2 cols = 12 months
  const monthPairs = useMemo(() => {
    const pairs: [number, number][] = [];
    for (let i = 1; i <= 12; i += 2) {
      pairs.push([i, i + 1]);
    }
    return pairs;
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Year at a Glance</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddPress}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Year selector */}
      <View style={styles.yearSelector}>
        <TouchableOpacity
          style={styles.yearArrow}
          onPress={() => { setYear((y) => y - 1); setExpandedMonth(null); }}
        >
          <Text style={styles.yearArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.yearLabel}>{year}</Text>
        <TouchableOpacity
          style={styles.yearArrow}
          onPress={() => { setYear((y) => y + 1); setExpandedMonth(null); }}
        >
          <Text style={styles.yearArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {(Object.entries(TYPE_CONFIG) as [YearEntryType, typeof TYPE_CONFIG[YearEntryType]][]).map(
          ([type, cfg]) => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: cfg.dot }]} />
              <Text style={styles.legendLabel}>{cfg.label}</Text>
            </View>
          ),
        )}
      </View>

      {/* 12-month grid */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : (
          monthPairs.map(([m1, m2]) => (
            <View key={m1} style={styles.gridRow}>
              <MonthCell
                year={year}
                month={m1}
                entries={entries}
                isExpanded={expandedMonth === m1}
                onToggle={() => handleToggleMonth(m1)}
                onEditEntry={handleEditEntry}
                onDeleteEntry={handleDeleteEntry}
                onAddEntry={handleAddPress}
              />
              {m2 <= 12 ? (
                <MonthCell
                  year={year}
                  month={m2}
                  entries={entries}
                  isExpanded={expandedMonth === m2}
                  onToggle={() => handleToggleMonth(m2)}
                  onEditEntry={handleEditEntry}
                  onDeleteEntry={handleDeleteEntry}
                  onAddEntry={handleAddPress}
                />
              ) : (
                <View style={{ flex: 1, margin: spacing.xs }} />
              )}
            </View>
          ))
        )}
      </ScrollView>

      <YearEntryFormModal
        visible={formVisible}
        editEntry={editEntry}
        onClose={handleFormClose}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  headerTitle: {
    flex: 1,
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
  },
  addBtnText: { color: '#FFFFFF', fontSize: 22, lineHeight: 26, fontWeight: '300' },

  // Year selector
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.xl,
  },
  yearArrow: {
    padding: spacing.md,
  },
  yearArrowText: {
    fontFamily: fontFamily.sans,
    fontSize: 24,
    color: colors.blue[600],
    lineHeight: 28,
  },
  yearLabel: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['3xl'],
    color: colors.ink.DEFAULT,
    minWidth: 80,
    textAlign: 'center',
  },

  // Legend
  legend: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },

  // Grid
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.sm,
    paddingBottom: spacing['3xl'],
  },
  gridRow: {
    flexDirection: 'row',
  },

  // Loading
  loading: {
    paddingTop: spacing['3xl'] * 2,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
  },
});
