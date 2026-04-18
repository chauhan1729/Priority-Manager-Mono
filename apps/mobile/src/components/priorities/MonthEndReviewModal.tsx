import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { MonthlyPriority } from '@pm/types';
import { MP_STATUS_LABELS } from '@pm/domain';
import {
  useCarryForwardPriority,
  useUpdatePriorityStatus,
} from '../../hooks/useMonthlyPriorities';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../components/providers/AuthProvider';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  monthLabel: string;
  priorities: MonthlyPriority[];
  onClose: () => void;
  /** Triggered when the user picks "Rewrite" for a priority; parent opens form in next month */
  onRewrite?: (priority: MonthlyPriority) => void;
}

// ---------------------------------------------------------------------------
// Action type per priority
// ---------------------------------------------------------------------------

type ReviewAction = 'complete' | 'carry_forward' | 'drop' | 'rewrite' | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MonthEndReviewModal({ visible, monthLabel, priorities, onClose, onRewrite }: Props) {
  const { user } = useAuth();
  const [actions, setActions] = useState<Record<string, ReviewAction>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statusMutation = useUpdatePriorityStatus();
  const carryMutation = useCarryForwardPriority();

  const activePriorities = priorities.filter(
    (p) => p.status !== 'completed' && p.status !== 'dropped',
  );

  // Fetch project statuses for all linked projects — used to disable Carry when project ≠ in_progress
  const linkedProjectIds = useMemo(
    () => Array.from(new Set(
      activePriorities.map((p) => p.linked_project_id).filter((id): id is string => !!id),
    )),
    [activePriorities],
  );

  const { data: projectStatuses = {} } = useQuery({
    queryKey: ['projects', 'statuses', linkedProjectIds],
    queryFn: async () => {
      if (!user || linkedProjectIds.length === 0) return {};
      const { data } = await supabase
        .from('projects')
        .select('id, status')
        .eq('user_id', user.id)
        .in('id', linkedProjectIds);
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.id as string] = p.status as string;
      return map;
    },
    enabled: visible && !!user && linkedProjectIds.length > 0,
  });

  const canCarryForward = (p: MonthlyPriority): boolean => {
    if (!p.linked_project_id) return false;
    const status = projectStatuses[p.linked_project_id];
    return status === 'in_progress';
  };

  const setAction = (id: string, action: ReviewAction) => {
    setActions((prev) => ({ ...prev, [id]: action }));
  };

  const handleApply = async () => {
    setError(null);
    setSaving(true);
    try {
      for (const priority of activePriorities) {
        const action = actions[priority.id] ?? null;
        if (action === 'complete') {
          await new Promise<void>((resolve, reject) =>
            statusMutation.mutate(
              { id: priority.id, status: 'completed', month_key: priority.month_key },
              { onSuccess: () => resolve(), onError: (e) => reject(e) },
            ),
          );
        } else if (action === 'drop') {
          await new Promise<void>((resolve, reject) =>
            statusMutation.mutate(
              { id: priority.id, status: 'dropped', month_key: priority.month_key },
              { onSuccess: () => resolve(), onError: (e) => reject(e) },
            ),
          );
        } else if (action === 'carry_forward') {
          await new Promise<void>((resolve, reject) =>
            carryMutation.mutate(
              { priorityId: priority.id, sourceMonthKey: priority.month_key },
              { onSuccess: () => resolve(), onError: (e) => reject(e) },
            ),
          );
        } else if (action === 'rewrite') {
          // Drop the source, then let the parent open the form in next month
          await new Promise<void>((resolve, reject) =>
            statusMutation.mutate(
              { id: priority.id, status: 'dropped', month_key: priority.month_key },
              { onSuccess: () => resolve(), onError: (e) => reject(e) },
            ),
          );
          onRewrite?.(priority);
          onClose();
          return; // exit early; rewrite trigger supersedes remaining actions
        }
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const allActioned = activePriorities.every((p) => actions[p.id] != null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Month-End Review</Text>
          <Text style={styles.headerSub}>{monthLabel}</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {activePriorities.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>All priorities are already resolved.</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.instruction}>
              Choose an action for each open priority before closing this month.
            </Text>
            <FlatList
              data={activePriorities}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const action = actions[item.id] ?? null;
                const canCarry = canCarryForward(item);
                return (
                  <View style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.rowStatus}>{MP_STATUS_LABELS[item.status]}</Text>
                    </View>
                    <View style={styles.actionBtns}>
                      <ActionBtn
                        label="✓ Complete"
                        active={action === 'complete'}
                        color={colors.green[600]}
                        activeBg={colors.green[100]}
                        onPress={() => setAction(item.id, action === 'complete' ? null : 'complete')}
                      />
                      <ActionBtn
                        label="↩ Carry"
                        active={action === 'carry_forward'}
                        color={colors.blue[600]}
                        activeBg={colors.blue[100]}
                        onPress={() => setAction(item.id, action === 'carry_forward' ? null : 'carry_forward')}
                        disabled={!canCarry}
                      />
                      <ActionBtn
                        label="✎ Rewrite"
                        active={action === 'rewrite'}
                        color={colors.violet[600]}
                        activeBg={colors.violet[100]}
                        onPress={() => setAction(item.id, action === 'rewrite' ? null : 'rewrite')}
                      />
                      <ActionBtn
                        label="✕ Drop"
                        active={action === 'drop'}
                        color={colors.red[600]}
                        activeBg={colors.red[100]}
                        onPress={() => setAction(item.id, action === 'drop' ? null : 'drop')}
                      />
                    </View>
                    {!canCarry && item.linked_project_id && (
                      <Text style={styles.carryDisabledHint}>
                        Linked project is not active — cannot carry forward.
                      </Text>
                    )}
                  </View>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={styles.listContent}
            />

            {/* Footer actions */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.skipBtn} onPress={onClose} disabled={saving}>
                <Text style={styles.skipBtnText}>Skip Review</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyBtn, (!allActioned || saving) && styles.applyBtnDisabled]}
                onPress={handleApply}
                disabled={!allActioned || saving}
              >
                <Text style={styles.applyBtnText}>
                  {saving ? 'Saving…' : 'Apply Actions'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function ActionBtn({
  label,
  active,
  color,
  activeBg,
  onPress,
  disabled = false,
}: {
  label: string;
  active: boolean;
  color: string;
  activeBg: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        active && { backgroundColor: activeBg, borderColor: color },
        disabled && styles.actionBtnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionBtnText, active && { color, fontWeight: '700' }, disabled && styles.actionBtnTextDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    backgroundColor: '#FFFFFF',
    gap: 2,
  },
  headerTitle: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
  },
  headerSub: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[500],
  },
  errorBox: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.red[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.red[200],
  },
  errorText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.red[600] },
  instruction: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.xl },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },
  rowInfo: { gap: 2 },
  rowTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  rowStatus: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
  actionBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionBtn: {
    flex: 1,
    minWidth: 72,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  carryDisabledHint: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.amber[700],
    fontStyle: 'italic',
    paddingTop: spacing.xs,
  },
  actionBtnDisabled: { borderColor: colors.gray[100], backgroundColor: colors.gray[50] },
  actionBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.ink.light,
  },
  actionBtnTextDisabled: { color: colors.gray[300] },
  separator: { height: 1, backgroundColor: colors.blue[50] },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.blue[100],
    backgroundColor: '#FFFFFF',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[300],
    alignItems: 'center',
  },
  skipBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.gray[500],
  },
  applyBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
  },
  applyBtnDisabled: { backgroundColor: colors.blue[300] },
  applyBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },
  doneBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.blue[600],
  },
  doneBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
