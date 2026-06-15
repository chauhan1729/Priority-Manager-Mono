"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import type { Activity, CalendarEvent, Meeting, Project, ScheduleInstance, ScheduleInstanceStatus } from "@pm/types";
import { carryForwardActivity, updateActivityStatus } from "@/app/(app)/activities/actions";
import {
  ensureAppointmentInstance,
  postponeFromDailyPlan,
  scheduleActivity,
  startCycleBlock,
  unscheduleActivity,
  unscheduleRunningBlock,
  updateScheduleBlockStatus,
} from "@/app/(app)/daily-plan/actions";
import { showToast } from "@/components/ui/Toaster";
import { CompletionCelebrationModal } from "@/components/ui/CompletionCelebrationModal";
import { CarryForwardPanel } from "@/components/activities/CarryForwardPanel";
import { BPriorityBox } from "./BPriorityBox";
import { StartCycleModal } from "./StartCycleModal";
import { DailyTimeline } from "./DailyTimeline";
import { ScheduleBlockModal } from "./ScheduleBlockModal";
import { ScheduleModal } from "./ScheduleModal";
import { SlotScheduleModal } from "./SlotScheduleModal";
import { UnscheduledList } from "./UnscheduledList";

/** Adds N days to an ISO date string using local-time getters (no UTC shift). */
function addDays(iso: string, n: number): string {
  const p = iso.split("-");
  const date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatHeaderDate(iso: string): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (iso === todayStr) return "Today";
  const tomorrow = addDays(todayStr, 1);
  const yesterday = addDays(todayStr, -1);
  if (iso === tomorrow) return "Tomorrow";
  if (iso === yesterday) return "Yesterday";
  const p = iso.split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface Props {
  activities: Activity[];
  scheduleInstances: ScheduleInstance[];
  meetings: Meeting[];
  calendarEvents: CalendarEvent[];
  carryForwardActivities: Activity[];
  projects: Pick<Project, "id" | "name" | "status">[];
  selectedDate: string;
  previousDate: string;
}

export function DailyPlanView({
  activities,
  scheduleInstances,
  meetings,
  calendarEvents,
  carryForwardActivities,
  projects,
  selectedDate,
  previousDate,
}: Props) {
  const [scheduleTarget, setScheduleTarget] = useState<Activity | null>(null);
  const [blockModalTarget, setBlockModalTarget] = useState<ScheduleInstance | null>(null);
  const [slotStartTime, setSlotStartTime] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isPending, startTransition] = useTransition();

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const activityMap = new Map(activities.map((a) => [a.id, a]));
  const meetingMap = new Map(meetings.map((m) => [m.id, m]));
  const eventMap = new Map(calendarEvents.map((e) => [e.id, e]));

  const prevDateStr = addDays(selectedDate, -1);
  const nextDateStr = addDays(selectedDate, 1);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isToday = selectedDate === todayStr;

  // Unscheduled = on this date + not done.
  // Bug §11: include activities with remaining_minutes === 0 that are NOT completed —
  // they can still be scheduled for extra overwork time.
  // Bug §10: remaining is computed as max(0, estimated - hours_worked) for display.
  const [cycleTarget, setCycleTarget] = useState<{
    id: string;
    title: string;
    estimatedMinutes: number;
  } | null>(null);

  const unscheduled = activities.filter(
    (a) =>
      a.status !== "completed" &&
      a.status !== "cancelled",
  );
  // Phase 4: Daily Plan schedules A's only; B's live in a collapsible box (never scheduled or promoted).
  const unscheduledA = unscheduled.filter((a) => a.priority === "A");
  const dayBs = unscheduled.filter((a) => a.priority !== "A");

  // Phase 4: each activity's cycles = its schedule blocks. Summarize count/completed/focus per activity.
  const cycleSummary = new Map<string, { count: number; done: number; focusMin: number }>();
  for (const si of scheduleInstances) {
    if (si.source_type !== "activity" || !si.source_activity_id) continue;
    const s = cycleSummary.get(si.source_activity_id) ?? { count: 0, done: 0, focusMin: 0 };
    s.count += 1;
    if (si.status_snapshot === "completed") s.done += 1;
    s.focusMin += si.focus_minutes ?? si.locked_minutes ?? 0;
    cycleSummary.set(si.source_activity_id, s);
  }

  function handleCompleteActivity(activity: Activity) {
    startTransition(async () => {
      await updateActivityStatus(activity.id, "completed", activity.linked_project_id);
      showToast("Activity completed");
    });
  }

  function handleStartCycle(activity: Activity) {
    setCycleTarget({
      id: activity.id,
      title: activity.title,
      estimatedMinutes: activity.estimated_minutes,
    });
  }

  // Open an appointment occurrence (materialize a per-day schedule_instance so it can be managed/completed).
  function handleAppointmentClick(ev: CalendarEvent) {
    if (!ev.start_at || !ev.end_at) return;
    const startAt = ev.start_at;
    const endAt = ev.end_at;
    const sourceType = ev.event_type === "appointment" ? "appointment" : "other";
    startTransition(async () => {
      const res = await ensureAppointmentInstance(ev.id, selectedDate, startAt, endAt, sourceType);
      if ("error" in res) showToast(res.error, "error");
      else setBlockModalTarget(res.instance);
    });
  }

  function handleStartCycleBlock(activityId: string, minutes: number, note: string) {
    startTransition(async () => {
      const result = await startCycleBlock(activityId, minutes, note);
      if (result && "error" in result) showToast(result.error, "error");
      else {
        showToast("Cycle started — block placed on the timeline");
        setCycleTarget(null);
      }
    });
  }

  function handleCarryForward(activityId: string, linkedProjectId: string | null) {
    startTransition(async () => {
      await carryForwardActivity(activityId, previousDate, selectedDate, linkedProjectId);
      showToast("Activity moved to today");
    });
  }

  function handleSchedule(activityId: string, startAt: string, endAt: string, focusMinutes: number) {
    startTransition(async () => {
      const result = await scheduleActivity(activityId, selectedDate, startAt, endAt, focusMinutes);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Activity scheduled");
        setScheduleTarget(null);
        setSlotStartTime(null);
      }
    });
  }

  function handleUnschedule(instanceId: string, activityId: string) {
    startTransition(async () => {
      const result = await unscheduleActivity(instanceId, activityId);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Block removed");
        setBlockModalTarget(null);
      }
    });
  }

  function handleBlockStatusUpdate(instanceId: string, status: ScheduleInstanceStatus) {
    startTransition(async () => {
      const result = await updateScheduleBlockStatus(instanceId, status);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        setBlockModalTarget(null);
        if (status === "completed") {
          setShowCelebration(true);
        } else {
          showToast("Status updated");
        }
      }
    });
  }

  function handleUnscheduleRunning(instanceId: string, activityId: string, mode: "full" | "split") {
    startTransition(async () => {
      const result = await unscheduleRunningBlock(instanceId, activityId, mode);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast(mode === "full" ? "Block removed" : "Elapsed time logged, remainder unscheduled");
        setBlockModalTarget(null);
      }
    });
  }

  function handlePostpone(activityId: string, toDate: string, linkedProjectId: string | null) {
    startTransition(async () => {
      const result = await postponeFromDailyPlan(activityId, toDate, selectedDate, linkedProjectId);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Activity moved");
        setBlockModalTarget(null);
      }
    });
  }

  // Activity / meeting for the block modal
  const blockModalActivity = blockModalTarget?.source_activity_id
    ? (activityMap.get(blockModalTarget.source_activity_id) ?? null)
    : null;
  const blockModalMeeting = blockModalTarget?.source_meeting_id
    ? (meetingMap.get(blockModalTarget.source_meeting_id) ?? null)
    : null;
  const blockModalEvent = blockModalTarget?.source_event_id
    ? (eventMap.get(blockModalTarget.source_event_id) ?? null)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-blue-100 px-4 py-3 md:px-8 md:py-4">
        {/* Row 1: Page title */}
        <h1 className="hidden md:block font-handwriting text-2xl text-ink mb-2">Daily Plan</h1>

        {/* Row 2: Date nav + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Date navigation */}
            <div className="flex items-center gap-0.5 rounded-lg border border-blue-100 bg-white px-1 py-0.5">
              <Link
                href={`/daily-plan?date=${prevDateStr}`}
                className="rounded px-2 py-1 text-sm text-ink-light hover:bg-blue-50 hover:text-blue-700 transition"
                aria-label="Previous day"
              >
                ←
              </Link>
              <span className="min-w-[110px] text-center text-sm font-medium text-ink px-1">
                {formatHeaderDate(selectedDate)}
              </span>
              <Link
                href={`/daily-plan?date=${nextDateStr}`}
                className="rounded px-2 py-1 text-sm text-ink-light hover:bg-blue-50 hover:text-blue-700 transition"
                aria-label="Next day"
              >
                →
              </Link>
            </div>

            {!isToday && (
              <Link href="/daily-plan" className="text-xs text-blue-600 hover:underline">
                Today
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-ink-light">
              {scheduleInstances.length} scheduled · {unscheduled.length} unscheduled
            </span>
            <a
              href={`/daily-plan/print?date=${selectedDate}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-ink-light hover:border-blue-400 hover:text-ink transition"
              title="Print / Save as PDF"
            >
              ⎙ PDF
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 space-y-5">
        {/* Carry-forward panel */}
        {carryForwardActivities.length > 0 && (
          <CarryForwardPanel
            activities={carryForwardActivities}
            projectMap={projectMap}
            fromDate={previousDate}
            toDate={selectedDate}
            isPending={isPending}
            onCarryForward={handleCarryForward}
          />
        )}

        {/* Main: timeline + unscheduled — stacked on mobile, side-by-side on lg+ */}
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Unscheduled list — collapsible on mobile, always visible on lg+ */}
          <div className="lg:order-2 lg:w-80 lg:flex-shrink-0 space-y-4">
            <UnscheduledList
              activities={unscheduledA}
              projectMap={projectMap}
              selectedDate={selectedDate}
              isPending={isPending}
              cycleSummary={cycleSummary}
              onSchedule={(activity) => setScheduleTarget(activity)}
              onMoveToDate={handlePostpone}
              onComplete={handleCompleteActivity}
              collapsibleOnMobile
            />
            <BPriorityBox
              activities={dayBs}
              projectMap={projectMap}
              isPending={isPending}
              cycleSummary={cycleSummary}
              onStartCycle={handleStartCycle}
              onComplete={handleCompleteActivity}
            />
          </div>

          {/* Timeline */}
          <div className="lg:order-1 flex-1 min-w-0">
            <DailyTimeline
              scheduleInstances={scheduleInstances}
              activityMap={activityMap}
              projectMap={projectMap}
              meetingMap={meetingMap}
              eventMap={eventMap}
              selectedDate={selectedDate}
              isPending={isPending}
              canSchedule={isToday || selectedDate > todayStr}
              onBlockClick={(instance) => setBlockModalTarget(instance)}
              onAppointmentClick={handleAppointmentClick}
              onSlotClick={(startTime) => setSlotStartTime(startTime)}
            />
          </div>
        </div>
      </div>

      {/* Schedule modal (from unscheduled list) */}
      {scheduleTarget && (
        <ScheduleModal
          activity={scheduleTarget}
          selectedDate={selectedDate}
          onSchedule={handleSchedule}
          onClose={() => setScheduleTarget(null)}
          isPending={isPending}
        />
      )}

      {/* Slot schedule modal (from timeline empty-area click) */}
      {slotStartTime !== null && (
        <SlotScheduleModal
          activities={unscheduledA}
          projectMap={projectMap}
          selectedDate={selectedDate}
          defaultStartTime={slotStartTime}
          isPending={isPending}
          onSchedule={handleSchedule}
          onClose={() => setSlotStartTime(null)}
        />
      )}

      {/* Block management modal */}
      {blockModalTarget && (
        <ScheduleBlockModal
          instance={blockModalTarget}
          activity={blockModalActivity}
          meeting={blockModalMeeting}
          event={blockModalEvent}
          projectName={
            blockModalActivity?.linked_project_id
              ? (projectMap.get(blockModalActivity.linked_project_id) ?? null)
              : null
          }
          isPending={isPending}
          onClose={() => setBlockModalTarget(null)}
          onUnschedule={handleUnschedule}
          onUnscheduleRunning={handleUnscheduleRunning}
          onStatusUpdate={handleBlockStatusUpdate}
          onPostpone={handlePostpone}
          onStartCycle={handleStartCycle}
        />
      )}

      {/* Start a cycle → drops a timed focus block on the timeline (from A blocks or the B's box) */}
      {cycleTarget && (
        <StartCycleModal
          activity={cycleTarget}
          isPending={isPending}
          onStart={(min, note) => handleStartCycleBlock(cycleTarget.id, min, note)}
          onClose={() => setCycleTarget(null)}
        />
      )}

      {/* Completion celebration popup */}
      {showCelebration && (
        <CompletionCelebrationModal onClose={() => setShowCelebration(false)} />
      )}
    </div>
  );
}
