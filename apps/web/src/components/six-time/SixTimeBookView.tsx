"use client";

import { useOptimistic, useState, useTransition } from "react";

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
    button: string;
    badge: string;
    row: string;
  }
> = {
  best: {
    panel: "border-emerald-200/70 bg-emerald-50/40",
    label: "text-emerald-700",
    field: "border-emerald-200 bg-white focus:border-emerald-400 focus:ring-emerald-100",
    button: "bg-emerald-600 hover:bg-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
    row: "border-emerald-100",
  },
  worst: {
    panel: "border-rose-200/70 bg-rose-50/40",
    label: "text-rose-700",
    field: "border-rose-200 bg-white focus:border-rose-400 focus:ring-rose-100",
    button: "bg-rose-600 hover:bg-rose-700",
    badge: "bg-rose-100 text-rose-700",
    row: "border-rose-100",
  },
};

const TONE_META: { tone: Tone; title: string; hint: string; placeholder: string }[] = [
  {
    tone: "best",
    title: "✨ Best of the day",
    hint: "Wins to savour — focus on these before sleep.",
    placeholder: "e.g. Helped a colleague unblock their work",
  },
  {
    tone: "worst",
    title: "🔧 Worst of the day",
    hint: "Slips to note — no blame, just seeds to change.",
    placeholder: "e.g. Snapped at someone when tired",
  },
];

