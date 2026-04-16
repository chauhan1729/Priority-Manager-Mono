import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { birthdayDateForYear } from '@pm/domain';
import type { AvailabilityStatus, YearEntry, YearEntryType } from '@pm/types';
import { useDeleteYearEntry, useYearEntries } from '../src/hooks/useYearEntries';
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

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const TYPE_CONFIG: Record<YearEntryType, { icon: string; dot: string; bg: string; label: string }> = {
  birthday: { icon: '🎂', dot: '#EC4899',         bg: '#FCE7F3',         label: 'Birthday' },
  travel:   { icon: '✈',  dot: colors.purple[500], bg: colors.purple[50], label: 'Travel' },
  away:     { icon: '🏠', dot: colors.amber[500],  bg: colors.amber[50],  label: 'Away' },
};

const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  away: 'Away (fully unavailable)',
  partial: 'Partial availability',
  available: 'Available (informational)',
};

const AVAILABILITY_STYLE: Record<AvailabilityStatus, { bg: string; text: string }> = {
  away:      { bg: colors.red[100],   text: colors.red[700] },
  partial:   { bg: colors.amber[100], text: colors.amber[700] },
  available: { bg: colors.green[100], text: colors.green[700] },
};

// Priority rank when picking a day-cell dominant color
const TYPE_RANK: Record<YearEntryType, number> = { away: 3, travel: 2, birthday: 1 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate(); // month 0-indexed
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatMonthLabel(entry: YearEntry, viewYear: number): string {
  if (entry.type === 'birthday') {
    const dateForYear = birthdayDateForYear(entry, viewYear);
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
// Screen
// ---------------------------------------------------------------------------

export default function YearAtAGlanceScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [formVisible, setFormVisible] = useState(false);
  const [editEntry, setEditEntry] = useState<YearEntry | null>(null);
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useYearEntries(year);
  const deleteMutation = useDeleteYearEntry();

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '85%'], []);

  // Build per-month entry buckets + per-day type maps once per render
  const { perMonthEntries, perMonthDayType, perMonthBirthdayDays, summaryStats } = useMemo(() => {
    const monthBuckets: YearEntry[][] = Array.from({ length: 12 }, () => []);
    // For each month, map day-of-month → dominant (strongest) entry type (used for bg color)
    const dayTypeMap: Map<number, YearEntryType>[] = Array.from({ length: 12 }, () => new Map());
    // For each month, set of days that have a birthday (separate from dominant — used for overlay dot)
    const birthdayDaysMap: Set<number>[] = Array.from({ length: 12 }, () => new Set());

    let birthdayCount = 0;
    let travelAwayCount = 0;

    for (const entry of entries) {
      if (entry.type === 'birthday') {
        const dateForYear = birthdayDateForYear(entry, year);
        if (!dateForYear) continue; // Feb 29 on non-leap
        birthdayCount++;
        const month = Number(dateForYear.slice(5, 7)) - 1;
        const day = Number(dateForYear.slice(8, 10));
        monthBuckets[month]!.push(entry);
        birthdayDaysMap[month]!.add(day);
        const existing = dayTypeMap[month]!.get(day);
        if (!existing || TYPE_RANK.birthday > TYPE_RANK[existing]) {
          dayTypeMap[month]!.set(day, 'birthday');
        }
      } else {
        // travel / away — may span multiple months
        travelAwayCount++;
        const start = new Date(`${entry.start_date}T00:00:00`);
        const end = new Date(`${entry.end_date ?? entry.start_date}T00:00:00`);
        for (let m = 0; m < 12; m++) {
          const monthStart = new Date(year, m, 1);
          const monthEnd = new Date(year, m + 1, 0);
          if (end < monthStart || start > monthEnd) continue;
          monthBuckets[m]!.push(entry);

          const rangeStart = start < monthStart ? monthStart : start;
          const rangeEnd = end > monthEnd ? monthEnd : end;
          for (let d = rangeStart.getDate(); d <= rangeEnd.getDate(); d++) {
            const existing = dayTypeMap[m]!.get(d);
            if (!existing || TYPE_RANK[entry.type] > TYPE_RANK[existing]) {
              dayTypeMap[m]!.set(d, entry.type);
            }
          }
        }
      }
    }

    return {
      perMonthEntries: monthBuckets,
      perMonthDayType: dayTypeMap,
      perMonthBirthdayDays: birthdayDaysMap,
      summaryStats: { birthdayCount, travelAwayCount },
    };
  }, [entries, year]);

  // Entries that match the selected date (birthdays match MM-DD; travel/away match range)
  const selectedDateEntries = useMemo<YearEntry[]>(() => {
    if (!selectedDate) return [];
    const selYear = Number(selectedDate.slice(0, 4));
    const selMonthDay = selectedDate.slice(5);
    const out: YearEntry[] = [];
    for (const entry of entries) {
      if (entry.type === 'birthday') {
        const dateForYear = birthdayDateForYear(entry, selYear);
        if (dateForYear === selectedDate) out.push(entry);
        continue;
      }
      const start = entry.start_date;
      const end = entry.end_date ?? entry.start_date;
      if (selectedDate >= start && selectedDate <= end) out.push(entry);
      // Silence lint: selMonthDay unused variable
      void selMonthDay;
    }
    return out;
  }, [entries, selectedDate]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const openAddForm = (dateISO?: string) => {
    setEditEntry(null);
    setInitialDate(dateISO);
    setFormVisible(true);
  };

  const openEditForm = (entry: YearEntry) => {
    setEditEntry(entry);
    setInitialDate(undefined);
    setFormVisible(true);
    sheetRef.current?.close();
  };

  const handleDayPress = (dateISO: string) => {
    setSelectedDate(dateISO);
    sheetRef.current?.expand();
  };

  const handleDeleteEntry = (entry: YearEntry) => {
    const hasLinked = !!entry.linked_project_id;
    const msg = hasLinked
      ? `Delete "${entry.title}"? The linked trip project will be kept — delete it separately in Project Planner if needed.`
      : `Delete "${entry.title}"?`;

    Alert.alert('Delete Entry', msg, [
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
    ]);
  };

  const openLinkedProject = (entry: YearEntry) => {
    if (!entry.linked_project_id) return;
    sheetRef.current?.close();
    router.push(`/project-planner/${entry.linked_project_id}`);
  };

  const handleFormClose = () => {
    setFormVisible(false);
    setEditEntry(null);
    setInitialDate(undefined);
  };

  const renderBackdrop = (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Year nav + add */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setYear((y) => y - 1)}
        >
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.yearLabel}>{year}</Text>
          {year !== currentYear && (
            <TouchableOpacity onPress={() => setYear(currentYear)}>
              <Text style={styles.thisYearLink}>This year</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setYear((y) => y + 1)}
        >
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => openAddForm()}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Summary stats */}
      {(summaryStats.birthdayCount > 0 || summaryStats.travelAwayCount > 0) && (
        <Text style={styles.summaryStats}>
          {summaryStats.birthdayCount} birthday{summaryStats.birthdayCount === 1 ? '' : 's'}
          {' · '}
          {summaryStats.travelAwayCount} travel/away
        </Text>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        {(['birthday', 'travel', 'away'] as YearEntryType[]).map((t) => {
          const cfg = TYPE_CONFIG[t];
          return (
            <View key={t} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: cfg.dot }]} />
              <Text style={styles.legendLabel}>{cfg.label}</Text>
            </View>
          );
        })}
      </View>

      {/* 12 stacked month cards */}
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
          Array.from({ length: 12 }, (_, m) => (
            <MonthCard
              key={m}
              year={year}
              month={m}
              entries={perMonthEntries[m] ?? []}
              dayTypeMap={perMonthDayType[m] ?? new Map()}
              birthdayDays={perMonthBirthdayDays[m] ?? new Set()}
              selectedDate={selectedDate}
              onDayPress={handleDayPress}
              onEntryPress={(entry) => {
                setSelectedDate(entry.type === 'birthday'
                  ? (birthdayDateForYear(entry, year) ?? entry.start_date)
                  : entry.start_date);
                sheetRef.current?.expand();
              }}
            />
          ))
        )}

        {!isLoading && entries.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No entries yet for {year}.</Text>
            <TouchableOpacity onPress={() => openAddForm()}>
              <Text style={styles.emptyLink}>Add your first entry</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Day detail bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
        onClose={() => setSelectedDate(null)}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {selectedDate && (
            <>
              <Text style={styles.sheetTitle}>
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>

              {selectedDateEntries.length === 0 ? (
                <Text style={styles.sheetEmpty}>No entries on this day.</Text>
              ) : (
                selectedDateEntries.map((entry) => (
                  <EntryDetailBlock
                    key={entry.id}
                    entry={entry}
                    year={year}
                    onEdit={() => openEditForm(entry)}
                    onDelete={() => handleDeleteEntry(entry)}
                    onOpenProject={() => openLinkedProject(entry)}
                  />
                ))
              )}

              <TouchableOpacity
                style={styles.sheetAddBtn}
                onPress={() => {
                  sheetRef.current?.close();
                  openAddForm(selectedDate);
                }}
              >
                <Text style={styles.sheetAddBtnText}>+ Add entry for this date</Text>
              </TouchableOpacity>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Create / Edit form */}
      <YearEntryFormModal
        visible={formVisible}
        editEntry={editEntry}
        initialDate={initialDate}
        onClose={handleFormClose}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// MonthCard — 7-col mini calendar + entry list below
// ---------------------------------------------------------------------------

interface MonthCardProps {
  year: number;
  month: number; // 0-indexed
  entries: YearEntry[];
  dayTypeMap: Map<number, YearEntryType>;
  birthdayDays: Set<number>;
  selectedDate: string | null;
  onDayPress: (dateISO: string) => void;
  onEntryPress: (entry: YearEntry) => void;
}

function MonthCard({ year, month, entries, dayTypeMap, birthdayDays, selectedDate, onDayPress, onEntryPress }: MonthCardProps) {
  const totalDays = daysInMonth(year, month);
  const firstDay = firstDayOfWeek(year, month);
  const todayISO = new Date().toISOString().slice(0, 10);
  const mm = String(month + 1).padStart(2, '0');

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7)
  );

  const visibleEntries = entries.slice(0, 4);
  const moreCount = Math.max(0, entries.length - 4);

  return (
    <View style={styles.monthCard}>
      <Text style={styles.monthName}>{MONTH_NAMES[month]}</Text>

      {/* Day-of-week header */}
      <View style={styles.weekHeader}>
        {DAY_HEADERS.map((d, i) => (
          <Text key={i} style={styles.weekHeaderCell}>{d}</Text>
        ))}
      </View>

      {/* Mini calendar weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.miniCell} />;

            const dd = String(day).padStart(2, '0');
            const dateISO = `${year}-${mm}-${dd}`;
            const isToday = dateISO === todayISO;
            const isSelected = dateISO === selectedDate;
            const dayType = dayTypeMap.get(day);
            const hasBirthday = birthdayDays.has(day);
            const cfg = dayType ? TYPE_CONFIG[dayType] : null;
            // Show overlay pink dot only if day has a birthday AND dominant type isn't birthday
            const showBirthdayOverlay = hasBirthday && dayType !== 'birthday';

            return (
              <TouchableOpacity
                key={di}
                style={[
                  styles.miniCell,
                  cfg && { backgroundColor: cfg.bg },
                  isSelected && styles.miniCellSelected,
                ]}
                onPress={() => onDayPress(dateISO)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.miniCellText,
                    isToday && styles.miniCellToday,
                  ]}
                >
                  {day}
                </Text>
                {showBirthdayOverlay && <View style={styles.birthdayOverlayDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Entry list below calendar */}
      {visibleEntries.length > 0 && (
        <View style={styles.entryList}>
          {visibleEntries.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={styles.entryRow}
              onPress={() => onEntryPress(entry)}
            >
              <View style={[styles.entryDot, { backgroundColor: TYPE_CONFIG[entry.type].dot }]} />
              <Text style={styles.entryTitle} numberOfLines={1}>
                {TYPE_CONFIG[entry.type].icon} {entry.title}
              </Text>
              <Text style={styles.entryDate} numberOfLines={1}>
                {formatMonthLabel(entry, year)}
              </Text>
              {entry.linked_project_id && <Text style={styles.entryLinkedIcon}>🗂</Text>}
            </TouchableOpacity>
          ))}
          {moreCount > 0 && (
            <Text style={styles.moreCount}>+{moreCount} more</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EntryDetailBlock — shown inside the bottom sheet
// ---------------------------------------------------------------------------

function EntryDetailBlock({
  entry,
  year,
  onEdit,
  onDelete,
  onOpenProject,
}: {
  entry: YearEntry;
  year: number;
  onEdit: () => void;
  onDelete: () => void;
  onOpenProject: () => void;
}) {
  const cfg = TYPE_CONFIG[entry.type];
  const avail = entry.availability_status;

  return (
    <View style={styles.detailBlock}>
      <View style={styles.detailHeader}>
        <Text style={styles.detailIcon}>{cfg.icon}</Text>
        <View style={styles.detailHeaderBody}>
          <Text style={styles.detailTitle} numberOfLines={2}>{entry.title}</Text>
          <View style={styles.detailBadgeRow}>
            <View style={[styles.detailBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.detailBadgeText, { color: cfg.dot }]}>{cfg.label}</Text>
            </View>
            {avail && (
              <View style={[styles.detailBadge, { backgroundColor: AVAILABILITY_STYLE[avail].bg }]}>
                <Text style={[styles.detailBadgeText, { color: AVAILABILITY_STYLE[avail].text }]}>
                  {AVAILABILITY_LABEL[avail]}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <Text style={styles.detailMeta}>{formatMonthLabel(entry, year)}</Text>

      {entry.location && (
        <Text style={styles.detailMeta}>📍 {entry.location}</Text>
      )}
      {entry.note && (
        <Text style={styles.detailNote}>{entry.note}</Text>
      )}

      {entry.linked_project_id && (
        <TouchableOpacity style={styles.linkedProjectBtn} onPress={onOpenProject}>
          <Text style={styles.linkedProjectBtnText}>🗂 Open linked trip project →</Text>
        </TouchableOpacity>
      )}

      <View style={styles.detailActions}>
        <TouchableOpacity style={styles.detailBtn} onPress={onEdit}>
          <Text style={styles.detailBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.detailBtn, styles.detailBtnDanger]}
          onPress={onDelete}
        >
          <Text style={styles.detailBtnTextDanger}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.xs,
  },
  navBtn: { padding: spacing.sm },
  navArrow: {
    fontFamily: fontFamily.sans,
    fontSize: 24,
    color: colors.blue[600],
    lineHeight: 28,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  yearLabel: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['3xl'],
    color: colors.ink.DEFAULT,
  },
  thisYearLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[600],
    fontWeight: '500',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '300',
  },

  // Legend
  summaryStats: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 2,
    backgroundColor: '#FFFFFF',
  },
  legend: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },

  // Scroll area
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing['3xl'] },

  // Loading / empty
  loading: { paddingTop: spacing['3xl'] * 2, alignItems: 'center' },
  loadingText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },
  empty: { paddingVertical: spacing['3xl'], alignItems: 'center', gap: spacing.sm },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },
  emptyLink: { fontFamily: fontFamily.sans, fontSize: fontSize.base, fontWeight: '500', color: colors.blue[600] },

  // Month card
  monthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    gap: spacing.xs,
  },
  monthName: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize.xl,
    color: colors.ink.DEFAULT,
    paddingBottom: spacing.xs,
  },
  weekHeader: {
    flexDirection: 'row',
  },
  weekHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray[400],
    paddingVertical: 2,
  },
  weekRow: { flexDirection: 'row' },
  miniCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    margin: 1,
  },
  miniCellSelected: {
    borderWidth: 1.5,
    borderColor: colors.blue[500],
  },
  miniCellText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.DEFAULT,
  },
  miniCellToday: {
    color: colors.blue[600],
    fontWeight: '700',
  },
  birthdayOverlayDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EC4899',
  },

  // Entry list below calendar
  entryList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 4,
  },
  entryDot: { width: 6, height: 6, borderRadius: 3 },
  entryTitle: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  entryDate: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
  entryLinkedIcon: { fontSize: 12 },
  moreCount: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
    paddingLeft: 14,
  },

  // Bottom sheet
  sheetBg: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  sheetHandle: { backgroundColor: colors.gray[300], width: 40 },
  sheetContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
  },
  sheetTitle: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
  },
  sheetEmpty: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  sheetAddBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: colors.blue[50],
  },
  sheetAddBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.blue[700],
  },

  // Detail block (inside sheet)
  detailBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    gap: spacing.sm,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailIcon: { fontSize: 22, marginTop: 2 },
  detailHeaderBody: { flex: 1, gap: spacing.xs },
  detailTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  detailBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  detailBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  detailBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
  },
  detailMeta: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
  },
  detailNote: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
    lineHeight: 20,
    paddingTop: spacing.xs,
  },
  linkedProjectBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.amber[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.amber[200],
  },
  linkedProjectBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.amber[700],
  },
  detailActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  detailBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: colors.blue[50],
  },
  detailBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.blue[700],
  },
  detailBtnDanger: {
    borderColor: colors.red[200],
    backgroundColor: colors.red[50],
  },
  detailBtnTextDanger: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.red[700],
  },
});
