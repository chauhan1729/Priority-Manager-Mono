"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import {
  canAddAPriority,
  exceedsDailyCapacity,
  groupActivitiesBySection,
  MAX_A_PRIORITY_PER_DAY,
} from "@pm/domain";
import type { Activity, ActivitySection, Contact, Project } from "@pm/types";
import {
  archiveActivity,
  carryForwardActivity,
  delegateActivity,
  deleteActivity,
  postponeActivity,
  updateActivityStatus,
} from "@/app/(app)/activities/actions";
import { showToast } from "@/components/ui/Toaster";
import { CompletionCelebrationModal } from "@/components/ui/CompletionCelebrationModal";
import { ActivitySection as SectionGroup } from "./ActivitySection";
import { AddActivityForm } from "./AddActivityForm";
import { CarryForwardPanel } from "./CarryForwardPanel";
import { EditActivityModal } from "./EditActivityModal";

const SECTION_ORDER: ActivitySection[] = ["work", "outside", "unplanned", "delegated"];

const SECTION_LABELS: Record<ActivitySection, string> = {
  work: "Work",
  outside: "Outside",
  unplanned: "Unplanned / Sudden",
  delegated: "Delegated",
};

/** Adds N days to an ISO date string without timezone shifting. */
function addDays(iso: string, n: number): string {
  const p = iso.split("-");
  const date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
  // Use local-time getters — toISOString() converts to UTC and shifts the date
  // for users in positive UTC offsets (e.g. UTC+5:30 midnight = UTC prev day).
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
  carryForwardActivities: Activity[];
  projects: Pick<Project, "id" | "name" | "status">[];
  contacts: Pick<Contact, "id" | "full_name">[];
  selectedDate: string;
  previousDate: string;
}

