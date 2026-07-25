"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";

import {
  aggregateScore,
  canEditEntries,
  challengeDayNumber,
  givingStreak,
  needsReview,
} from "@pm/domain";
import {
  GIVING_CATEGORIES,
  GIVING_CHALLENGE_DAYS,
  type GivingCategory,
  type GivingChallenge,
  type GivingKind,
  type GivingLog,
} from "@pm/types";
import {
  addGivingLog,
  completeGivingReview,
  deleteGivingLog,
  resetGiving,
  startGivingChallenge,
} from "@/app/(app)/giving/actions";
import { showToast } from "@/components/ui/Toaster";
import { GivingReadingsModal } from "./GivingReadingsModal";

const CATEGORY_LABELS: Record<GivingCategory, string> = {
  words: "Words",
  thoughts: "Thoughts",
  deeds: "Deeds",
  things_money: "Things / Money",
};

function Header({ onOpenReading }: { onOpenReading: () => void }) {
  return (
    <header className="border-b border-blue-100 px-6 py-5 md:px-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-handwriting text-2xl text-ink">Giving</h1>
          <p className="mt-0.5 text-xs text-ink-light">
            The secret of living is giving. Give daily, cheerfully and in secret — and keep score.
          </p>
        </div>
        <button
          onClick={onOpenReading}
          className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          📖 Giving reading
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white py-3 text-center">
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-light">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Onboarding({ today }: { today: string }) {
  const [isPending, start] = useTransition();
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-blue-100 bg-white p-6 text-center">
      <p className="font-handwriting text-2xl text-ink">The Secret of Living is Giving</p>
      <p className="mt-2 text-sm text-ink-light">
        Take the 90-day challenge: give something every day — words, thoughts, deeds, or things/money —
        and record what you gave and what came back. Give freely, expect nothing.
      </p>
      <button
        onClick={() =>
          start(async () => {
            const res = await startGivingChallenge(today);
            if (res?.error) showToast(res.error, "error");
            else showToast("Challenge started — Day 1");
          })
        }
        disabled={isPending}
        className="mt-5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        Start the 90-day challenge
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ReviewScreen({
  today,
  challenge,
  logs,
}: {
  today: string;
  challenge: GivingChallenge;
  logs: GivingLog[];
}) {
  const [isPending, start] = useTransition();
  const score = aggregateScore(logs);

  function decide(cont: boolean) {
    start(async () => {
      const res = await completeGivingReview(challenge.id, cont, today);
      if (res?.error) showToast(res.error, "error");
      else showToast(cont ? "Continuing — fresh start" : "Challenge closed");
    });
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-indigo-100 bg-indigo-50/40 p-6 text-center">
      <p className="font-handwriting text-2xl text-ink">90 days complete</p>
      <p className="mt-1 text-sm text-ink-light">Look at the magic that happened.</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Days given" value={score.daysLogged} />
        <Stat label="Received" value={score.receivedCount} />
        <Stat label="Cognitions" value={score.cognitionsCount} />
      </div>
      <p className="mt-5 text-sm font-medium text-ink">
        Do you like what&apos;s happening in your life? Do you want to continue?
      </p>
      <div className="mt-3 flex justify-center gap-3">
        <button
          onClick={() => decide(true)}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Yes, continue
        </button>
        <button
          onClick={() => decide(false)}
          disabled={isPending}
          className="rounded-lg border border-blue-100 px-5 py-2 text-sm text-ink-light hover:bg-white disabled:opacity-50"
        >
          No, close it
        </button>
      </div>
      <ResetButton />
    </div>
  );
}

// ---------------------------------------------------------------------------
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function LogRow({
  log,
  editable,
  showDate = false,
  onDelete,
}: {
  log: GivingLog;
  editable: boolean;
  showDate?: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-50 bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">
          {showDate && <span className="mr-1.5 text-[10px] font-medium text-ink-light">{shortDate(log.entry_date)}</span>}
          {log.content}
        </p>
        {log.kind === "given" && (log.categories.length > 0 || log.given_in_secret) && (
          <p className="mt-0.5 truncate text-[10px] text-ink-light">
            {log.categories.map((c) => CATEGORY_LABELS[c]).join(" · ")}
            {log.given_in_secret ? " · in secret" : ""}
          </p>
        )}
      </div>
      {editable && (
        <button
          onClick={() => onDelete(log.id)}
          aria-label="Delete"
          title="Delete"
          className="rounded p-1 text-ink-light hover:bg-red-50 hover:text-red-500"
        >
          ×
        </button>
      )}
    </div>
  );
}

function KindSection({
  kind,
  title,
  accent,
  placeholder,
  withCategories,
  editable,
  logs,
  onAdd,
  onDelete,
}: {
  kind: GivingKind;
  title: string;
  accent: string;
  placeholder: string;
  withCategories: boolean;
  editable: boolean;
  logs: GivingLog[];
  onAdd: (kind: GivingKind, content: string, categories: GivingCategory[], secret: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [content, setContent] = useState("");
  const [cats, setCats] = useState<GivingCategory[]>([]);
  const [secret, setSecret] = useState(true);

  function toggleCat(c: GivingCategory) {
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function add() {
    if (!content.trim()) return;
    // Categories are required for gifts — mirror the server guard before firing.
    if (kind === "given" && cats.length === 0) {
      showToast("Pick at least one category.", "error");
      return;
    }
    onAdd(kind, content, cats, secret);
    setContent("");
    setCats([]);
  }

  return (
    <div className="space-y-2 rounded-xl border border-blue-100 bg-white p-4">
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{title}</h3>

      {logs.length > 0 && <div className="space-y-1.5">{logs.map((l) => <LogRow key={l.id} log={l} editable={editable} onDelete={onDelete} />)}</div>}

      {editable && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={200}
              placeholder={placeholder}
              onKeyDown={(e) => e.key === "Enter" && content.trim() && add()}
              className="flex-1 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
            />
            <button
              onClick={add}
              disabled={!content.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {withCategories && (
            <div className="flex flex-wrap items-center gap-1.5">
              {GIVING_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCat(c)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    cats.includes(c)
                      ? "bg-indigo-600 text-white"
                      : "border border-blue-100 bg-white text-ink-light hover:bg-blue-50"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
              <label className="ml-2 flex items-center gap-1 text-[11px] text-ink-light">
                <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} className="h-3.5 w-3.5" />
                cheerfully &amp; in secret
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
const KIND_META: { kind: GivingKind; title: string; accent: string }[] = [
  { kind: "given", title: "All gifts given", accent: "text-green-700" },
  { kind: "received", title: "All received", accent: "text-blue-700" },
  { kind: "cognition", title: "All cognitions", accent: "text-violet-700" },
];

/** The full record across every day — separate from the daily add cards. */
function AllEntries({
  logs,
  editable,
  onDelete,
}: {
  logs: GivingLog[];
  editable: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {KIND_META.map(({ kind, title, accent }) => {
        const items = logs.filter((l) => l.kind === kind).slice().reverse(); // most recent first
        return (
          <div key={kind} className="space-y-2 rounded-xl border border-blue-100 bg-white p-4">
            <h3 className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>
              {title} ({items.length})
            </h3>
            {items.length === 0 ? (
              <p className="py-3 text-center text-xs text-ink-light">Nothing yet.</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((l) => (
                  <LogRow key={l.id} log={l} editable={editable} showDate onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
/** Destructive reset — wipes all giving records (logs + challenge) behind an inline confirm. */
function ResetButton() {
  const [confirming, setConfirming] = useState(false);
  const [isPending, start] = useTransition();

  function reset() {
    start(async () => {
      const res = await resetGiving();
      if (res?.error) showToast(res.error, "error");
      else {
        setConfirming(false);
        showToast("Giving reset — clean slate");
      }
    });
  }

  if (!confirming) {
    return (
      <div className="pt-2 text-center">
        <button
          onClick={() => setConfirming(true)}
          className="text-xs font-medium text-ink-light hover:text-red-600"
        >
          Reset records
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
      <span className="text-xs text-red-800">Delete all giving records? This can&apos;t be undone.</span>
      <button
        onClick={reset}
        disabled={isPending}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        Yes, reset
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="text-xs text-ink-light hover:text-ink"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
function DailyBoard({
  today,
  challenge,
  logs,
}: {
  today: string;
  challenge: GivingChallenge;
  logs: GivingLog[];
}) {
  const [view, setView] = useState<"today" | "all">("today");
  // Which day new entries are logged against — defaults to today, but can be
  // set back to any earlier day in the challenge to backfill missed records.
  const [logDate, setLogDate] = useState(today);
  const [, start] = useTransition();

  // Optimistic mirror of the logs so add/delete land instantly while the
  // insert/delete + revalidation run in the background. Re-seeds from props
  // (server truth) on every render, so it self-heals if a write fails.
  type Mutation = { kind: "add"; log: GivingLog } | { kind: "delete"; id: string };
  const [optimisticLogs, applyOptimistic] = useOptimistic(logs, (state: GivingLog[], m: Mutation) =>
    m.kind === "add" ? [...state, m.log] : state.filter((l) => l.id !== m.id),
  );
  const tempId = useRef(0);

  function handleAdd(kind: GivingKind, content: string, categories: GivingCategory[], secret: boolean) {
    const clean = content.trim().slice(0, 200);
    const optimisticLog: GivingLog = {
      id: `tmp-${(tempId.current += 1)}`,
      user_id: "",
      challenge_id: challenge.id,
      entry_date: logDate,
      kind,
      content: clean,
      categories: kind === "given" ? categories : [],
      given_in_secret: kind === "given" ? secret : false,
      created_at: "",
      updated_at: "",
    };
    start(async () => {
      applyOptimistic({ kind: "add", log: optimisticLog });
      const res = await addGivingLog(challenge.id, logDate, kind, clean, categories, secret, today);
      if (res?.error) showToast(res.error, "error");
    });
  }

  function handleDelete(id: string) {
    start(async () => {
      applyOptimistic({ kind: "delete", id });
      const res = await deleteGivingLog(id);
      if (res?.error) showToast(res.error, "error");
    });
  }

  const editable = canEditEntries(challenge, today);
  const dayNum = challengeDayNumber(challenge, today);
  const score = aggregateScore(optimisticLogs);
  const streak = givingStreak(optimisticLogs, today);
  const dayLogs = optimisticLogs.filter((l) => l.entry_date === logDate);
  const ofKind = (k: GivingKind) => dayLogs.filter((l) => l.kind === k);

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-white px-4 py-3">
        <div>
          <p className="text-lg font-semibold text-ink">
            {challenge.mode === "continuous" ? `Day ${dayNum}` : `Day ${dayNum} of ${GIVING_CHALLENGE_DAYS}`}
          </p>
          <p className="text-xs text-ink-light">
            {streak > 0 ? `${streak}-day streak` : "Give something today"}
            {challenge.mode === "continuous" ? " · continuous" : ""}
          </p>
        </div>
        <div className="flex gap-3 text-center text-xs text-ink-light">
          <div><span className="block text-base font-semibold text-ink">{score.givenCount}</span>given</div>
          <div><span className="block text-base font-semibold text-ink">{score.receivedCount}</span>received</div>
          <div><span className="block text-base font-semibold text-ink">{score.cognitionsCount}</span>cognitions</div>
        </div>
      </div>

      {!editable && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          The 90 days are complete — the tracker is locked pending your review.
        </p>
      )}

      {/* Today (add) vs All entries (full history, separate cards) */}
      <div className="flex w-fit gap-1 rounded-lg border border-blue-100 bg-white p-0.5 text-sm">
        {(["today", "all"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1 font-medium transition ${
              view === v ? "bg-indigo-600 text-white" : "text-ink-light hover:bg-blue-50"
            }`}
          >
            {v === "today" ? "Today" : "All entries"}
          </button>
        ))}
      </div>

      {view === "all" ? (
        <AllEntries logs={optimisticLogs} editable={editable} onDelete={handleDelete} />
      ) : (
        <>
      {/* Log date — defaults to today; pick an earlier day to backfill missed records. */}
      {editable && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3">
          <label htmlFor="giving-log-date" className="text-xs font-medium text-ink-light">
            Logging for
          </label>
          <input
            id="giving-log-date"
            type="date"
            value={logDate}
            min={challenge.start_date}
            max={today}
            onChange={(e) => setLogDate(e.target.value || today)}
            className="rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-blue-400 focus:outline-none"
          />
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
      )}
      <KindSection
        kind="given"
        title="What I gave"
        accent="text-green-700"
        placeholder="e.g. Paid for a stranger's coffee"
        withCategories
        editable={editable}
        logs={ofKind("given")}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />
      <KindSection
        kind="received"
        title="What I received"
        accent="text-blue-700"
        placeholder="unexpected money, a compliment, a lucky break, peace…"
        withCategories={false}
        editable={editable}
        logs={ofKind("received")}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />
      <KindSection
        kind="cognition"
        title="Cognitions"
        accent="text-violet-700"
        placeholder="a realization or inner shift you noticed"
        withCategories={false}
        editable={editable}
        logs={ofKind("cognition")}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />
        </>
      )}

      <ResetButton />
    </div>
  );
}

// ---------------------------------------------------------------------------
export function GivingView({
  today,
  challenge,
  logs,
}: {
  today: string;
  challenge: GivingChallenge | null;
  logs: GivingLog[];
}) {
  const [showReading, setShowReading] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <Header onOpenReading={() => setShowReading(true)} />
      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
        {!challenge ? (
          <Onboarding today={today} />
        ) : needsReview(challenge, today) ? (
          <ReviewScreen today={today} challenge={challenge} logs={logs} />
        ) : (
          <DailyBoard today={today} challenge={challenge} logs={logs} />
        )}
      </div>
      {showReading && <GivingReadingsModal onClose={() => setShowReading(false)} />}
    </div>
  );
}
