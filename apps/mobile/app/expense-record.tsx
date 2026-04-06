import React, { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import type { Expense, ExpenseCategory } from '@pm/types';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  applyExpenseFilters,
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
import { useExpenses, useDeleteExpense } from '../src/hooks/useExpenses';
import { useProjects } from '../src/hooks/useProjects';
import { useContacts } from '../src/hooks/useContacts';
import { ExpenseCard, ExpenseFormModal } from '../src/components/expenses';
import { SkeletonList } from '../src/components/ui';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily } from '../src/theme/typography';

// ---------------------------------------------------------------------------
// Types for FlashList items
// ---------------------------------------------------------------------------

type ListItem =
  | { type: 'date_header'; date: string }
  | { type: 'expense'; expense: Expense };

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ExpenseRecordScreen() {
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [formVisible, setFormVisible] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('');
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  const { data: expenses = [], isLoading, refetch } = useExpenses(monthKey);
  const [refreshing, setRefreshing] = useState(false);
  const { data: projects = [] } = useProjects();
  const { data: contacts = [] } = useContacts();
  const deleteMutation = useDeleteExpense();

  const today = new Date().toISOString().slice(0, 10);

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

  const filtered = useMemo(() => {
    let result = allMonthExpenses;
    if (categoryFilter) {
      result = applyExpenseFilters(result, { category: categoryFilter });
    }
    if (recurringOnly) {
      result = result.filter((e) => e.recurrence_rule !== null);
    }
    return result;
  }, [allMonthExpenses, categoryFilter, recurringOnly]);

  // Build flat list items with date headers
  const listItems = useMemo<ListItem[]>(() => {
    const groups = groupExpensesByDate(filtered);
    const items: ListItem[] = [];
    for (const [date, dayExpenses] of groups) {
      items.push({ type: 'date_header', date });
      for (const expense of dayExpenses) {
        items.push({ type: 'expense', expense });
      }
    }
    return items;
  }, [filtered]);

  // ---------------------------------------------------------------------------
  // Upcoming recurring occurrences (across all month expenses, across months)
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
    // Sort by date ascending, take first 5
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expense Record</Text>
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

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterStrip}
        contentContainerStyle={styles.filterStripContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, recurringOnly && styles.filterChipActive]}
          onPress={() => setRecurringOnly((v) => !v)}
        >
          <Text style={[styles.filterChipText, recurringOnly && styles.filterChipTextActive]}>
            ↻ Recurring
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, categoryFilter === '' && styles.filterChipActive]}
          onPress={() => setCategoryFilter('')}
        >
          <Text style={[styles.filterChipText, categoryFilter === '' && styles.filterChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {EXPENSE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, categoryFilter === cat && styles.filterChipActive]}
            onPress={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
          >
            <Text style={[styles.filterChipText, categoryFilter === cat && styles.filterChipTextActive]}>
              {EXPENSE_CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Main expense list */}
      {isLoading ? (
        <SkeletonList count={5} />
      ) : listItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No expenses this month.</Text>
        </View>
      ) : (
        <FlashList
          data={listItems}
          estimatedItemSize={80}
          onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
          refreshing={refreshing}
          keyExtractor={(item, idx) =>
            item.type === 'date_header' ? `hdr-${item.date}` : `exp-${item.expense.id}-${idx}`
          }
          renderItem={({ item }) => {
            if (item.type === 'date_header') {
              return (
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{formatExpenseDate(item.date)}</Text>
                </View>
              );
            }
            return (
              <ExpenseCard
                expense={item.expense}
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

  // Filter strip
  filterStrip: { flexGrow: 0 },
  filterStripContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderColor: colors.blue[600],
    backgroundColor: colors.blue[50],
  },
  filterChipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[600],
  },
  filterChipTextActive: {
    color: colors.blue[700],
    fontWeight: '600',
  },

  // List
  listContent: { paddingTop: spacing.sm, paddingBottom: spacing['3xl'] },
  dateHeader: {
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

  // Loading / empty
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },

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
