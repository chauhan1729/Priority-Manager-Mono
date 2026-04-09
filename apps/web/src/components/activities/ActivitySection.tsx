"use client";

import type { Activity, ActivitySection as SectionType, Contact } from "@pm/types";
import { ActivityCard } from "./ActivityCard";

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Props {
  sectionId: SectionType;
  sectionLabel: string;
  activities: Activity[];
  projectMap: Map<string, string>;
  contactMap: Map<string, string>;
  contacts: Pick<Contact, "id" | "full_name">[];
  isPending: boolean;
  projectPriorityMap?: Map<string, string | null>;
  bulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onStatusChange: (id: string, status: string, projectId: string | null) => void;
  onDelegate: (id: string, contactId: string, projectId: string | null) => void;
  onDelete: (id: string, projectId: string | null) => void;
  onPostpone: (id: string, projectId: string | null) => void;
  onEdit: (activity: Activity) => void;
  onArchive: (id: string, projectId: string | null) => void;
}

export function ActivitySection({
  sectionId,
  sectionLabel,
  activities,
  projectMap,
  contactMap,
  contacts,
  isPending,
  projectPriorityMap = new Map(),
  bulkMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  onStatusChange,
  onDelegate,
  onDelete,
  onPostpone,
  onEdit,
  onArchive,
}: Props) {
  if (activities.length === 0) return null;

  const totalMinutes = activities.reduce((s, a) => s + a.estimated_minutes, 0);
  const completed = activities.filter((a) => a.status === "completed").length;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-2.5">
        <h2 className="text-xs font-semibold text-ink-light uppercase tracking-widest whitespace-nowrap">
          {sectionLabel}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-light">
          <span>
            {activities.length} {activities.length === 1 ? "task" : "tasks"}
          </span>
          <span className="opacity-40">·</span>
          <span>{formatMinutes(totalMinutes)}</span>
          {completed > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-green-600 font-medium">{completed} done</span>
            </>
          )}
        </div>
        <div className="flex-1 h-px bg-blue-50" />
      </div>

      {/* Activity cards */}
      <div className="space-y-2">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            projectMap={projectMap}
            contactMap={contactMap}
            contacts={contacts}
            isPending={isPending}
            projectPriorityMap={projectPriorityMap}
            bulkMode={bulkMode}
            isSelected={selectedIds.has(activity.id)}
            onToggleSelect={onToggleSelect}
            onStatusChange={onStatusChange}
            onDelegate={onDelegate}
            onDelete={onDelete}
            onPostpone={onPostpone}
            onEdit={onEdit}
            onArchive={onArchive}
          />
        ))}
      </div>
    </div>
  );
}
