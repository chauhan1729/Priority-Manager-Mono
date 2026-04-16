import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScheduleBlock, PX_PER_MIN, TIMELINE_START_HOUR, minutesFromTimelineStart } from './ScheduleBlock';
import type { ScheduleBlockInfo } from './ScheduleBlockModal';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';
import { todayISO } from '../../lib/dateUtils';

const TIMELINE_END_HOUR = 24;
const TOTAL_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;
const TOTAL_MINUTES = TOTAL_HOURS * 60;
const TIMELINE_HEIGHT = TOTAL_MINUTES * PX_PER_MIN;
const HOUR_HEIGHT = 60 * PX_PER_MIN;

interface TimelineBlock {
  instanceId: string;
  title: string;
  startAt: string;
  endAt: string;
  statusSnapshot: string | null;
  priority?: string | null | undefined;
  projectName?: string | undefined;
  contactName?: string | undefined;
  sourceType: string;
  activityId?: string | null | undefined;
  focusMinutes?: number | null | undefined;
  scheduleDate: string;
}

interface Props {
  blocks: TimelineBlock[];
  selectedDate: string;
  projectMap: Map<string, string>;
  contactMap: Map<string, string>;
  onBlockPress: (info: ScheduleBlockInfo) => void;
  onSlotPress?: (startTimeISO: string) => void;
  canSchedule?: boolean;
}

export function DailyTimeline({ blocks, selectedDate, projectMap, contactMap, onBlockPress, onSlotPress, canSchedule }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const isToday = selectedDate === todayISO();

  // Auto-scroll: to current time on today, to 6 AM on other dates
  useEffect(() => {
    const scrollHour = isToday
      ? (new Date().getHours() - TIMELINE_START_HOUR) + new Date().getMinutes() / 60
      : 6 - TIMELINE_START_HOUR;
    const targetY = Math.max(0, scrollHour * HOUR_HEIGHT - 80);
    setTimeout(() => scrollRef.current?.scrollTo({ y: targetY, animated: true }), 300);
  }, [isToday, selectedDate]);

  // Current time indicator position
  const now = new Date();
  const currentMinFromStart = (now.getHours() - TIMELINE_START_HOUR) * 60 + now.getMinutes();
  const currentTimeTop = currentMinFromStart * PX_PER_MIN;
  const showCurrentTime = isToday && currentMinFromStart >= 0 && currentMinFromStart <= TOTAL_MINUTES;

  function handleSlotPress(locationY: number) {
    if (!onSlotPress || !canSchedule) return;
    // Convert Y position within the timeline to a snapped 15-min start time
    const totalMinutes = locationY / PX_PER_MIN;
    const snapped = Math.round(totalMinutes / 15) * 15;
    const hours = Math.floor(snapped / 60) % 24;
    const mins = snapped % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    onSlotPress(`${selectedDate}T${hh}:${mm}:00`);
  }

  return (
    <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={(e) => handleSlotPress(e.nativeEvent.locationY)}>
      <View style={[styles.container, { height: TIMELINE_HEIGHT }]}>
        {/* Hour markers */}
        {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
          const hour = TIMELINE_START_HOUR + i;
          const top = i * HOUR_HEIGHT;
          const label =
            hour === 0 || hour === 24 ? '12 AM' :
            hour === 12 ? '12 PM' :
            hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
          return (
            <View key={hour} style={[styles.hourRow, { top }]}>
              <Text style={styles.hourLabel}>{label}</Text>
              <View style={styles.hourLine} />
            </View>
          );
        })}

        {/* Current time indicator */}
        {showCurrentTime && (
          <View style={[styles.currentTimeLine, { top: currentTimeTop }]}>
            <View style={styles.currentTimeDot} />
            <View style={styles.currentTimeBar} />
          </View>
        )}

        {/* Schedule blocks */}
        {blocks.map((b) => {
          const topMin = minutesFromTimelineStart(b.startAt);
          // Skip blocks outside visible range
          if (topMin < 0 || topMin > TOTAL_MINUTES) return null;
          return (
            <ScheduleBlock
              key={b.instanceId}
              instanceId={b.instanceId}
              title={b.title}
              startAt={b.startAt}
              endAt={b.endAt}
              statusSnapshot={b.statusSnapshot}
              priority={b.priority as 'A' | 'B' | null}
              projectName={b.projectName}
              contactName={b.contactName}
              sourceType={b.sourceType}
              onPress={() =>
                onBlockPress({
                  instanceId: b.instanceId,
                  activityId: b.activityId ?? null,
                  title: b.title,
                  startAt: b.startAt,
                  endAt: b.endAt,
                  focusMinutes: b.focusMinutes ?? null,
                  statusSnapshot: b.statusSnapshot,
                  sourceType: b.sourceType,
                  scheduleDate: b.scheduleDate,
                })
              }
            />
          );
        })}
      </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: {
    position: 'relative',
    marginLeft: spacing.xs,
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    width: 48,
    fontFamily: fontFamily.sans,
    fontSize: 10,
    color: colors.gray[400],
    textAlign: 'right',
    paddingRight: spacing.xs,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[100],
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red[500],
    marginLeft: 44,
  },
  currentTimeBar: {
    flex: 1,
    height: 2,
    backgroundColor: colors.red[400],
  },
});
