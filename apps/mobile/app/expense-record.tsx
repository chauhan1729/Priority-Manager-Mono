import React, { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import type { Expense, ExpenseCategory } from '@pm/types';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  applyExpenseFilters,
  type ExpenseFilters,
  filterExpensesForDate,
  filterExpensesForMonth,
  filterExpensesForWeek,
  formatExpenseAmount,
  formatExpenseDate,
  formatMonthLabel,
  getCurrentMonthKey,
  getNextMonthKey,
  getPrevMonthKey,
  groupExpensesByDate,
  getUpcomingOccurrences,
  sumExpenses,
} from '@pm/domain';
import { useExpenses, useDeleteExpense, useCreateExpense, type CreateExpenseData } from '../src/hooks/useExpenses';
import { useProjects } from '../src/hooks/useProjects';
import { useContacts } from '../src/hooks/useContacts';
import { useYearEntries } from '../src/hooks/useYearEntries';
import { DatePickerField } from '../src/components/ui';
import { ExpenseCard, ExpenseFormModal } from '../src/components/expenses';
import { SkeletonList } from '../src/components/ui';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily, fontWeight as fw } from '../src/theme/typography';

// ---------------------------------------------------------------------------
// Types for FlashList items
// ---------------------------------------------------------------------------

type ListItem =
  | { type: 'date_header'; date: string; subtotal: number }
  | { type: 'expense'; expense: Expense };