// ---------------------------------------------------------------------------
function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// One saved reflection — wraps (not truncates) so longer notes stay readable.
function ItemRow({ text, tone, onDelete }: { text: string; tone: Tone; onDelete?: (() => void) | undefined }) {
  const s = TONES[tone];
  return (
    <div className={`flex items-start justify-between gap-2 rounded-lg border ${s.row} bg-white px-3 py-2`}>
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-ink">{text}</p>
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label="Delete"
          title="Delete"
          className="shrink-0 rounded p-1 text-ink-light hover:bg-red-50 hover:text-red-500"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A Best/Worst card on the log view: existing rows + a Giving-style add box.
function ToneSection({
  tone,
  title,
  hint,
  placeholder,
  items,
  editable,
  onAdd,
  onDelete,
}: {
  tone: Tone;
  title: string;
  hint: string;
  placeholder: string;
  items: string[];
  editable: boolean;
  onAdd: (text: string) => void;
  onDelete: (index: number) => void;
}) {
  const s = TONES[tone];
  const [text, setText] = useState("");

  function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    onAdd(t);
  }

  return (
    <section className={`space-y-2 rounded-2xl border ${s.panel} p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-semibold ${s.label}`}>{title}</h3>
          <p className="text-[11px] text-ink-light">{hint}</p>
        </div>
        {items.length > 0 && (
          <span className={`rounded-full ${s.badge} px-2 py-0.5 text-[11px] font-semibold`}>{items.length}</span>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((v, i) => (
            <ItemRow key={i} text={v} tone={tone} onDelete={editable ? () => onDelete(i) : undefined} />
          ))}
        </div>
      )}

      {editable && (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder={placeholder}
            onKeyDown={(e) => e.key === "Enter" && text.trim() && add()}
            className={`flex-1 rounded-lg border ${s.field} px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:ring-2`}
          />
          <button
            onClick={add}
            disabled={!text.trim()}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${s.button} disabled:opacity-50`}
          >
            Add
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// History: every recorded night, most recent first (read-only view).
function History({ reviews }: { reviews: SixTimeNightlyReview[] }) {
  const nights = reviews
    .filter((r) => (r.best?.length ?? 0) > 0 || (r.worst?.length ?? 0) > 0)
    .slice()
    .sort((a, b) => b.review_date.localeCompare(a.review_date));

  if (nights.length === 0) {
    return (
      <div className="rounded-2xl border border-blue-100 bg-white p-8 text-center">
        <p className="text-sm text-ink-light">No nights recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {nights.map((r) => (
        <div key={r.id} className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4">
          <p className="text-sm font-medium text-ink">{prettyDate(r.review_date)}</p>
          {TONE_META.map(({ tone, title }) => {
            const items = tone === "best" ? r.best : r.worst;
            if (!items || items.length === 0) return null;
            return (
              <div key={tone} className="space-y-1.5">
                <h4 className={`text-[11px] font-semibold uppercase tracking-wide ${TONES[tone].label}`}>
                  {title}
                </h4>
                {items.map((v, i) => (
                  <ItemRow key={i} text={v} tone={tone} />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function SixTimeBookView({
  today,
  reviews,
}: {
  today: string;
  reviews: SixTimeNightlyReview[];
}) {
  const [showReading, setShowReading] = useState(false);
  const [view, setView] = useState<"log" | "history">("log");
  // Which night entries are recorded against — defaults to today, but can be set
  // back to any earlier night to backfill a review you missed.
  const [logDate, setLogDate] = useState(today);
  const [, start] = useTransition();

  const byDate = new Map(reviews.map((r) => [r.review_date, r]));
  const current = byDate.get(logDate) ?? null;
  const best = current?.best ?? [];
  const worst = current?.worst ?? [];

  // Optimistic mirror of the selected night so add/delete land instantly while
  // the upsert + revalidation happen in the background. Re-seeds from props
  // (server truth) on every render, so it self-heals if a save fails.
  type Optimistic = { best: string[]; worst: string[] };
  type Mutation =
    | { kind: "add"; tone: Tone; text: string }
    | { kind: "delete"; tone: Tone; index: number };
  const [entries, applyOptimistic] = useOptimistic(
    { best, worst } as Optimistic,
    (state: Optimistic, m: Mutation): Optimistic => {
      if (m.kind === "add") {
        return m.tone === "best"
          ? { ...state, best: [...state.best, m.text] }
          : { ...state, worst: [...state.worst, m.text] };
      }
      return m.tone === "best"
        ? { ...state, best: state.best.filter((_, i) => i !== m.index) }
        : { ...state, worst: state.worst.filter((_, i) => i !== m.index) };
    },
  );

  // Persist the full arrays for `logDate` (upsert). Read-modify-write keeps the
  // existing array schema while giving Giving-style per-item add/delete.
  function persist(mutation: Mutation, nextBest: string[], nextWorst: string[]) {
    start(async () => {
      applyOptimistic(mutation);
      const res = await saveNightlyReview(logDate, nextBest, nextWorst, today);
      if (res?.error) showToast(res.error, "error");
    });
  }

  function addItem(tone: Tone, text: string) {
    if (tone === "best") persist({ kind: "add", tone, text }, [...best, text], worst);
    else persist({ kind: "add", tone, text }, best, [...worst, text]);
  }

  function deleteItem(tone: Tone, index: number) {
    if (tone === "best") persist({ kind: "delete", tone, index }, best.filter((_, i) => i !== index), worst);
    else persist({ kind: "delete", tone, index }, best, worst.filter((_, i) => i !== index));
  }

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
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Tonight (add) vs History (full record) */}
          <div className="flex w-fit gap-1 rounded-lg border border-blue-100 bg-white p-0.5 text-sm">
            {(["log", "history"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  view === v ? "bg-indigo-600 text-white" : "text-ink-light hover:bg-blue-50"
                }`}
              >
                {v === "log" ? "Tonight" : "History"}
              </button>
            ))}
          </div>

          {view === "history" ? (
            <History reviews={reviews} />
          ) : (
            <>
              {/* Log date — defaults to today; pick an earlier night to backfill. */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-3">
                <label htmlFor="review-date" className="text-xs font-medium text-ink-light">
                  Reviewing
                </label>
                <input
                  id="review-date"
                  type="date"
                  value={logDate}
                  max={today}
                  onChange={(e) => setLogDate(e.target.value || today)}
                  className="rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-blue-400 focus:outline-none"
                />
                <span className="text-xs text-ink-light">· {prettyDate(logDate)}</span>
                {logDate !== today && (
                  <button
                    type="button"
                    onClick={() => setLogDate(today)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Back to today
                  </button>
                )}
              </div>

              <p className="rounded-lg bg-indigo-50/60 px-3 py-2 text-xs text-ink-light">
                No guilt — just track what happened. By tracking, you change.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                {TONE_META.map(({ tone, title, hint, placeholder }) => (
                  <ToneSection
                    key={tone}
                    tone={tone}
                    title={title}
                    hint={hint}
                    placeholder={placeholder}
                    items={tone === "best" ? entries.best : entries.worst}
                    editable
                    onAdd={(text) => addItem(tone, text)}
                    onDelete={(index) => deleteItem(tone, index)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showReading && <ReadingsModal onClose={() => setShowReading(false)} />}
    </div>
  );
}
