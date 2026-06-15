"use client";

import { useState, useTransition } from "react";

import { buildDaySlots, isSixTimeSetUp } from "@pm/domain";
import type { SixTimeEntry, SixTimeNightlyReview, SixTimeProblem } from "@pm/types";
import {
  saveNightlyReview,
  saveSixTimeProblem,
  saveSlotEntry,
} from "@/app/(app)/six-time-book/actions";
import { showToast } from "@/components/ui/Toaster";

// ---------------------------------------------------------------------------
// Problem editor (setup + swap)
// ---------------------------------------------------------------------------
function ProblemEditor({ position, existing }: { position: number; existing?: SixTimeProblem | undefined }) {
  const [problem, setProblem] = useState(existing?.problem ?? "");
  const [solution, setSolution] = useState(existing?.solution ?? "");
  const [phrase, setPhrase] = useState(existing?.reminder_phrase ?? "");
  const [isPending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveSixTimeProblem(position, problem, solution, phrase);
      if (res?.error) showToast(res.error, "error");
      else showToast(`Problem ${position} saved`);
    });
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-white p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">Problem {position}</p>
      <input
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
        maxLength={120}
        placeholder="The problem (e.g. I avoid hard conversations)"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
      />
      <input
        value={solution}
        onChange={(e) => setSolution(e.target.value)}
        maxLength={120}
        placeholder="The solution / behavior (e.g. Raise it within 24h)"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
      />
      <input
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        maxLength={120}
        placeholder="Short reminder phrase (shown on each slot)"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {existing ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot card
// ---------------------------------------------------------------------------
const SLOT_ACCENTS = [
  { border: "border-blue-200", bg: "bg-blue-50/50", chip: "bg-blue-100 text-blue-700" },
  { border: "border-violet-200", bg: "bg-violet-50/50", chip: "bg-violet-100 text-violet-700" },
  { border: "border-teal-200", bg: "bg-teal-50/50", chip: "bg-teal-100 text-teal-700" },
];

function SlotCard({
  today,
  slotIndex,
  label,
  problemId,
  entry,
}: {
  today: string;
  slotIndex: number;
  label: string;
  problemId: string;
  entry: SixTimeEntry | null;
}) {
  const [plus, setPlus] = useState(entry?.plus ?? "");
  const [minus, setMinus] = useState(entry?.minus ?? "");
  const [todo, setTodo] = useState(entry?.todo ?? "");
  const [isPending, start] = useTransition();
  const logged = Boolean(entry?.logged_at);

  function save() {
    start(async () => {
      const res = await saveSlotEntry(today, slotIndex, problemId, plus, minus, todo);
      if (res?.error) showToast(res.error, "error");
      else showToast(`Slot ${slotIndex} logged`);
    });
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-white p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-light">{label}</p>
        {logged && <span className="text-[10px] font-medium text-green-600">logged ✓</span>}
      </div>
      <input
        value={plus}
        onChange={(e) => setPlus(e.target.value)}
        maxLength={140}
        placeholder="+ a win (be specific)"
        className="w-full rounded-lg border border-green-100 bg-green-50/40 px-3 py-1.5 text-sm text-ink placeholder:text-ink-light/50 focus:border-green-400 focus:outline-none"
      />
      <input
        value={minus}
        onChange={(e) => setMinus(e.target.value)}
        maxLength={140}
        placeholder="− a slip"
        className="w-full rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-1.5 text-sm text-ink placeholder:text-ink-light/50 focus:border-amber-400 focus:outline-none"
      />
      <input
        value={todo}
        onChange={(e) => setTodo(e.target.value)}
        maxLength={140}
        placeholder="game plan (small, symbolic)"
        className="w-full rounded-lg border border-blue-100 bg-white px-3 py-1.5 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nightly review
// ---------------------------------------------------------------------------
function NightlyReview({ today, nightly }: { today: string; nightly: SixTimeNightlyReview | null }) {
  const [best, setBest] = useState<string[]>([
    nightly?.best?.[0] ?? "",
    nightly?.best?.[1] ?? "",
    nightly?.best?.[2] ?? "",
  ]);
  const [worst, setWorst] = useState<string[]>([
    nightly?.worst?.[0] ?? "",
    nightly?.worst?.[1] ?? "",
    nightly?.worst?.[2] ?? "",
  ]);
  const [isPending, start] = useTransition();

  function set(arr: string[], i: number, v: string, setter: (a: string[]) => void) {
    const next = [...arr];
    next[i] = v;
    setter(next);
  }

  function save() {
    start(async () => {
      const res = await saveNightlyReview(today, best, worst);
      if (res?.error) showToast(res.error, "error");
      else showToast("Nightly review saved");
    });
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
      <div>
        <h3 className="font-handwriting text-lg text-ink">Nightly review</h3>
        <p className="text-xs text-ink-light">Before sleep — focus especially on the good.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-green-700">Top 3 best</p>
          {best.map((v, i) => (
            <input
              key={i}
              value={v}
              onChange={(e) => set(best, i, e.target.value, setBest)}
              maxLength={140}
              placeholder={`Best ${i + 1}`}
              className="w-full rounded-lg border border-green-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-green-400 focus:outline-none"
            />
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-amber-700">Top 3 worst</p>
          {worst.map((v, i) => (
            <input
              key={i}
              value={v}
              onChange={(e) => set(worst, i, e.target.value, setWorst)}
              maxLength={140}
              placeholder={`Worst ${i + 1}`}
              className="w-full rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-amber-400 focus:outline-none"
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Save review
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export function SixTimeBookView({
  today,
  problems,
  entries,
  nightly,
}: {
  today: string;
  problems: SixTimeProblem[];
  entries: SixTimeEntry[];
  nightly: SixTimeNightlyReview | null;
}) {
  const [manage, setManage] = useState(false);
  const setUp = isSixTimeSetUp(problems);
  const slots = buildDaySlots(problems, entries);
  const byPosition = (pos: number) => problems.find((p) => p.position === pos && p.status === "active");
  const activeCount = problems.filter((p) => p.status === "active").length;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-blue-100 px-6 py-5 md:px-8">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-handwriting text-2xl text-ink">Six-Time Book</h1>
            <p className="mt-0.5 text-xs text-ink-light">
              Track, don&apos;t judge. Short &amp; specific — six checks a day across three problems.
            </p>
          </div>
          {setUp && (
            <button
              onClick={() => setManage((m) => !m)}
              className="rounded-lg border border-blue-100 px-3 py-1.5 text-xs font-medium text-ink-light hover:bg-blue-50"
            >
              {manage ? "Done" : "Manage problems"}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8 space-y-5">
        {/* Setup / manage the three problems */}
        {(!setUp || manage) && (
          <section className="space-y-3">
            {!setUp && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-medium text-amber-900">
                  Setup ({activeCount}/3 saved) — fill in all three problems and press <b>Save</b> on each.
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  Once all three are saved, this turns into your daily view: <b>six boxes — two per problem</b>.
                </p>
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-3">
              {[1, 2, 3].map((pos) => (
                <ProblemEditor key={pos} position={pos} existing={byPosition(pos)} />
              ))}
            </div>
          </section>
        )}

        {/* The six daily slots — grouped as 2 boxes per problem (cycled morning + afternoon). */}
        {setUp && !manage && (
          <>
            <section className="space-y-4">
              {[1, 2, 3].map((pos) => {
                const groupSlots = slots.filter((s) => s.position === pos);
                const problem = groupSlots[0]?.problem;
                if (!problem) return null;
                const accent = SLOT_ACCENTS[pos - 1]!;
                return (
                  <div key={pos} className={`rounded-2xl border ${accent.border} ${accent.bg} p-4`}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`rounded-full ${accent.chip} px-2 py-0.5 text-[11px] font-bold`}>
                        Problem {pos}
                      </span>
                      <h3 className="font-handwriting text-lg text-ink truncate">{problem.reminder_phrase}</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {groupSlots.map((s, i) => (
                        <SlotCard
                          key={s.slotIndex}
                          today={today}
                          slotIndex={s.slotIndex}
                          label={`${i === 0 ? "1st" : "2nd"} check · slot ${s.slotIndex}`}
                          problemId={s.problem.id}
                          entry={s.entry}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>

            <NightlyReview today={today} nightly={nightly} />
          </>
        )}
      </div>
    </div>
  );
}
