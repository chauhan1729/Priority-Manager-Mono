import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PX_PER_MIN } from '../../src/components/daily-plan/ScheduleBlock';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import type { Activity, ActivitySection } from '@pm/types';
import { groupActivitiesBySection } from '@pm/domain';
import { useActivitiesForDate, usePreviousDayIncomplete, useCarryForwardActivity } from '../../src/hooks/useActivities';
import { useScheduleInstancesForDate } from '../../src/hooks/useScheduleInstances';
import { useMeetingsForDate } from '../../src/hooks/useMeetings';
import { useCalendarEventsForDate } from '../../src/hooks/useCalendarEvents';
import { useActiveProjects } from '../../src/hooks/useProjects';
import { useContacts } from '../../src/hooks/useContacts';
import { DailyTimeline } from '../../src/components/daily-plan/DailyTimeline';
import { ScheduleModal } from '../../src/components/daily-plan/ScheduleModal';
import { ScheduleBlockModal } from '../../src/components/daily-plan/ScheduleBlockModal';
import type { ScheduleBlockInfo } from '../../src/components/daily-plan/ScheduleBlockModal';
import { SlotScheduleModal } from '../../src/components/daily-plan/SlotScheduleModal';
import { PostponeModal } from '../../src/components/daily-plan/PostponeModal';
import { Badge } from '../../src/components/ui/Badge';
import { Toast, useToast } from '../../src/components/ui/Toast';
import { CompletionCelebrationModal } from '../../src/components/ui';
import { colors } from '../../src/theme/colors';
import { borderRadius, spacing } from '../../src/theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../src/theme/typography';
import { addDays, formatHeaderDate, todayISO } from '../../src/lib/dateUtils';