export function ActivitiesView({
  activities,
  carryForwardActivities,
  projects,
  contacts,
  selectedDate,
  previousDate,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isPending, startTransition] = useTransition();

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const contactMap = new Map(contacts.map((c) => [c.id, c.full_name]));

  const prevDateStr = addDays(selectedDate, -1);
  const nextDateStr = addDays(selectedDate, 1);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isToday = selectedDate === todayStr;

  const activeActivities = activities.filter((a) => !a.archived);
  const archivedActivities = activities.filter((a) => a.archived);

  const canAddA = canAddAPriority(activeActivities);
  const capacityExceeded = exceedsDailyCapacity(
    activeActivities.filter((a) => a.priority === "A"),
  );
  const grouped = groupActivitiesBySection(activeActivities);

  const STATUS_TOAST_LABELS: Record<string, string> = {
    completed: "Activity completed",
    cancelled: "Activity cancelled",
    working: "Marked as working",
    postponed: "Activity postponed",
    not_started: "Reset to not started",
    delegated: "Marked as delegated",
  };

  function handleStatusChange(
    activityId: string,
    status: string,
    linkedProjectId: string | null,
  ) {
    startTransition(async () => {
      await updateActivityStatus(activityId, status, linkedProjectId);
      if (status === "completed") {
        setShowCelebration(true);
      } else {
        showToast(STATUS_TOAST_LABELS[status] ?? "Status updated");
      }
    });
  }

  function handleDelete(activityId: string, linkedProjectId: string | null) {
    startTransition(async () => {
      await deleteActivity(activityId, linkedProjectId);
      showToast("Activity deleted");
    });
  }

  function handlePostpone(activityId: string, linkedProjectId: string | null) {
    const tomorrowStr = addDays(selectedDate, 1);
    startTransition(async () => {
      const result = await postponeActivity(activityId, tomorrowStr, selectedDate, linkedProjectId);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Activity moved to tomorrow");
      }
    });
  }

  function handleArchive(activityId: string, linkedProjectId: string | null) {
    startTransition(async () => {
      await archiveActivity(activityId, linkedProjectId);
      showToast("Activity archived");
    });
  }

  function handleDelegate(activityId: string, contactId: string, linkedProjectId: string | null) {
    startTransition(async () => {
      const result = await delegateActivity(activityId, contactId, linkedProjectId);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Activity delegated");
      }
    });
  }

  function handleCarryForward(activityId: string, linkedProjectId: string | null) {
    startTransition(async () => {
      const result = await carryForwardActivity(activityId, previousDate, selectedDate, linkedProjectId);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Activity moved to today");
      }
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-blue-100 px-6 py-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-handwriting text-2xl text-ink">Activities</h1>

            {/* Date navigation */}
            <div className="flex items-center gap-0.5 rounded-lg border border-blue-100 bg-white px-1 py-0.5">
              <Link
                href={`/activities?date=${prevDateStr}`}
                className="rounded px-2 py-1 text-sm text-ink-light hover:bg-blue-50 hover:text-blue-700 transition"
                aria-label="Previous day"
              >
                ←
              </Link>
              <span className="min-w-[120px] text-center text-sm font-medium text-ink px-1">
                {formatHeaderDate(selectedDate)}
              </span>
              <Link
                href={`/activities?date=${nextDateStr}`}
                className="rounded px-2 py-1 text-sm text-ink-light hover:bg-blue-50 hover:text-blue-700 transition"
                aria-label="Next day"
              >
                →
              </Link>
            </div>

            {!isToday && (
              <Link href="/activities" className="text-xs text-blue-600 hover:underline">
                Today
              </Link>
            )}
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            {showAddForm ? "Cancel" : "+ Add Activity"}
          </button>
        </div>

        {/* Capacity / priority warnings */}
        {capacityExceeded && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
            ⚠ A-priority workload exceeds realistic daily capacity.
          </p>
        )}
        {!canAddA && (
          <p className="mt-2 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-1.5">
            ✕ Max {MAX_A_PRIORITY_PER_DAY} A-priority activities reached for this day.
          </p>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 space-y-5">
        {/* Add form */}
        {showAddForm && (
          <AddActivityForm
            selectedDate={selectedDate}
            projects={projects}
            contacts={contacts}
            onSuccess={() => setShowAddForm(false)}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Carry-forward panel (previous day's incomplete) */}
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

        {/* Section groups */}
        {SECTION_ORDER.map((sectionId) => {
          const items = grouped[sectionId];
          return (
            <SectionGroup
              key={sectionId}
              sectionId={sectionId}
              sectionLabel={SECTION_LABELS[sectionId]}
              activities={items}
              projectMap={projectMap}
              contactMap={contactMap}
              contacts={contacts}
              isPending={isPending}
              onStatusChange={handleStatusChange}
              onDelegate={handleDelegate}
              onDelete={handleDelete}
              onPostpone={handlePostpone}
              onEdit={setEditActivity}
              onArchive={handleArchive}
            />
          );
        })}

        {/* Archived activities */}
        {archivedActivities.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived((s) => !s)}
              className="text-[11px] font-semibold text-ink-light uppercase tracking-wide hover:text-blue-600 transition"
            >
              {showArchived ? "▾" : "▸"} Archived · {archivedActivities.length}
            </button>
            {showArchived && (
              <div className="mt-2 space-y-2">
                {archivedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 opacity-60"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-ink-light line-through truncate">{activity.title}</span>
                      <span className="ml-2 text-xs text-ink-light/60">{activity.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {activeActivities.length === 0 && !showAddForm && (
          <div className="rounded-xl border border-dashed border-blue-100 bg-white px-6 py-14 text-center text-sm text-ink-light">
            No activities for {formatHeaderDate(selectedDate).toLowerCase()}.
            <br />
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 text-blue-600 hover:underline text-sm"
            >
              Add one now
            </button>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editActivity && (
        <EditActivityModal
          activity={editActivity}
          projects={projects}
          onClose={() => setEditActivity(null)}
        />
      )}

      {/* Completion celebration */}
      {showCelebration && (
        <CompletionCelebrationModal onClose={() => setShowCelebration(false)} />
      )}
    </div>
  );
}
