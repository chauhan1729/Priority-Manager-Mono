"use client";

import { useOptimistic, useState, useTransition } from "react";

import type { SixTimeNightlyReview } from "@pm/types";
import { saveNightlyReview } from "@/app/(app)/karmic/actions";
import { showToast } from "@/components/ui/Toaster";
import { DayBackfillModal, isoAddDays } from "@/components/ui/DayBackfillModal";

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
    field:
      "border-emerald-200 bg-white focus:border-emerald-400 focus:ring-emerald-100",
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

const TONE_META: {
  tone: Tone;
  title: string;
  hint: string;
  placeholder: string;
}[] = [
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

function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// One saved reflection — wraps (not truncates) so longer notes stay readable.
function ItemRow({
  text,
  tone,
  onDelete,
}: {
  text: string;
  tone: Tone;
  onDelete?: (() => void) | undefined;
}) {
  const s = TONES[tone];
  return (
    <div
      className={`flex items-start justify-between gap-2 rounded-lg border ${s.row} bg-white px-3 py-2`}
    >
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-ink">
        {text}
      </p>
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

// A Best/Worst card: existing rows + a Giving-style add box.
function ToneSection({
  tone,
  title,
  hint,
  placeholder,
  items,
  onAdd,
  onDelete,
}: {
  tone: Tone;
  title: string;
  hint: string;
  placeholder: string;
  items: string[];
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
          <span
            className={`rounded-full ${s.badge} px-2 py-0.5 text-[11px] font-semibold`}
          >
            {items.length}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((v, i) => (
            <ItemRow
              key={i}
              text={v}
              tone={tone}
              onDelete={() => onDelete(i)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={placeholder}
          onKeyDown={(e) => e.key === "Enter" && text.trim() && add()}
          className={`min-w-0 flex-1 rounded-lg border ${s.field} px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:ring-2`}
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${s.button} disabled:opacity-50`}
        >
          Add
        </button>
      </div>
    </section>
  );
}

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
        <div
          key={r.id}
          className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4"
        >
          <p className="text-sm font-medium text-ink">
            {prettyDate(r.review_date)}
          </p>
          {TONE_META.map(({ tone, title }) => {
            const items = tone === "best" ? r.best : r.worst;
            if (!items || items.length === 0) return null;
            return (
              <div key={tone} className="space-y-1.5">
                <h4
                  className={`text-[11px] font-semibold uppercase tracking-wide ${TONES[tone].label}`}
                >
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

// The Best/Worst editor for a single night — owns its own optimistic state so it
// can be reused for both today (in the tab) and any past night (in the backfill modal).
function BestWorstEditor({
  date,
  review,
  today,
}: {
  date: string;
  review: SixTimeNightlyReview | null;
  today: string;
}) {
  const [, start] = useTransition();
  const best = review?.best ?? [];
  const worst = review?.worst ?? [];

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

  function persist(
    mutation: Mutation,
    nextBest: string[],
    nextWorst: string[],
  ) {
    start(async () => {
      applyOptimistic(mutation);
      const res = await saveNightlyReview(date, nextBest, nextWorst, today);
      if (res?.error) showToast(res.error, "error");
    });
  }

  function addItem(tone: Tone, text: string) {
    if (tone === "best")
      persist({ kind: "add", tone, text }, [...best, text], worst);
    else persist({ kind: "add", tone, text }, best, [...worst, text]);
  }

  function deleteItem(tone: Tone, index: number) {
    if (tone === "best")
      persist(
        { kind: "delete", tone, index },
        best.filter((_, i) => i !== index),
        worst,
      );
    else
      persist(
        { kind: "delete", tone, index },
        best,
        worst.filter((_, i) => i !== index),
      );
  }

  return (
    <div className="space-y-4">
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
            onAdd={(text) => addItem(tone, text)}
            onDelete={(index) => deleteItem(tone, index)}
          />
        ))}
      </div>
    </div>
  );
}

export function DailyLogTab({
  today,
  reviews,
}: {
  today: string;
  reviews: SixTimeNightlyReview[];
}) {
  const [view, setView] = useState<"log" | "history">("log");
  const yesterday = isoAddDays(today, -1);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillDate, setBackfillDate] = useState(yesterday);

  const byDate = new Map(reviews.map((r) => [r.review_date, r]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex w-fit max-w-full gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-blue-100 bg-white p-0.5 text-sm scrollbar-hide">
          {(["log", "history"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                view === v
                  ? "bg-indigo-600 text-white"
                  : "text-ink-light hover:bg-blue-50"
              }`}
            >
              {v === "log" ? "Tonight" : "History"}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setBackfillDate(yesterday);
            setBackfillOpen(true);
          }}
          className="shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
        >
          📅 Log a past night
        </button>
      </div>

      {view === "history" ? (
        <History reviews={reviews} />
      ) : (
        <BestWorstEditor
          key={today}
          date={today}
          review={byDate.get(today) ?? null}
          today={today}
        />
      )}

      {backfillOpen && (
        <DayBackfillModal
          title="Log a past night"
          subtitle="Backfill a night you missed — the best and worst of that day."
          date={backfillDate}
          onDateChange={setBackfillDate}
          maxDate={yesterday}
          onClose={() => setBackfillOpen(false)}
        >
          <BestWorstEditor
            key={backfillDate}
            date={backfillDate}
            review={byDate.get(backfillDate) ?? null}
            today={today}
          />
        </DayBackfillModal>
      )}
    </div>
  );
}
