"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { HORIZON_DAYS, todayISO } from "@pm/domain";
import type { Activity, Project } from "@pm/types";
import {
  createSomedayActivity,
  deleteActivity,
  pullIntoHorizon,
  type ActionResult,
} from "@/app/(app)/activities/actions";
import { showToast } from "@/components/ui/Toaster";

function SomedayRow({ item }: { item: Activity }) {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(todayISO());
  const [showPull, setShowPull] = useState(false);

  function handlePull() {
    startTransition(async () => {
      const res = await pullIntoHorizon(item.id, date);
      if (res?.error) showToast(res.error, "error");
      else showToast("Pulled into the next 30 days");
    });
  }

  return (
    <div className="rounded-xl border border-blue-50 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{item.title}</p>
          {item.note && <p className="mt-0.5 text-xs italic text-ink-light">“{item.note}”</p>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            onClick={() => setShowPull((s) => !s)}
            disabled={isPending}
            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            Pull in
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                await deleteActivity(item.id, item.linked_project_id);
                showToast("Deleted");
              })
            }
            disabled={isPending}
            aria-label="Delete"
            title="Delete"
            className="rounded p-1 text-ink-light hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            ×
          </button>
        </div>
      </div>
      {showPull && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-blue-100 px-2 py-1 text-xs text-ink focus:border-blue-400 focus:outline-none"
          />
          <button
            onClick={handlePull}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

export function SomedayView({
  items,
  projects,
}: {
  items: Activity[];
  projects: Pick<Project, "id" | "name" | "status">[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(createSomedayActivity, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
      showToast("Added to Someday");
    }
  }, [state]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-blue-100 px-6 py-5 md:px-8">
        <h1 className="font-handwriting text-2xl text-ink">Someday</h1>
        <p className="mt-0.5 text-xs text-ink-light">
          Things that don&apos;t fit in the next {HORIZON_DAYS} days. Review weekly; pull anything ready into
          your horizon.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 space-y-4">
        {/* Quick add — title + optional project */}
        <form ref={formRef} action={formAction} className="flex flex-wrap gap-2">
          <input
            name="title"
            type="text"
            required
            placeholder="Add a someday item…"
            className="min-w-[180px] flex-1 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
          />
          {projects.length > 0 && (
            <select
              name="linked_project_id"
              defaultValue=""
              className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add
          </button>
        </form>
        {state && "error" in state && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
        )}

        {/* List */}
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-light">
            Nothing parked. Items you&apos;re not ready to schedule live here.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <SomedayRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
