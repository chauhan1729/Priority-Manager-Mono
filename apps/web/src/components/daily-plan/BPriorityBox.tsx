"use client";

import { useState } from "react";

import type { Activity } from "@pm/types";

/**
 * Phase 0A/4: the day's B activities as a collapsible "choose if you have time" menu on the Daily Plan.
 * B's are never scheduled onto the timeline or promoted to A — you just pick one and start a cycle.
 */
type CycleSummary = { count: number; done: number; focusMin: number };

export function BPriorityBox({
  activities,
  projectMap,
  isPending,
  cycleSummary,
  onStartCycle,
  onComplete,
}: {
  activities: Activity[];
  projectMap: Map<string, string>;
  isPending: boolean;
  cycleSummary: Map<string, CycleSummary>;
  onStartCycle: (activity: Activity) => void;
  onComplete: (activity: Activity) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (activities.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 border-b border-blue-50 text-left hover:bg-blue-50/40 transition"
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-ink-light uppercase tracking-wide">
            B&apos;s — if you have time
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-light">
              {activities.length} {activities.length === 1 ? "item" : "items"}
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className={`h-4 w-4 text-ink-light transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <polyline
                points="5,7 10,13 15,7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-1.5">
          {activities.map((a) => {
            const projectName = a.linked_project_id
              ? (projectMap.get(a.linked_project_id) ?? null)
              : null;
            const cy = cycleSummary.get(a.id);
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-blue-50 bg-paper p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="flex-shrink-0 rounded bg-blue-100 px-1 py-0.5 text-[10px] font-bold text-blue-700">
                      B
                    </span>
                    <span className="text-xs font-medium text-ink truncate">
                      {a.title}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-light">
                    {projectName && (
                      <span className="text-blue-600 truncate">
                        {projectName}
                      </span>
                    )}
                    {cy && (
                      <span title="Cycles for this activity today">
                        ◷ {cy.count} {cy.count === 1 ? "cycle" : "cycles"}
                        {cy.done > 0 ? ` · ${cy.done} done` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() => onStartCycle(a)}
                    disabled={isPending}
                    title="Start a focus cycle"
                    className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition"
                  >
                    ◷ Cycle
                  </button>
                  <button
                    onClick={() => onComplete(a)}
                    disabled={isPending}
                    aria-label="Mark complete"
                    title="Mark activity complete"
                    className="rounded p-1 text-ink-light hover:bg-green-50 hover:text-green-600 disabled:opacity-50 transition"
                  >
                    ✓
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
