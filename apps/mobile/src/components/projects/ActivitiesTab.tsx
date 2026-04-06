import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Activity } from '@pm/types';
import { useUpdateActivityStatus, useArchiveActivity, useDeleteActivity } from '../../hooks/useActivities';
import { useContacts } from '../../hooks/useContacts';
import { ProjectActivityFormModal } from './ProjectActivityFormModal';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

type SubTab = 'active' | 'delegated' | 'archived';

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  postponed: 'Postponed',
  delegated: 'Delegated',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  not_started: { bg: colors.gray[100],   text: colors.gray[600] },
  in_progress: { bg: colors.blue[100],   text: colors.blue[700] },
  completed:   { bg: colors.green[100],  text: colors.green[700] },
  postponed:   { bg: colors.amber[100],  text: colors.amber[700] },
  delegated:   { bg: colors.purple[100], text: colors.purple[700] },
  cancelled:   { bg: colors.red[100],    text: colors.red[600] },
};

interface Props {
  projectId: string;
  activities: Activity[];
}

export function ActivitiesTab({ projectId, activities }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('active');
  const [addFormVisible, setAddFormVisible] = useState(false);

  const updateStatus = useUpdateActivityStatus();
  const archiveActivity = useArchiveActivity();
  const deleteActivity = useDeleteActivity();
  const { data: contacts = [] } = useContacts();

  const contactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c.full_name])),
    [contacts],
  );

  const { active, delegated, archived } = useMemo(() => {
    const active = activities.filter(
      (a) => !a.archived && a.section_type !== 'delegated',
    );
    const delegated = activities.filter(
      (a) => !a.archived && a.section_type === 'delegated',
    );
    const archived = activities.filter((a) => a.archived);
    return { active, delegated, archived };
  }, [activities]);

  const displayedActivities =
    activeSubTab === 'active' ? active :
    activeSubTab === 'delegated' ? delegated :
    archived;

  const handleStatusChange = (activity: Activity) => {
    const NEXT_STATUS: Record<string, string> = {
      not_started: 'in_progress',
      in_progress: 'completed',
      completed: 'not_started',
      postponed: 'in_progress',
      delegated: 'completed',
      cancelled: 'not_started',
    };
    const nextStatus = NEXT_STATUS[activity.status] ?? 'in_progress';
    updateStatus.mutate({ activityId: activity.id, status: nextStatus });
  };

  const handleArchive = (activity: Activity) => {
    Alert.alert('Archive Activity', `Archive "${activity.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: () => archiveActivity.mutate({ activityId: activity.id }),
      },
    ]);
  };

  const handleDelete = (activity: Activity) => {
    Alert.alert('Delete Activity', `Delete "${activity.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteActivity.mutate({ activityId: activity.id, linkedProjectId: projectId }),
      },
    ]);
  };

  const renderItem = ({ item }: { item: Activity }) => {
    const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.not_started;
    const dateLabel = new Date(item.activity_date + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const contactName = item.delegated_contact_id
      ? contactMap.get(item.delegated_contact_id)
      : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardBody}>
            <Text style={styles.activityTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.activityMeta}>
              {dateLabel} · {Math.round(item.estimated_minutes / 60 * 10) / 10}h
              {item.priority ? ` · ${item.priority}` : ''}
            </Text>
            {contactName ? (
              <Text style={styles.contactName}>{contactName}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {!item.archived && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleStatusChange(item)}
            >
              <Text style={styles.actionBtnText}>Toggle Status</Text>
            </TouchableOpacity>
          )}
          {!item.archived && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => handleArchive(item)}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>Archive</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => handleDelete(item)}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sub-tab bar */}
      <View style={styles.subTabBar}>
        {(['active', 'delegated', 'archived'] as SubTab[]).map((tab) => {
          const count =
            tab === 'active' ? active.length :
            tab === 'delegated' ? delegated.length :
            archived.length;
          const isSelected = activeSubTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.subTab, isSelected && styles.subTabActive]}
              onPress={() => setActiveSubTab(tab)}
            >
              <Text style={[styles.subTabText, isSelected && styles.subTabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddFormVisible(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Activity list */}
      <FlatList
        data={displayedActivities}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No {activeSubTab === 'archived' ? 'archived' : activeSubTab} activities.
            </Text>
          </View>
        }
      />

      <ProjectActivityFormModal
        visible={addFormVisible}
        projectId={projectId}
        onClose={() => setAddFormVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.xs,
    backgroundColor: '#FFFFFF',
  },
  subTab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  subTabActive: { backgroundColor: colors.blue[100] },
  subTabText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.light },
  subTabTextActive: { color: colors.blue[700], fontWeight: '600' },
  addBtn: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.blue[600],
  },
  addBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '600', color: '#FFFFFF' },
  listContent: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, gap: spacing.sm },
  cardBody: { flex: 1, gap: 3 },
  activityTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '500', color: colors.ink.DEFAULT },
  activityMeta: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.ink.light },
  contactName: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.blue[600] },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full, flexShrink: 0 },
  statusText: { fontFamily: fontFamily.sans, fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
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
  actionBtnSecondary: {},
  actionBtnDanger: {},
  actionBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: '500', color: colors.blue[600] },
  actionBtnTextSecondary: { color: colors.ink.light },
  actionBtnTextDanger: { color: colors.red[600] },
  empty: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.gray[400] },
});