const SECTION_ORDER: ActivitySection[] = ['work', 'outside', 'unplanned', 'delegated'];
const SECTION_LABELS: Record<ActivitySection, string> = {
  work: 'Work',
  outside: 'Outside',
  unplanned: 'Unplanned / Sudden',
  delegated: 'Delegated',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DailyPlanScreen() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [scheduleTarget, setScheduleTarget] = useState<Activity | null>(null);
  const [activeBlock, setActiveBlock] = useState<ScheduleBlockInfo | null>(null);
  const [postponeActivityId, setPostponeActivityId] = useState<string | null>(null);
  const [slotStartISO, setSlotStartISO] = useState<string | null>(null);
  const [carryCollapsed, setCarryCollapsed] = useState(false);
  const [unscheduledExpanded, setUnscheduledExpanded] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Timeline scroll management
  const scrollRef = useRef<ScrollView>(null);
  const timelineYRef = useRef<number>(0);

  function scrollToTimelineMinute(minutesFromMidnight: number, animated = true) {
    const targetY = Math.max(0, timelineYRef.current + minutesFromMidnight * PX_PER_MIN - 100);
    scrollRef.current?.scrollTo({ y: targetY, animated });
  }

  function scrollToStartAt(iso: string, animated = true) {
    const d = new Date(iso);
    const minutes = d.getHours() * 60 + d.getMinutes();
    // Defer to let layout settle first (e.g. after modal closes)
    setTimeout(() => scrollToTimelineMinute(minutes, animated), 50);
  }

  const today = todayISO();
  const previousDate = addDays(selectedDate, -1);
  const canSchedule = selectedDate >= today;

  const { toastProps, show: showToast } = useToast();

  // Data
  const { data: activities = [] } = useActivitiesForDate(selectedDate);
  const { data: instances = [] } = useScheduleInstancesForDate(selectedDate);
  const { data: meetings = [] } = useMeetingsForDate(selectedDate);
  const { data: calendarEvents = [] } = useCalendarEventsForDate(selectedDate);
  const { data: prevIncomplete = [] } = usePreviousDayIncomplete(previousDate);
  const { data: projects = [] } = useActiveProjects();
  const { data: contacts = [] } = useContacts();
  const carryForward = useCarryForwardActivity();

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['activities'] }),
      qc.invalidateQueries({ queryKey: ['scheduleInstances'] }),
      qc.invalidateQueries({ queryKey: ['meetings'] }),
      qc.invalidateQueries({ queryKey: ['calendar_events'] }),
    ]);
    setRefreshing(false);
  }

  // Lookup maps
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const contactMap = new Map(contacts.map((c) => [c.id, c.full_name]));
  const meetingMap = new Map(meetings.map((m) => [m.id, m]));
  const eventMap = new Map(calendarEvents.map((e) => [e.id, e]));
  const activityMap = new Map(activities.map((a) => [a.id, a]));

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


  // Timeline blocks — merge schedule instances with meeting + calendar event + activity lookups
  const timelineBlocks = instances.map((i: any) => {
    const linkedActivity = i.source_activity_id ? activityMap.get(i.source_activity_id) : undefined;
    const linkedMeeting = i.source_meeting_id ? meetingMap.get(i.source_meeting_id) : undefined;
    const linkedEvent = i.source_event_id ? eventMap.get(i.source_event_id) : undefined;
    const title =
      linkedActivity?.title ??
      linkedMeeting?.title ??
      linkedEvent?.title ??
      'Block';
    const contactId = linkedMeeting?.linked_contact_id;
    const projectName = linkedActivity?.linked_project_id
      ? projectMap.get(linkedActivity.linked_project_id)
      : undefined;
    return {
      instanceId: i.id,
      title,
      startAt: i.start_at,
      endAt: i.end_at,
      statusSnapshot: i.status_snapshot,
      priority: linkedActivity?.priority ?? null,
      projectName,
      contactName: contactId ? contactMap.get(contactId) : undefined,
      sourceType: i.source_type,
      activityId: i.source_activity_id ?? null,
      focusMinutes: i.focus_minutes ?? null,
      scheduleDate: selectedDate,
      meetingAgenda: linkedMeeting?.agenda ?? null,
    };
  });

  function handleCarryForward(activity: Activity) {
    carryForward.mutate(
      {
        activityId: activity.id,
        fromDate: previousDate,
        toDate: selectedDate,
        linkedProjectId: activity.linked_project_id,
      },
      {
        onSuccess: () => showToast(`Moved to ${formatHeaderDate(selectedDate)}`),
        onError: (e) => showToast(e instanceof Error ? e.message : 'Error', 'error'),
      }
    );
  }

  function handleCarryForwardAll() {
    if (prevIncomplete.length === 0) return;
    Haptics.selectionAsync();
    for (const a of prevIncomplete) {
      carryForward.mutate({
        activityId: a.id,
        fromDate: previousDate,
        toDate: selectedDate,
        linkedProjectId: a.linked_project_id,
      });
    }
    showToast(`${prevIncomplete.length} activities moved`);
  }

  function handleSchedulePress(activity: Activity) {
    if (hasUnscheduledA && activity.priority !== 'A') {
      showToast('Schedule your A-priority activities first', 'error');
      return;
    }
    Haptics.selectionAsync();
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
      {!carryCollapsed && (
        <>
          <TouchableOpacity
            style={styles.moveAllBtn}
            onPress={handleCarryForwardAll}
            disabled={carryForward.isPending}
          >
            <Text style={styles.moveAllBtnText}>↷ Move All to Today</Text>
          </TouchableOpacity>
          {prevIncomplete.map((a) => (
            <View key={a.id} style={styles.carryItem}>
              <Text style={styles.carryItemTitle} numberOfLines={1}>{a.title}</Text>
              <TouchableOpacity style={styles.carryBtn} onPress={() => handleCarryForward(a)}>
                <Text style={styles.carryBtnText}>→ Today</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </View>
  ) : null;

  // Unscheduled grouped by section (rendered in the collapsible UnscheduledPanel below)
  const unscheduledGrouped = useMemo(() => groupActivitiesBySection(unscheduled), [unscheduled]);
  const orderedSections: { key: ActivitySection; label: string; items: Activity[] }[] = SECTION_ORDER
    .filter((s) => unscheduledGrouped[s].length > 0)
    .map((s) => ({ key: s, label: SECTION_LABELS[s], items: unscheduledGrouped[s] }));

  // Auto-scroll to current time (on today) or 8 AM (other days) whenever the date changes
  // and after the timeline's Y offset is known. Runs once after layout completes.
  const didInitialScrollRef = useRef<string | null>(null);
  useEffect(() => {
    if (didInitialScrollRef.current === selectedDate) return;
    if (timelineYRef.current === 0) return; // wait for onLayout
    const target = selectedDate === today
      ? new Date().getHours() * 60 + new Date().getMinutes()
      : 8 * 60;
    scrollToTimelineMinute(target, false);
    didInitialScrollRef.current = selectedDate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, timelineYRef.current]);

  function handleScheduleSuccess(startAt: string) {
    showToast('Added to timeline');
    scrollToStartAt(startAt, true);
  }

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
        </View>
      </View>

      {/* Counts bar */}
      <View style={styles.capacityBar}>
        <Text style={styles.countText}>
          {instances.length} scheduled · {unscheduled.length} unscheduled
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

      {/* Main content: carry-forward panel → unscheduled list (collapsed by default) → timeline */}
      <ScrollView
        ref={scrollRef}
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {carryPanel}

        {/* Collapsible unscheduled list (matches web's mobile layout) */}
        <View style={styles.unscheduledPanel}>
          <TouchableOpacity
            style={styles.unscheduledHeader}
            onPress={() => setUnscheduledExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.unscheduledHeaderTitle}>Unscheduled</Text>
            <View style={styles.unscheduledHeaderRight}>
              <Text style={styles.unscheduledHeaderCount}>{unscheduled.length}</Text>
              <Text style={styles.unscheduledChevron}>{unscheduledExpanded ? '▾' : '▸'}</Text>
            </View>
          </TouchableOpacity>

          {unscheduledExpanded && (
            <View style={styles.unscheduledBody}>
              {hasUnscheduledA && (
                <View style={styles.aPriorityGateMini}>
                  <Text style={styles.aPriorityGateMiniText}>
                    Schedule your A-priority activities first.
                  </Text>
                </View>
              )}
              {orderedSections.length === 0 ? (
                <Text style={styles.unscheduledEmpty}>
                  {canSchedule ? 'All activities scheduled or complete.' : 'Past date — view only.'}
                </Text>
              ) : (
                orderedSections.map((section) => (
                  <View key={section.key} style={styles.sectionGroup}>
                    <Text style={styles.sectionLabel}>{section.label}</Text>
                    {section.items.map((activity) => {
                      const isAPriorityBlocked = hasUnscheduledA && activity.priority !== 'A';
                      const computedRemaining = Math.max(
                        0,
                        activity.estimated_minutes - (activity.hours_worked ?? 0),
                      );
                      const isOverwork = computedRemaining === 0;
                      const projectName = activity.linked_project_id
                        ? projectMap.get(activity.linked_project_id)
                        : undefined;
                      return (
                        <View key={activity.id} style={styles.unscheduledItem}>
                          <View style={styles.unscheduledLeft}>
                            {activity.priority ? <Badge variant={activity.priority} /> : null}
                            <View style={styles.unscheduledInfo}>
                              <View style={styles.unscheduledTitleRow}>
                                <Text style={styles.unscheduledTitle} numberOfLines={1}>
                                  {activity.title}
                                </Text>
                                {activity.moved_from_date ? (
                                  <Text style={styles.movedBadge}>↷ moved</Text>
                                ) : null}
                              </View>
                              <Text style={styles.unscheduledMeta}>
                                {isOverwork ? (
                                  <Text style={styles.overwork}>Extra time (overwork)</Text>
                                ) : (
                                  `${(computedRemaining / 60).toFixed(1)}h remaining`
                                )}
                                {projectName ? ` · ${projectName}` : ''}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.unscheduledActions}>
                            <TouchableOpacity
                              style={styles.postponeBtn}
                              onPress={() => setPostponeActivityId(activity.id)}
                              hitSlop={6}
                            >
                              <Text style={styles.postponeBtnText}>📅</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.scheduleBtn,
                                (isAPriorityBlocked || !canSchedule) && styles.scheduleBtnDim,
                              ]}
                              onPress={() => handleSchedulePress(activity)}
                              disabled={isAPriorityBlocked || !canSchedule}
                            >
                              <Text style={styles.scheduleBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Timeline */}
        <View
          style={styles.timelineWrapper}
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            if (y !== timelineYRef.current) {
              timelineYRef.current = y;
              // Kick off initial auto-scroll once layout is known
              if (didInitialScrollRef.current !== selectedDate) {
                const target = selectedDate === today
                  ? new Date().getHours() * 60 + new Date().getMinutes()
                  : 8 * 60;
                setTimeout(() => scrollToTimelineMinute(target, false), 80);
                didInitialScrollRef.current = selectedDate;
              }
            }
          }}
        >
          <DailyTimeline
            blocks={timelineBlocks}
            selectedDate={selectedDate}
            projectMap={projectMap}
            contactMap={contactMap}
            onBlockPress={setActiveBlock}
            canSchedule={canSchedule}
          />
        </View>
      </ScrollView>

      {/* Schedule modal (unscheduled → schedule) */}
      <ScheduleModal
        activity={scheduleTarget}
        scheduleDate={selectedDate}
        onClose={() => setScheduleTarget(null)}
        onSuccess={(startAt) => { setScheduleTarget(null); handleScheduleSuccess(startAt); }}
      />

      {/* Slot schedule modal (tap empty timeline area → pick activity + time) */}
      <SlotScheduleModal
        slotStartISO={slotStartISO}
        unscheduledActivities={unscheduled}
        projectMap={projectMap}
        scheduleDate={selectedDate}
        onClose={() => setSlotStartISO(null)}
        onSuccess={(startAt) => { setSlotStartISO(null); handleScheduleSuccess(startAt); }}
      />

      {/* Floating "+" button — reliable fallback to open SlotScheduleModal at current time */}
      {canSchedule && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            const now = new Date();
            const mins = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
            const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
            const mm = String(mins % 60).padStart(2, '0');
            Haptics.selectionAsync();
            setSlotStartISO(`${selectedDate}T${hh}:${mm}:00`);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Block detail modal */}
      <ScheduleBlockModal
        block={activeBlock}
        onClose={() => setActiveBlock(null)}
        onCompleted={() => {
          showToast('🎉 Activity completed!');
          setCelebrationVisible(true);
        }}
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

      <CompletionCelebrationModal
        visible={celebrationVisible}
        onClose={() => setCelebrationVisible(false)}
      />
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
  // Counts bar (below the date header)
  capacityBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.blue[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  countText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.blue[600],
    fontWeight: fontWeight.medium,
  },
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
  mainScroll: { flex: 1 },
  mainScrollContent: { paddingBottom: 40 },
  timelineWrapper: {},
  // Unscheduled panel
  unscheduledPanel: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  unscheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  unscheduledHeaderTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.ink.DEFAULT,
  },
  unscheduledHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unscheduledHeaderCount: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.blue[600],
    backgroundColor: colors.blue[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    minWidth: 22,
    textAlign: 'center',
  },
  unscheduledChevron: {
    fontSize: 14,
    color: colors.ink.light,
  },
  unscheduledBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  unscheduledEmpty: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  aPriorityGateMini: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.red[50],
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.red[100],
  },
  aPriorityGateMiniText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.red[600],
  },
  sectionGroup: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
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
  moveAllBtn: {
    backgroundColor: colors.blue[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  moveAllBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#FFFFFF',
  },
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
  unscheduledTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  unscheduledTitle: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.ink.DEFAULT, flexShrink: 1 },
  movedBadge: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    color: colors.amber[600],
    fontWeight: fontWeight.medium,
  },
  unscheduledMeta: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.ink.light, marginTop: 2 },
  overwork: { color: colors.amber[600], fontWeight: fontWeight.semibold },
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
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing['2xl'],
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 32,
    fontWeight: '300',
  },
});
