import React, { useState } from 'react';
import {
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Activity } from '@pm/types';
import { useActivitiesForDate, usePreviousDayIncomplete, useCarryForwardActivity } from '../../src/hooks/useActivities';
import { useScheduleInstancesForDate } from '../../src/hooks/useScheduleInstances';
import { useMeetingsForDate } from '../../src/hooks/useMeetings';
import { useActiveProjects } from '../../src/hooks/useProjects';
import { useContacts } from '../../src/hooks/useContacts';
import { DailyTimeline } from '../../src/components/daily-plan/DailyTimeline';
import { ScheduleModal } from '../../src/components/daily-plan/ScheduleModal';
import { ScheduleBlockModal } from '../../src/components/daily-plan/ScheduleBlockModal';
import type { ScheduleBlockInfo } from '../../src/components/daily-plan/ScheduleBlockModal';
import { SlotScheduleModal } from '../../src/components/daily-plan/SlotScheduleModal';
import { PostponeModal } from '../../src/components/daily-plan/PostponeModal';
import { Badge } from '../../src/components/ui/Badge';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Toast, useToast } from '../../src/components/ui/Toast';
import { colors } from '../../src/theme/colors';
import { borderRadius, spacing } from '../../src/theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../src/theme/typography';
import { addDays, formatHeaderDate, todayISO } from '../../src/lib/dateUtils';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DailyPlanScreen() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [scheduleTarget, setScheduleTarget] = useState<Activity | null>(null);
  const [activeBlock, setActiveBlock] = useState<ScheduleBlockInfo | null>(null);
  const [postponeActivityId, setPostponeActivityId] = useState<string | null>(null);
  const [slotStartISO, setSlotStartISO] = useState<string | null>(null);
  const [carryCollapsed, setCarryCollapsed] = useState(false);
  const [view, setView] = useState<'timeline' | 'list'>('timeline');

  const today = todayISO();
  const previousDate = addDays(selectedDate, -1);
  const canSchedule = selectedDate >= today;

  const { toastProps, show: showToast } = useToast();

  // Data
  const { data: activities = [] } = useActivitiesForDate(selectedDate);
  const { data: instances = [] } = useScheduleInstancesForDate(selectedDate);
  const { data: meetings = [] } = useMeetingsForDate(selectedDate);
  const { data: prevIncomplete = [] } = usePreviousDayIncomplete(previousDate);
  const { data: projects = [] } = useActiveProjects();
  const { data: contacts = [] } = useContacts();
  const carryForward = useCarryForwardActivity();

  // Lookup maps
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const contactMap = new Map(contacts.map((c) => [c.id, c.full_name]));

  // Scheduled activity IDs
  const scheduledActivityIds = new Set(
    instances
      .filter((i: any) => i.source_type === 'activity' && i.source_activity_id)
      .map((i: any) => i.source_activity_id as string)
  );

  // Unscheduled active activities for this date
  const unscheduled = activities.filter(
    (a) => !a.archived && a.status !== 'completed' && a.status !== 'cancelled' && !scheduledActivityIds.has(a.id)
  );

  // A-priority gate: if any A-priority activity is unscheduled, block others from scheduling
  const hasUnscheduledA = unscheduled.some((a) => a.priority === 'A');

  // Capacity
  const totalScheduledMin = instances.reduce((sum: number, i: any) => sum + (i.locked_minutes ?? 0), 0);
  const totalScheduledHours = (totalScheduledMin / 60).toFixed(1);
  const totalActivityMin = activities.filter((a) => !a.archived).reduce((s, a) => s + a.estimated_minutes, 0);
  const totalActivityHours = (totalActivityMin / 60).toFixed(1);

  // Timeline blocks — merge schedule instances + meetings
  const timelineBlocks = [
    ...instances.map((i: any) => ({
      instanceId: i.id,
      title: i.activity?.title ?? i.meeting?.title ?? 'Block',
      startAt: i.start_at,
      endAt: i.end_at,
      statusSnapshot: i.status_snapshot,
      priority: i.activity?.priority ?? null,
      projectName: i.activity?.linked_project_id ? projectMap.get(i.activity.linked_project_id) : undefined,
      contactName: i.meeting?.linked_contact_id ? contactMap.get(i.meeting.linked_contact_id) : undefined,
      sourceType: i.source_type,
      activityId: i.source_activity_id ?? null,
      focusMinutes: i.focus_minutes ?? null,
      scheduleDate: selectedDate,
    })),
  ];

  function handleCarryForward(activity: Activity) {
    carryForward.mutate(
      { activityId: activity.id, fromDate: previousDate, toDate: selectedDate },
      {
        onSuccess: () => showToast('Activity moved to today'),
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      }
    );
  }

  function handleSchedulePress(activity: Activity) {
    if (hasUnscheduledA && activity.priority !== 'A') {
      showToast('Schedule your A-priority activities first', 'error');
      return;
    }
    setScheduleTarget(activity);
  }

  // Carry-forward panel (shared between timeline + list views)
  const carryPanel = prevIncomplete.length > 0 ? (
    <View style={styles.carryPanel}>
      <TouchableOpacity
        style={styles.carryHeader}
        onPress={() => setCarryCollapsed((v) => !v)}
      >
        <Text style={styles.carryTitle}>
          {carryCollapsed ? '▸' : '▾'} Carry Forward ({prevIncomplete.length})
        </Text>
      </TouchableOpacity>
      {!carryCollapsed && prevIncomplete.map((a) => (
        <View key={a.id} style={styles.carryItem}>
          <Text style={styles.carryItemTitle} numberOfLines={1}>{a.title}</Text>
          <TouchableOpacity style={styles.carryBtn} onPress={() => handleCarryForward(a)}>
            <Text style={styles.carryBtnText}>→ Today</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Date navigation header */}
      <View style={styles.header}>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => setSelectedDate(addDays(selectedDate, -1))} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{formatHeaderDate(selectedDate)}</Text>
          <TouchableOpacity onPress={() => setSelectedDate(addDays(selectedDate, 1))} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          {selectedDate !== today && (
            <TouchableOpacity onPress={() => setSelectedDate(today)}>
              <Text style={styles.todayLink}>Today</Text>
            </TouchableOpacity>
          )}
          {/* View toggle */}
          <TouchableOpacity onPress={() => setView(view === 'timeline' ? 'list' : 'timeline')} style={styles.viewToggle}>
            <Text style={styles.viewToggleText}>{view === 'timeline' ? 'List' : 'Timeline'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Capacity bar: hours + item counts */}
      <View style={styles.capacityBar}>
        <Text style={styles.capacityText}>
          {totalScheduledHours}h scheduled · {totalActivityHours}h planned
        </Text>
        <Text style={styles.countText}>
          {instances.length} blocks · {unscheduled.length} unscheduled
        </Text>
      </View>

      {/* A-priority gate banner (when applicable, in both views) */}
      {hasUnscheduledA && (
        <View style={styles.aPriorityBanner}>
          <Text style={styles.aPriorityText}>
            Schedule your A-priority activities first before scheduling others.
          </Text>
        </View>
      )}

      {view === 'timeline' ? (
        /* ---- Timeline view ---- */
        <View style={styles.timelineContainer}>
          {carryPanel}

          <DailyTimeline
            blocks={timelineBlocks}
            selectedDate={selectedDate}
            projectMap={projectMap}
            contactMap={contactMap}
            onBlockPress={setActiveBlock}
            canSchedule={canSchedule}
            {...(canSchedule ? { onSlotPress: setSlotStartISO } : {})}
          />
        </View>
      ) : (
        /* ---- List view ---- */
        <SectionList
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          sections={[
            { key: 'unscheduled', label: 'Unscheduled', data: unscheduled },
            { key: 'scheduled', label: 'Scheduled', data: instances as any[] },
          ].filter((s) => s.key === 'unscheduled' ? unscheduled.length > 0 : instances.length > 0)}
          ListHeaderComponent={carryPanel}
          ListEmptyComponent={
            <EmptyState message="No activities planned for this day" />
          }
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.label} count={section.data.length} />
          )}
          keyExtractor={(item) => item.id ?? item.instanceId ?? Math.random().toString()}
          renderItem={({ item, section }) => {
            if (section.key === 'unscheduled') {
              const activity = item as Activity;
              const isAPriorityBlocked = hasUnscheduledA && activity.priority !== 'A';
              return (
                <View style={styles.unscheduledItem}>
                  <View style={styles.unscheduledLeft}>
                    {activity.priority ? <Badge variant={activity.priority} /> : null}
                    <View style={styles.unscheduledInfo}>
                      <Text style={styles.unscheduledTitle} numberOfLines={1}>{activity.title}</Text>
                      <Text style={styles.unscheduledMeta}>
                        {(activity.remaining_minutes / 60).toFixed(1)}h remaining
                        {activity.linked_project_id && projectMap.get(activity.linked_project_id)
                          ? ` · ${projectMap.get(activity.linked_project_id)}`
                          : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.unscheduledActions}>
                    {/* Postpone button */}
                    <TouchableOpacity
                      style={styles.postponeBtn}
                      onPress={() => setPostponeActivityId(activity.id)}
                      hitSlop={6}
                    >
                      <Text style={styles.postponeBtnText}>📅</Text>
                    </TouchableOpacity>
                    {/* Schedule button */}
                    <TouchableOpacity
                      style={[styles.scheduleBtn, (isAPriorityBlocked || !canSchedule) && styles.scheduleBtnDim]}
                      onPress={() => handleSchedulePress(activity)}
                      disabled={isAPriorityBlocked || !canSchedule}
                    >
                      <Text style={styles.scheduleBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            // Scheduled instance rows
            const inst = item as any;
            return (
              <TouchableOpacity
                style={styles.scheduledItem}
                onPress={() => setActiveBlock({
                  instanceId: inst.id,
                  activityId: inst.source_activity_id ?? null,
                  title: inst.activity?.title ?? inst.meeting?.title ?? 'Block',
                  startAt: inst.start_at,
                  endAt: inst.end_at,
                  focusMinutes: inst.focus_minutes ?? null,
                  statusSnapshot: inst.status_snapshot,
                  sourceType: inst.source_type,
                  scheduleDate: selectedDate,
                })}
              >
                <Text style={styles.scheduledTime}>
                  {new Date(inst.start_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.scheduledTitle} numberOfLines={1}>
                  {inst.activity?.title ?? inst.meeting?.title ?? 'Block'}
                </Text>
                {inst.status_snapshot ? <Badge variant={inst.status_snapshot as any} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Schedule modal (unscheduled → schedule) */}
      <ScheduleModal
        activity={scheduleTarget}
        scheduleDate={selectedDate}
        onClose={() => setScheduleTarget(null)}
        onSuccess={() => { setScheduleTarget(null); showToast('Added to timeline'); }}
      />

      {/* Slot schedule modal (tap empty timeline area → pick activity + time) */}
      <SlotScheduleModal
        slotStartISO={slotStartISO}
        unscheduledActivities={unscheduled}
        projectMap={projectMap}
        scheduleDate={selectedDate}
        onClose={() => setSlotStartISO(null)}
        onSuccess={() => { setSlotStartISO(null); showToast('Added to timeline'); }}
      />

      {/* Block detail modal */}
      <ScheduleBlockModal
        block={activeBlock}
        onClose={() => setActiveBlock(null)}
        onCompleted={() => showToast('🎉 Activity completed!')}
        onPostpone={(activityId) => {
          setActiveBlock(null);
          setPostponeActivityId(activityId);
        }}
      />

      {/* Postpone modal */}
      <PostponeModal
        activityId={postponeActivityId}
        currentDate={selectedDate}
        onClose={() => setPostponeActivityId(null)}
        onSuccess={() => { setPostponeActivityId(null); showToast('Activity postponed'); }}
      />

      <Toast {...toastProps} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.md,
    backgroundColor: '#FFFFFF',
  },
  navBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  navArrow: { fontSize: 22, color: colors.ink.light, lineHeight: 26 },
  dateLabel: {
    minWidth: 110,
    textAlign: 'center',
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.ink.DEFAULT,
    paddingHorizontal: spacing.xs,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  todayLink: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.blue[600], textDecorationLine: 'underline' },
  viewToggle: {
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  viewToggleText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.blue[600] },
  // Capacity bar
  capacityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.blue[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  capacityText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.blue[700] },
  countText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.blue[500] },
  // A-priority gate banner
  aPriorityBanner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.amber[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.amber[200],
  },
  aPriorityText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.amber[700] },
  // Layout
  timelineContainer: { flex: 1 },
  listContent: { padding: spacing.lg, paddingBottom: 60 },
  // Carry-forward
  carryPanel: {
    backgroundColor: colors.blue[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
  },
  carryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  carryTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.blue[700] },
  carryItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.blue[100],
  },
  carryItemTitle: { flex: 1, fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.ink.DEFAULT },
  carryBtn: { backgroundColor: colors.blue[600], borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  carryBtnText: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: '#FFFFFF' },
  // Unscheduled item (list view)
  unscheduledItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  unscheduledLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  unscheduledInfo: { flex: 1, minWidth: 0 },
  unscheduledTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT },
  unscheduledMeta: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.ink.light, marginTop: 2 },
  unscheduledActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  postponeBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.blue[100], borderRadius: borderRadius.sm, backgroundColor: '#FFFFFF',
  },
  postponeBtnText: { fontSize: 14 },
  scheduleBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.blue[600], borderRadius: borderRadius.sm,
  },
  scheduleBtnDim: { opacity: 0.35 },
  scheduleBtnText: { fontSize: 20, color: '#FFFFFF', fontWeight: '300', lineHeight: 28 },
  // Scheduled item (list view)
  scheduledItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  scheduledTime: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.gray[500], width: 52 },
  scheduledTitle: { flex: 1, fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT },
});
