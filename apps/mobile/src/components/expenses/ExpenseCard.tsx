import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Expense, ExpenseCategory } from '@pm/types';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCE_LABELS,
  formatExpenseAmount,
  formatExpenseDate,
} from '@pm/domain';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Category color map
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<ExpenseCategory, { bg: string; text: string }> = {
  personal:      { bg: colors.purple[100], text: colors.purple[700] },
  business:      { bg: colors.blue[100],   text: colors.blue[700] },
  travel:        { bg: colors.amber[100],  text: colors.amber[700] },
  food:          { bg: colors.green[100],  text: colors.green[700] },
  transport:     { bg: colors.gray[100],   text: colors.gray[600] },
  subscriptions: { bg: colors.red[100],    text: colors.red[600] },
  household:     { bg: colors.amber[50],   text: colors.amber[600] },
  other:         { bg: colors.gray[100],   text: colors.gray[600] },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  expense: Expense;
  onPress: () => void;
  onLongPress: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ExpenseCardBase({ expense, onPress, onLongPress }: Props) {
  const catStyle = CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS.other;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLongPress(); }}
      activeOpacity={0.75}
    >
      {/* Top row: title + amount */}
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>{expense.title}</Text>
        <Text style={styles.amount}>{formatExpenseAmount(expense.amount)}</Text>
      </View>

      {/* Meta row: date, merchant, payment method */}
      <View style={styles.metaRow}>
        <Text style={styles.date}>{formatExpenseDate(expense.expense_date)}</Text>
        {expense.merchant_payee ? (
          <Text style={styles.merchant} numberOfLines={1}>{expense.merchant_payee}</Text>
        ) : null}
        {expense.payment_method ? (
          <Text style={styles.paymentMethod} numberOfLines={1}>{expense.payment_method}</Text>
        ) : null}
      </View>

      {/* Badge row: category + recurrence */}
      <View style={styles.badgeRow}>
        <View style={[styles.categoryBadge, { backgroundColor: catStyle.bg }]}>
          <Text style={[styles.categoryText, { color: catStyle.text }]}>
            {EXPENSE_CATEGORY_LABELS[expense.category]}
          </Text>
        </View>
        {expense.recurrence_rule ? (
          <View style={styles.recurrenceBadge}>
            <Text style={styles.recurrenceText}>
              ↻ {EXPENSE_RECURRENCE_LABELS[expense.recurrence_rule as keyof typeof EXPENSE_RECURRENCE_LABELS]}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export const ExpenseCard = React.memo(ExpenseCardBase);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.blue[100],
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  amount: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.ink.DEFAULT,
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  date: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
  },
  merchant: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
    flexShrink: 1,
  },
  paymentMethod: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  categoryText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
  },
  recurrenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.green[50],
    borderWidth: 1,
    borderColor: colors.green[200],
  },
  recurrenceText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '500',
    color: colors.green[700],
  },
});
