"use client";

import { useState, useTransition } from "react";

import type { SixTimeNightlyReview } from "@pm/types";
import { saveNightlyReview } from "@/app/(app)/six-time-book/actions";
import { showToast } from "@/components/ui/Toaster";
import { ReadingsModal } from "./ReadingsModal";

type Tone = "best" | "worst";

const TONES: Record<
  Tone,
  {
    panel: string;
    label: string;
    field: string;
    add: string;
    badge: string;
  }
> = {
  best: {
    panel: "border-emerald-200/70 bg-emerald-50/40",
    label: "text-emerald-700",
    field:
      "border-emerald-200 bg-white focus:border-emerald-400 focus:ring-emerald-100",
    add: "border-emerald-300 text-emerald-700 hover:bg-emerald-100/70",
    badge: "bg-emerald-100 text-emerald-700",
  },
  worst: {
    panel: "border-rose-200/70 bg-rose-50/40",
    label: "text-rose-700",
    field: "border-rose-200 bg-white focus:border-rose-400 focus:ring-rose-100",
    add: "border-rose-300 text-rose-700 hover:bg-rose-100/70",
    badge: "bg-rose-100 text-rose-700",
  },
};

// ---------------------------------------------------------------------------
// A dynamic list of reflection entries (Best / Worst) with add / remove.
// ---------------------------------------------------------------------------
function EntryList({
  title,
  hint,
  tone,
  items,
  setItems,
}: {
  title: string;
  hint: string;
  tone: Tone;
  items: string[];
  setItems: (next: string[]) => void;
}) {
  const s = TONES[tone];
  const filled = items.filter((x) => x.trim()).length;

  const update = (i: number, v: string) => setItems(items.map((x, xi) => (xi === i ? v : x)));
  const add = () => setItems([...items, ""]);
  const remove = (i: number) => setItems(items.length > 1 ? items.filter((_, xi) => xi !== i) : [""]);

  return (
    <section className={`rounded-2xl border ${s.panel} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-semibold ${s.label}`}>{title}</h3>
          <p className="text-[11px] text-ink-light">{hint}</p>
        </div>
        {filled > 0 && (
          <span className={`rounded-full ${s.badge} px-2 py-0.5 text-[11px] font-semibold`}>{filled}</span>
        )}
      </div>

      <div className="space-y-2.5">
        {items.map((v, i) => (
          <div key={i} className="relative">
            <textarea
              value={v}
              onChange={(e) => update(i, e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Be specific — what happened, and when…"
              className={`w-full resize-y rounded-xl border ${s.field} px-3 py-2 pr-9 text-sm leading-snug text-ink placeholder:text-ink-light/50 focus:outline-none focus:ring-2`}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove entry"
              className="absolute right-1.5 top-1.5 rounded-md p-1 text-ink-light/50 transition hover:bg-black/5 hover:text-ink-light"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className={`mt-2.5 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed ${s.add} py-2 text-xs font-medium transition`}
      >
        <span className="text-base leading-none">＋</span> Add another
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main view — the nightly review
// ---------------------------------------------------------------------------
export function SixTimeBookView({
  today,
  nightly,
}: {
  today: string;
  nightly: SixTimeNightlyReview | null;
}) {
  const [showReading, setShowReading] = useState(false);
  const [best, setBest] = useState<string[]>(nightly?.best?.length ? nightly.best : [""]);
  const [worst, setWorst] = useState<string[]>(nightly?.worst?.length ? nightly.worst : [""]);
  const [isPending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveNightlyReview(today, best, worst);
      if (res?.error) showToast(res.error, "error");
      else showToast("Nightly review saved");
    });
  }

  const prettyDate = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-indigo-50/40 to-transparent">
      <header className="border-b border-blue-100 bg-white/60 px-6 py-5 backdrop-blur md:px-8">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-handwriting text-2xl text-ink">Nightly Review</h1>
            <p className="mt-0.5 text-xs text-ink-light">
              Before sleep — your best and worst of the day, free of judgment.
            </p>
          </div>
          <button
            onClick={() => setShowReading(true)}
            className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            📖 Daily reading
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
            {/* Card header strip */}
            <div className="flex items-center justify-between gap-3 border-b border-blue-50 bg-indigo-50/40 px-5 py-3 md:px-6">
              <p className="text-sm font-medium text-ink">{prettyDate}</p>
              <p className="hidden text-xs text-ink-light sm:block">
                No guilt — just track what happened. By tracking, you change.
              </p>
            </div>

            <div className="p-5 md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <EntryList
                  title="✨ Best of today"
                  hint="Wins to savour — focus on these before sleep."
                  tone="best"
                  items={best}
                  setItems={setBest}
                />
                <EntryList
                  title="🔧 Worst of today"
                  hint="Slips to note — no blame, just seeds to change."
                  tone="worst"
                  items={worst}
                  setItems={setWorst}
                />
              </div>

              <div className="mt-6 flex items-center justify-end">
                <button
                  onClick={save}
                  disabled={isPending}
                  className="rounded-full bg-indigo-600 px-7 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Save review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showReading && <ReadingsModal onClose={() => setShowReading(false)} />}
    </div>
  );
}
