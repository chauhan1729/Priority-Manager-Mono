"use client";

import { useState, useTransition } from "react";

import { expandRecurringMeetings, isMeetingPast, needsStatusUpdatePrompt, needsTakeawayPrompt } from "@pm/domain";
import type { Contact, Meeting, MeetingRecurrenceRule, MeetingStatus } from "@pm/types";

import { showToast } from "@/components/ui/Toaster";
import {
  archiveMeeting,
  createMeeting,
  deleteMeeting,
  updateMeeting,
} from "@/app/(app)/meeting-planner/actions";

import { MeetingCard } from "./MeetingCard";
import { MeetingDetailModal } from "./MeetingDetailModal";
import { MeetingFormModal } from "./MeetingFormModal";

interface Props {
  meetings: Meeting[];
  contacts: Contact[];
}

export function MeetingPlannerView({ meetings, contacts }: Props) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Meeting | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "archived">("upcoming");

  const [isPending, startTransition] = useTransition();

  // Build a contact lookup map for fast card rendering
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const now = new Date();
  const nowISO = now.toISOString();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const ninetyDaysStr = `${ninetyDaysLater.getFullYear()}-${String(ninetyDaysLater.getMonth() + 1).padStart(2, "0")}-${String(ninetyDaysLater.getDate()).padStart(2, "0")}`;

  // Non-archived meetings only for main view
  const activeMeetings = meetings.filter((m) => !m.archived);
  const archivedMeetings = meetings
    .filter((m) => m.archived)
    .sort((a, b) => b.start_at.localeCompare(a.start_at));

  // Separate non-recurring from recurring (active only)
  const nonRecurring = activeMeetings.filter((m) => !m.recurrence_rule);
  const recurring = activeMeetings.filter((m) => !!m.recurrence_rule);

  // Expand recurring meetings for the next 90 days; keep only the first (next) occurrence per meeting
  const expandedRecurring = expandRecurringMeetings(recurring, todayStr, ninetyDaysStr);
  const seenIds = new Set<string>();
  const nextRecurring = expandedRecurring.filter((m) => {
    if (seenIds.has(m.id)) return false;
    seenIds.add(m.id);
    return true;
  });

  // Upcoming = future non-recurring + next occurrence of each recurring
  const upcomingMeetings = [
    ...nonRecurring.filter((m) =>
      m.start_at >= nowISO || (!isMeetingPast(m) && m.status === "upcoming"),
    ),
    ...nextRecurring,
  ].sort((a, b) => a.start_at.localeCompare(b.start_at));

  // Past = non-recurring meetings that have passed
  const pastMeetings = nonRecurring
    .filter((m) => m.start_at < nowISO && isMeetingPast(m))
    .sort((a, b) => b.start_at.localeCompare(a.start_at));

  // Count items that need attention (status prompt or takeaway prompt)
  const attentionCount = activeMeetings.filter(
    (m) => needsStatusUpdatePrompt(m) || needsTakeawayPrompt(m),
  ).length;

  // Find the original meeting record for the selected ID (use base meetings list for edit actions)
  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) ?? null;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleCreate(data: {
    title?: string;
    linked_contact_id?: string;
    date?: string;
    start_time?: string;
    duration_minutes?: number;
    agenda?: string | null;
    recurrence_rule?: MeetingRecurrenceRule;
    key_takeaways?: string | null;
    status?: MeetingStatus;
  }) {
    startTransition(async () => {
      const result = await createMeeting({
        title: data.title!,
        linked_contact_id: data.linked_contact_id!,
        date: data.date!,
        start_time: data.start_time!,
        duration_minutes: data.duration_minutes!,
        agenda: data.agenda ?? null,
        recurrence_rule: data.recurrence_rule ?? null,
      });
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Meeting created");
        setShowCreateForm(false);
      }
    });
  }

  function handleUpdate(data: Parameters<typeof updateMeeting>[1]) {
    if (!editTarget) return;
    const id = editTarget.id;
    startTransition(async () => {
      const result = await updateMeeting(id, data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Meeting updated");
        setEditTarget(null);
      }
    });
  }

  function handleStatusUpdate(status: MeetingStatus, keyTakeaways?: string | null) {
    if (!selectedMeeting) return;
    const id = selectedMeeting.id;
    startTransition(async () => {
      const result = await updateMeeting(id, { status, key_takeaways: keyTakeaways ?? null });
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Status updated");
        setSelectedMeetingId(null);
      }
    });
  }

  function handleSaveTakeaways(keyTakeaways: string) {
    if (!selectedMeeting) return;
    const id = selectedMeeting.id;
    startTransition(async () => {
      const result = await updateMeeting(id, { key_takeaways: keyTakeaways || null });
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Takeaways saved");
      }
    });
  }

  function handleDelete() {
    if (!selectedMeeting) return;
    const id = selectedMeeting.id;
    startTransition(async () => {
      const result = await deleteMeeting(id);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Meeting deleted");
        setSelectedMeetingId(null);
      }
    });
  }

  function handleArchive() {
    if (!selectedMeeting) return;
    const id = selectedMeeting.id;
    startTransition(async () => {
      const result = await archiveMeeting(id);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Meeting archived");
        setSelectedMeetingId(null);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-blue-100 px-4 py-3 md:px-8 md:py-4">
        {/* Row 1: Page title */}
        <h1 className="hidden md:block font-handwriting text-2xl text-ink mb-2">Meeting Planner</h1>

        {/* Row 2: Attention note + Schedule button */}
        <div className="flex items-center justify-between gap-2">
          {attentionCount > 0 ? (
            <p className="text-xs text-orange-600">
              {attentionCount} meeting{attentionCount > 1 ? "s" : ""} need your attention
            </p>
          ) : (
            <span />
          )}
          <button
            onClick={() => setShowCreateForm(true)}
            disabled={isPending}
            className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <span className="hidden sm:inline">+ Schedule Meeting</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      {(activeMeetings.length > 0 || archivedMeetings.length > 0) && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide border-b border-blue-100 px-6 md:px-8">
          {(["upcoming", "past", "archived"] as const).map((tab) => {
            const count = tab === "upcoming" ? upcomingMeetings.length : tab === "past" ? pastMeetings.length : archivedMeetings.length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-ink-light hover:text-ink"
                }`}
              >
                {tab}
                {count > 0 && <span className="ml-1.5 text-xs opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 space-y-6">
        {activeMeetings.length === 0 && archivedMeetings.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <p className="font-handwriting text-2xl text-ink-light mb-2">No meetings yet</p>
            <p className="text-sm text-ink-light mb-6">
              Schedule your first meeting and link it to a contact from Communication Planner.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Schedule your first meeting
            </button>
          </div>
        ) : (
          <>
            {/* Upcoming tab */}
            {activeTab === "upcoming" && (
              <>
                {upcomingMeetings.length === 0 ? (
                  <p className="text-sm text-ink-light py-10 text-center">No upcoming meetings.</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        contact={contactMap.get(meeting.linked_contact_id) ?? null}
                        onClick={() => setSelectedMeetingId(meeting.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Past tab */}
            {activeTab === "past" && (
              <>
                {pastMeetings.length === 0 ? (
                  <p className="text-sm text-ink-light py-10 text-center">No past meetings.</p>
                ) : (
                  <div className="space-y-2">
                    {pastMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        contact={contactMap.get(meeting.linked_contact_id) ?? null}
                        onClick={() => setSelectedMeetingId(meeting.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Archived tab */}
            {activeTab === "archived" && (
              <>
                {archivedMeetings.length === 0 ? (
                  <p className="text-sm text-ink-light py-10 text-center">No archived meetings.</p>
                ) : (
                  <div className="space-y-2">
                    {archivedMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        contact={contactMap.get(meeting.linked_contact_id) ?? null}
                        onClick={() => setSelectedMeetingId(meeting.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Meeting detail modal */}
      {selectedMeeting && !editTarget && (
        <MeetingDetailModal
          meeting={selectedMeeting}
          contact={contactMap.get(selectedMeeting.linked_contact_id) ?? null}
          isPending={isPending}
          onClose={() => setSelectedMeetingId(null)}
          onEdit={() => {
            setEditTarget(selectedMeeting);
            setSelectedMeetingId(null);
          }}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onStatusUpdate={handleStatusUpdate}
          onSaveTakeaways={handleSaveTakeaways}
        />
      )}

      {/* Create meeting modal */}
      {showCreateForm && (
        <MeetingFormModal
          contacts={contacts}
          isPending={isPending}
          onSave={handleCreate}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit meeting modal */}
      {editTarget && (
        <MeetingFormModal
          meeting={editTarget}
          contacts={contacts}
          isPending={isPending}
          onSave={handleUpdate}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
