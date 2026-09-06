"use client";

import { useEffect, useState, useTransition } from "react";

import { shouldPromptEnergyChange } from "@pm/domain";
import type { Cycle } from "@pm/types";
import {
  abandonCycleAction,
  breakCycle,
  completeCycleAction,
  resumeCycleAction,
  startOrResumeCycle,
} from "@/app/(app)/cycles/actions";
import { showToast } from "@/components/ui/Toaster";

interface Props {
  activity: { id: string; title: string };
  onClose: () => void;
}

/** Live elapsed focus seconds, derived from anchors (never an in-memory counter). */
function liveSeconds(cycle: Cycle, nowMs: number): number {
  const banked = cycle.elapsed_focus_minutes * 60;
  if (cycle.phase === "focus" && cycle.segment_started_at) {
    const seg = Math.max(
      0,
      (nowMs - new Date(cycle.segment_started_at).getTime()) / 1000,
    );
    return banked + seg;
  }
  return banked;
}

function fmt(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CyclePanel({ activity, onClose }: Props) {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [note, setNote] = useState("");
  const [energyDismissed, setEnergyDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Start (or resume) a cycle when the panel opens.
  useEffect(() => {
    let active = true;
    startOrResumeCycle(activity.id).then((res) => {
      if (!active) return;
      if ("error" in res) {
        showToast(res.error, "error");
        onClose();
      } else {
        setCycle(res.cycle);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [activity.id, onClose]);

  // Tick once a second while in focus so the count-up display advances.
  useEffect(() => {
    if (cycle?.phase !== "focus") return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cycle?.phase]);

  function apply(promise: Promise<{ cycle: Cycle } | { error: string }>) {
    startTransition(async () => {
      const res = await promise;
      if ("error" in res) showToast(res.error, "error");
      else setCycle(res.cycle);
    });
  }

  const elapsed = cycle ? liveSeconds(cycle, nowMs) : 0;
  const showEnergy =
    cycle &&
    !energyDismissed &&
    shouldPromptEnergyChange(cycle, new Date(nowMs).toISOString());
  const isCompleted = cycle?.phase === "completed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-blue-100 bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-light">
              Cycle
            </p>
            <h3 className="truncate text-sm font-medium text-ink">
              {activity.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-light hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading || !cycle ? (
          <p className="py-10 text-center text-sm text-ink-light">
            Starting cycle…
          </p>
        ) : isCompleted ? (
          <div className="py-8 text-center">
            {/* Notebook-style completion stamp (handwritten accent) */}
            <p className="font-handwriting text-2xl text-green-600">
              Cycle completed ✓
            </p>
            <p className="mt-1 text-sm text-ink-light">
              {cycle.elapsed_focus_minutes} min of focus
              {cycle.break_count > 0
                ? ` · ${cycle.break_count} break${cycle.break_count === 1 ? "" : "s"}`
                : ""}
            </p>
            {cycle.note && (
              <p className="mt-2 text-xs italic text-ink-light">
                “{cycle.note}”
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Count-up display */}
            <div className="py-6 text-center">
              <p className="font-mono text-5xl tabular-nums text-ink">
                {fmt(elapsed)}
              </p>
              <p className="mt-1 text-xs text-ink-light">
                {cycle.phase === "break"
                  ? "On a break — resume when ready"
                  : "Focusing"}
                {cycle.soft_target_minutes
                  ? ` · ~${cycle.soft_target_minutes}m target`
                  : ""}
              </p>
            </div>

            {/* ~20-min energy-change nudge */}
            {showEnergy && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span>
                  Change your energy — stand up, move, or switch tasks.
                </span>
                <button
                  onClick={() => setEnergyDismissed(true)}
                  className="text-amber-600 hover:text-amber-800"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Optional acknowledgment note */}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="What did you get done? (optional)"
              className="mb-3 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
            />

            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              {cycle.phase === "focus" ? (
                <button
                  onClick={() => apply(breakCycle(cycle.id))}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  Mini-break
                </button>
              ) : (
                <button
                  onClick={() => apply(resumeCycleAction(cycle.id))}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  Resume
                </button>
              )}
              <button
                onClick={() => apply(completeCycleAction(cycle.id, note))}
                disabled={isPending}
                className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Complete cycle
              </button>
            </div>
            <button
              onClick={() => apply(abandonCycleAction(cycle.id))}
              disabled={isPending}
              className="mt-2 w-full text-center text-xs text-ink-light hover:text-red-500"
            >
              Discard cycle
            </button>
          </>
        )}
      </div>
    </div>
  );
}