// ---------------------------------------------------------------------------
// Payment method options (derived from data)
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Bank Transfer', 'Other'];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ExpenseRecordScreen() {
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [formVisible, setFormVisible] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  // Quick add state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAmount, setQuickAmount] = useState('');

  const { data: expenses = [], isLoading, refetch } = useExpenses(monthKey);
  const [refreshing, setRefreshing] = useState(false);
  const { data: projects = [] } = useProjects();
  const { data: contacts = [] } = useContacts();
  const { data: yearEntries = [] } = useYearEntries(new Date().getFullYear());
  const deleteMutation = useDeleteExpense();
  const createExpense = useCreateExpense();

  const today = new Date().toISOString().slice(0, 10);

  // Maps for quick lookup in linked-record chips
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const contactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c.full_name])),
    [contacts],
  );
  const tripOptions = useMemo(
    () => yearEntries.filter((e) => e.type === 'travel' || e.type === 'away'),
    [yearEntries],
  );
  const tripMap = useMemo(
    () => new Map(tripOptions.map((t) => [t.id, t.title])),
    [tripOptions],
  );

  // ISO ↔ Date adapters for filter date pickers
  const isoDateToDate = (iso: string): Date =>
    /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date();
  const dateToIsoDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // ---------------------------------------------------------------------------
  // Summary totals
  // ---------------------------------------------------------------------------

  const allMonthExpenses = useMemo(
    () => filterExpensesForMonth(expenses, monthKey),
    [expenses, monthKey],
  );

  const todayTotal = useMemo(
    () => sumExpenses(filterExpensesForDate(allMonthExpenses, today)),
    [allMonthExpenses, today],
  );
  const weekTotal = useMemo(
    () => sumExpenses(filterExpensesForWeek(allMonthExpenses, today)),
    [allMonthExpenses, today],
  );
  const monthTotal = useMemo(() => sumExpenses(allMonthExpenses), [allMonthExpenses]);

  // ---------------------------------------------------------------------------
  // Filtered list
  // ---------------------------------------------------------------------------

  const filtered = useMemo(
    () => applyExpenseFilters(allMonthExpenses, filters),
    [allMonthExpenses, filters],
  );

  // Active filter count (for badge)
  const activeFilterCount = [
    filters.category,
    filters.linkedProjectId,
    filters.linkedYearEntryId,
    filters.paymentMethod,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  // Build flat list items with date headers + subtotals
  const listItems = useMemo<ListItem[]>(() => {
    const groups = groupExpensesByDate(filtered);
    const items: ListItem[] = [];
    for (const [date, dayExpenses] of groups) {
      const subtotal = sumExpenses(dayExpenses);
      items.push({ type: 'date_header', date, subtotal });
      for (const expense of dayExpenses) {
        items.push({ type: 'expense', expense });
      }
    }
    return items;
  }, [filtered]);

  // Used payment methods from data
  const usedPaymentMethods = useMemo(() => {
    const set = new Set(expenses.map((e) => e.payment_method).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [expenses]);

  // ---------------------------------------------------------------------------
  // Upcoming recurring occurrences
  // ---------------------------------------------------------------------------

  const upcomingOccurrences = useMemo(() => {
    const recurring = expenses.filter((e) => e.recurrence_rule !== null);
    const pairs: { expense: Expense; date: string }[] = [];
    for (const exp of recurring) {
      const dates = getUpcomingOccurrences(exp, today, 5);
      for (const date of dates) {
        pairs.push({ expense: exp, date });
      }
    }
    return pairs.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [expenses, today]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleLongPress = (expense: Expense) => {
    Alert.alert(expense.title, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Edit',
        onPress: () => {
          setEditExpense(expense);
          setFormVisible(true);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDelete(expense),
      },
    ]);
  };

  const confirmDelete = (expense: Expense) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Expense',
      `Delete "${expense.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(expense.id, {
              onError: (e: Error) => Alert.alert('Error', e.message),
            }),
        },
      ],
    );
  };

  async function handleExportCSV() {
    if (filtered.length === 0) {
      Alert.alert('No Data', 'No expenses to export for this period.');
      return;
    }

    const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header =
      'Date,Title,Merchant,Amount,Category,Payment Method,Recurrence,Project,Contact,Trip,Note\n';
    const rows = filtered
      .map((e) => {
        const projName = e.linked_project_id ? projectMap.get(e.linked_project_id) ?? '' : '';
        const contactName = e.linked_contact_id ? contactMap.get(e.linked_contact_id) ?? '' : '';
        const tripName = e.linked_year_entry_id ? tripMap.get(e.linked_year_entry_id) ?? '' : '';
        return [
          e.expense_date,
          escapeCsv(e.title),
          escapeCsv(e.merchant_payee ?? ''),
          e.amount.toFixed(2),
          e.category,
          escapeCsv(e.payment_method ?? ''),
          e.recurrence_rule ?? '',
          escapeCsv(projName),
          escapeCsv(contactName),
          escapeCsv(tripName),
          escapeCsv(e.note ?? ''),
        ].join(',');
      })
      .join('\n');

    const csv = header + rows;
    const fileUri = FileSystem.cacheDirectory + `expenses_${monthKey}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } else {
      Alert.alert('Export', 'Sharing is not available on this device.');
    }
  }

  function handleQuickAdd() {
    const title = quickTitle.trim();
    const amount = parseFloat(quickAmount);
    if (!title || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid', 'Enter a title and valid amount.');
      return;
    }
    createExpense.mutate(
      { title, amount, expense_date: today, category: 'other' } as CreateExpenseData,
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setQuickTitle('');
          setQuickAmount('');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header: Add + Export + Filters */}
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
            <Text style={styles.exportBtnText}>↓ CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, (showFilters || activeFilterCount > 0) && styles.filterBtnActive]}
            onPress={() => setShowFilters((v) => !v)}
          >
            <Text style={[styles.filterBtnText, (showFilters || activeFilterCount > 0) && styles.filterBtnTextActive]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditExpense(null);
              setFormVisible(true);
            }}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Month navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity
          onPress={() => setMonthKey((k) => getPrevMonthKey(k))}
          style={styles.navArrow}
        >
          <Text style={styles.navArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{formatMonthLabel(monthKey)}</Text>
        <TouchableOpacity
          onPress={() => setMonthKey((k) => getNextMonthKey(k))}
          style={styles.navArrow}
        >
          <Text style={styles.navArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.summaryStrip}
        contentContainerStyle={styles.summaryStripContent}
      >
        <SummaryTile label="Today" value={formatExpenseAmount(todayTotal)} />
        <SummaryTile label="This Week" value={formatExpenseAmount(weekTotal)} />
        <SummaryTile label="This Month" value={formatExpenseAmount(monthTotal)} />
      </ScrollView>

      {/* Quick add bar */}
      <View style={styles.quickAddBar}>
        <TextInput
          style={styles.quickAddInput}
          placeholder="Expense title"
          placeholderTextColor={colors.gray[400]}
          value={quickTitle}
          onChangeText={setQuickTitle}
        />
        <TextInput
          style={[styles.quickAddInput, styles.quickAddAmount]}
          placeholder="Amount"
          placeholderTextColor={colors.gray[400]}
          value={quickAmount}
          onChangeText={setQuickAmount}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={styles.quickAddBtn}
          onPress={handleQuickAdd}
          disabled={createExpense.isPending}
        >
          <Text style={styles.quickAddBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Filters panel */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filtersPanelHeader}>
            <Text style={styles.filtersPanelTitle}>Filters</Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={() => setFilters({})}>
                <Text style={styles.clearFiltersText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Category filter chips */}
          <Text style={styles.filterLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipScroll}>
            <TouchableOpacity
              style={[styles.filterChip, !filters.category && styles.filterChipActive]}
              onPress={() => setFilters((f) => ({ ...f, category: '' }))}
            >
              <Text style={[styles.filterChipText, !filters.category && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {EXPENSE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, filters.category === cat && styles.filterChipActive]}
                onPress={() => setFilters((f) => ({ ...f, category: f.category === cat ? '' : cat }))}
              >
                <Text style={[styles.filterChipText, filters.category === cat && styles.filterChipTextActive]}>
                  {EXPENSE_CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Payment method chips */}
          {usedPaymentMethods.length > 0 && (
            <>
              <Text style={styles.filterLabel}>Payment Method</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, !filters.paymentMethod && styles.filterChipActive]}
                  onPress={() => setFilters((f) => ({ ...f, paymentMethod: '' }))}
                >
                  <Text style={[styles.filterChipText, !filters.paymentMethod && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {usedPaymentMethods.map((pm) => (
                  <TouchableOpacity
                    key={pm}
                    style={[styles.filterChip, filters.paymentMethod === pm && styles.filterChipActive]}
                    onPress={() => setFilters((f) => ({ ...f, paymentMethod: f.paymentMethod === pm ? '' : pm }))}
                  >
                    <Text style={[styles.filterChipText, filters.paymentMethod === pm && styles.filterChipTextActive]}>
                      {pm}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Project filter chips */}
          {projects.length > 0 && (
            <>
              <Text style={styles.filterLabel}>Project</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, !filters.linkedProjectId && styles.filterChipActive]}
                  onPress={() => setFilters((f) => ({ ...f, linkedProjectId: '' }))}
                >
                  <Text style={[styles.filterChipText, !filters.linkedProjectId && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.filterChip, filters.linkedProjectId === p.id && styles.filterChipActive]}
                    onPress={() => setFilters((f) => ({ ...f, linkedProjectId: f.linkedProjectId === p.id ? '' : p.id }))}
                  >
                    <Text style={[styles.filterChipText, filters.linkedProjectId === p.id && styles.filterChipTextActive]} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Trip filter chips (travel / away year entries) */}
          {tripOptions.length > 0 && (
            <>
              <Text style={styles.filterLabel}>Trip</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, !filters.linkedYearEntryId && styles.filterChipActive]}
                  onPress={() => setFilters((f) => ({ ...f, linkedYearEntryId: '' }))}
                >
                  <Text
                    style={[styles.filterChipText, !filters.linkedYearEntryId && styles.filterChipTextActive]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {tripOptions.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.filterChip, filters.linkedYearEntryId === t.id && styles.filterChipActive]}
                    onPress={() =>
                      setFilters((f) => ({
                        ...f,
                        linkedYearEntryId: f.linkedYearEntryId === t.id ? '' : t.id,
                      }))
                    }
                  >
                    <Text
                      style={[styles.filterChipText, filters.linkedYearEntryId === t.id && styles.filterChipTextActive]}
                      numberOfLines={1}
                    >
                      ✈ {t.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Date range filter */}
          <Text style={styles.filterLabel}>Date Range</Text>
          <View style={styles.dateRangeRow}>
            <View style={styles.dateRangeCol}>
              <Text style={styles.dateRangeLabel}>From</Text>
              <DatePickerField
                value={filters.dateFrom ? isoDateToDate(filters.dateFrom) : null}
                onChange={(d) => setFilters((f) => ({ ...f, dateFrom: dateToIsoDate(d) }))}
                placeholder="Any"
              />
              {filters.dateFrom ? (
                <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, dateFrom: undefined }))}>
                  <Text style={styles.dateRangeClear}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.dateRangeCol}>
              <Text style={styles.dateRangeLabel}>To</Text>
              <DatePickerField
                value={filters.dateTo ? isoDateToDate(filters.dateTo) : null}
                onChange={(d) => setFilters((f) => ({ ...f, dateTo: dateToIsoDate(d) }))}
                placeholder="Any"
                {...(filters.dateFrom ? { minimumDate: isoDateToDate(filters.dateFrom) } : {})}
              />
              {filters.dateTo ? (
                <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, dateTo: undefined }))}>
                  <Text style={styles.dateRangeClear}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {/* Main expense list */}
      {isLoading ? (
        <SkeletonList count={5} />
      ) : listItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {activeFilterCount > 0
              ? 'No expenses match your filters.'
              : `No expenses for ${formatMonthLabel(monthKey)}.`}
          </Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={() => setFilters({})}>
              <Text style={styles.emptyLink}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlashList
          data={listItems}
          onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
          refreshing={refreshing}
          keyExtractor={(item: ListItem, idx: number) =>
            item.type === 'date_header' ? `hdr-${item.date}` : `exp-${item.expense.id}-${idx}`
          }
          renderItem={({ item }: ListRenderItemInfo<ListItem>) => {
            if (item.type === 'date_header') {
              return (
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{formatExpenseDate(item.date)}</Text>
                  <Text style={styles.dateSubtotal}>{formatExpenseAmount(item.subtotal)}</Text>
                </View>
              );
            }
            return (
              <ExpenseCard
                expense={item.expense}
                projectName={
                  item.expense.linked_project_id
                    ? projectMap.get(item.expense.linked_project_id) ?? null
                    : null
                }
                contactName={
                  item.expense.linked_contact_id
                    ? contactMap.get(item.expense.linked_contact_id) ?? null
                    : null
                }
                tripTitle={
                  item.expense.linked_year_entry_id
                    ? tripMap.get(item.expense.linked_year_entry_id) ?? null
                    : null
                }
                onPress={() => {
                  setEditExpense(item.expense);
                  setFormVisible(true);
                }}
                onLongPress={() => handleLongPress(item.expense)}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            upcomingOccurrences.length > 0 ? (
              <View style={styles.upcomingSection}>
                <TouchableOpacity
                  style={styles.upcomingHeader}
                  onPress={() => setUpcomingOpen((v) => !v)}
                >
                  <Text style={styles.upcomingHeaderText}>
                    Upcoming Recurring ({upcomingOccurrences.length})
                  </Text>
                  <Text style={styles.upcomingChevron}>{upcomingOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {upcomingOpen && (
                  <View style={styles.upcomingList}>
                    {upcomingOccurrences.map((item, idx) => (
                      <View key={`${item.expense.id}-${idx}`} style={styles.upcomingRow}>
                        <Text style={styles.upcomingDate}>{formatExpenseDate(item.date)}</Text>
                        <Text style={styles.upcomingTitle} numberOfLines={1}>
                          {item.expense.title}
                        </Text>
                        <Text style={styles.upcomingAmount}>
                          {formatExpenseAmount(item.expense.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : null
          }
        />
      )}

      {/* Form modal */}
      <ExpenseFormModal
        visible={formVisible}
        editExpense={editExpense}
        initialMonthKey={monthKey}
        projects={projects}
        contacts={contacts}
        yearEntries={yearEntries}
        onClose={() => {
          setFormVisible(false);
          setEditExpense(null);
        }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
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
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  exportBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: '#FFFFFF',
  },
  exportBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fw.medium,
    color: colors.ink.light,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: '#FFFFFF',
  },
  filterBtnActive: {
    borderColor: colors.blue[500],
    backgroundColor: colors.blue[50],
  },
  filterBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fw.medium,
    color: colors.ink.light,
  },
  filterBtnTextActive: {
    color: colors.blue[700],
  },
  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.blue[600],
  },
  addBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Month navigator
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.xl,
  },
  navArrow: { padding: spacing.sm },
  navArrowText: {
    fontFamily: fontFamily.sans,
    fontSize: 24,
    color: colors.blue[600],
    lineHeight: 28,
  },
  monthLabel: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
    minWidth: 160,
    textAlign: 'center',
  },

  // Summary strip
  summaryStrip: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    flexGrow: 0,
  },
  summaryStripContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  summaryTile: {
    backgroundColor: colors.blue[50],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 110,
  },
  summaryLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
    fontWeight: '500',
  },
  summaryValue: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.ink.DEFAULT,
    marginTop: 2,
  },

  // Quick add bar
  quickAddBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  quickAddInput: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: colors.blue[50],
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  quickAddAmount: {
    flex: 0,
    width: 100,
  },
  quickAddBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddBtnText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 24,
  },

  // Filters panel
  filtersPanel: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filtersPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersPanelTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fw.semibold,
    color: colors.ink.DEFAULT,
  },
  clearFiltersText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.red[500],
  },
  filterLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fw.medium,
    color: colors.ink.light,
    marginTop: spacing.xs,
  },
  filterChipScroll: { flexGrow: 0, marginTop: spacing.xs },
  dateRangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dateRangeCol: { flex: 1, gap: spacing.xs },
  dateRangeLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  dateRangeClear: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[600],
    fontWeight: '500',
    textAlign: 'right',
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: '#FFFFFF',
    marginRight: spacing.xs,
  },
  filterChipActive: {
    borderColor: colors.blue[600],
    backgroundColor: colors.blue[50],
  },
  filterChipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[600],
  },
  filterChipTextActive: {
    color: colors.blue[700],
    fontWeight: '600',
  },

  // List
  listContent: { paddingTop: spacing.sm, paddingBottom: spacing['3xl'] },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  dateHeaderText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateSubtotal: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.ink.light,
  },

  // Loading / empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },
  emptyLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.blue[600],
    fontWeight: '500',
    marginTop: spacing.sm,
  },

  // Upcoming recurring panel
  upcomingSection: {
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.green[50],
    overflow: 'hidden',
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  upcomingHeaderText: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.green[700],
  },
  upcomingChevron: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.green[600],
  },
  upcomingList: { paddingBottom: spacing.sm },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.green[100],
  },
  upcomingDate: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
    width: 80,
  },
  upcomingTitle: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  upcomingAmount: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
});
