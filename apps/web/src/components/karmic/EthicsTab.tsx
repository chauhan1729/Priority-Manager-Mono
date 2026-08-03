"use client";

import { useOptimistic, useState, useTransition } from "react";

import { mergeEthicsChecklist } from "@pm/domain";
import type { KarmicEthicsCheckin, KarmicEthicsPrinciple } from "@pm/types";
import {
  addEthicsPrinciple,
  saveEthicsCheckin,
  setEthicsPrincipleActive,
  updateEthicsPrinciple,
} from "@/app/(app)/karmic/actions";
import { showToast } from "@/components/ui/Toaster";
import { DayBackfillModal, isoAddDays } from "@/components/ui/DayBackfillModal";

function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// --- "My code": the editable principle list --------------------------------
function PrincipleRow({ principle }: { principle: KarmicEthicsPrinciple }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(principle.label);
  const [, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateEthicsPrinciple(principle.id, label);
      if (res?.error) showToast(res.error, "error");
      else setEditing(false);
    });
  }
  function retire() {
    start(async () => {
      const res = await setEthicsPrincipleActive(principle.id, false);
      if (res?.error) showToast(res.error, "error");
    });
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 rounded-lg bg-white p-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={300}
          className="flex-1 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-amber-400 focus:outline-none"
        />
        <button onClick={save} className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">
          Save
        </button>
        <button
          onClick={() => {
            setLabel(principle.label);
            setEditing(false);
          }}
          className="rounded-md px-2 py-1 text-xs text-ink-light hover:bg-blue-50"
        >
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li className="group/p flex items-center gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2">
      <span className="flex-1 text-sm text-ink">{principle.label}</span>
      <button
        onClick={() => setEditing(true)}
        aria-label="Edit"
        className="shrink-0 rounded p-1 text-indigo-400 opacity-0 transition hover:bg-indigo-50 group-hover/p:opacity-100"
      >
        ✎
      </button>
      <button
        onClick={retire}
        aria-label="Retire"
        title="Retire this principle"
        className="shrink-0 rounded p-1 text-ink-light opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover/p:opacity-100"
      >
        ×
      </button>
    </li>
  );
}

function CodeEditor({ principles }: { principles: KarmicEthicsPrinciple[] }) {
  const active = principles.filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order);
  const [text, setText] = useState("");
  const [, start] = useTransition();

  function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    start(async () => {
      const res = await addEthicsPrinciple(t);
      if (res?.error) showToast(res.error, "error");
    });
  }

  return (
    <section className="space-y-2 rounded-2xl border border-amber-200/70 bg-amber-50/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-amber-800">My code</h3>
        <p className="text-[11px] text-ink-light">
          The four or five lines you choose to keep — edit them to make them your own.
        </p>
      </div>
      <ul className="space-y-1.5">
        {active.map((p) => (
          <PrincipleRow key={p.id} principle={p} />
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Add a principle…"
          onKeyDown={(e) => e.key === "Enter" && text.trim() && add()}
          className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm text-ink placeholder:text-ink-light/50 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </section>
  );
}

// --- History ---------------------------------------------------------------
function History({
  principles,
  checkins,
}: {
  principles: KarmicEthicsPrinciple[];
  checkins: KarmicEthicsCheckin[];
}) {
  const labelById = new Map(principles.map((p) => [p.id, p.label]));
  const byDate = new Map<string, KarmicEthicsCheckin[]>();
  for (const c of checkins) {
    if (!byDate.has(c.checkin_date)) byDate.set(c.checkin_date, []);
    byDate.get(c.checkin_date)!.push(c);
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    return (
      <div className="rounded-2xl border border-blue-100 bg-white p-8 text-center">
        <p className="text-sm text-ink-light">No nightly checks recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((d) => (
        <div key={d} className="space-y-2 rounded-2xl border border-blue-100 bg-white p-4">
          <p className="text-sm font-medium text-ink">{prettyDate(d)}</p>
          {byDate
            .get(d)!
            .map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                <span className={c.kept ? "text-emerald-600" : "text-rose-600"}>{c.kept ? "✓" : "✗"}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{labelById.get(c.principle_id) ?? "—"}</span>
                  {c.note && <span className="text-ink-light"> — {c.note}</span>}
                </span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

// --- One principle's nightly check -----------------------------------------
function CheckRow({
  principle,
  checkin,
  onSet,
}: {
  principle: KarmicEthicsPrinciple;
  checkin: KarmicEthicsCheckin | null;
  onSet: (kept: boolean, note: string) => void;
}) {
  const [note, setNote] = useState(checkin?.note ?? "");
  const chosen = checkin !== null;

  return (
    <div className="space-y-1.5 rounded-lg border border-amber-100 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm text-ink">{principle.label}</p>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => onSet(true, note)}
            className={`rounded-md px-2 py-0.5 text-xs font-medium transition ${
              checkin?.kept === true
                ? "bg-emerald-600 text-white"
                : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            Kept
          </button>
          <button
            onClick={() => onSet(false, note)}
            className={`rounded-md px-2 py-0.5 text-xs font-medium transition ${
              checkin?.kept === false
                ? "bg-rose-600 text-white"
                : "border border-rose-200 text-rose-700 hover:bg-rose-50"
            }`}
          >
            Slipped
          </button>
        </div>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => chosen && note !== (checkin?.note ?? "") && onSet(checkin!.kept, note)}
        disabled={!chosen}
        maxLength={300}
        placeholder={chosen ? "Add a note (optional)…" : "Choose Kept or Slipped first"}
        className="w-full rounded-md border border-amber-100 bg-white px-2.5 py-1 text-xs text-ink placeholder:text-ink-light/50 focus:border-amber-300 focus:outline-none disabled:bg-blue-50/40 disabled:placeholder:text-ink-light/40"
      />
    </div>
  );
}

// The "kept / slipped" check for one day — owns its optimistic state so it can be
// reused for tonight (in the tab) and any past night (in the backfill modal).
function EthicsCheckEditor({
  date,
  principles,
  checkins,
  today,
}: {
  date: string;
  principles: KarmicEthicsPrinciple[];
  checkins: KarmicEthicsCheckin[];
  today: string;
}) {
  const [, start] = useTransition();
  const dayCheckins = checkins.filter((c) => c.checkin_date === date);

  type Mutation = { principleId: string; kept: boolean; note: string };
  const [optimisticCheckins, applyOptimistic] = useOptimistic(
    dayCheckins,
    (state: KarmicEthicsCheckin[], m: Mutation): KarmicEthicsCheckin[] => {
      const existing = state.find((c) => c.principle_id === m.principleId);
      if (existing) {
        return state.map((c) =>
          c.principle_id === m.principleId ? { ...c, kept: m.kept, note: m.note || null } : c,
        );
      }
      const row: KarmicEthicsCheckin = {
        id: `tmp-${m.principleId}`,
        user_id: "",
        checkin_date: date,
        principle_id: m.principleId,
        kept: m.kept,
        note: m.note || null,
        created_at: "",
        updated_at: "",
      };
      return [...state, row];
    },
  );

  const rows = mergeEthicsChecklist(principles, optimisticCheckins);

  function handleSet(principleId: string, kept: boolean, note: string) {
    start(async () => {
      applyOptimistic({ principleId, kept, note });
      const res = await saveEthicsCheckin(date, principleId, kept, note || null, today);
      if (res?.error) showToast(res.error, "error");
    });
  }

  return (
    <section className="space-y-2 rounded-2xl border border-amber-200/70 bg-amber-50/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-amber-800">Tonight's check</h3>
        <p className="text-[11px] text-ink-light">Kept it or slipped? No guilt — just an honest seed.</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 py-4 text-center text-sm text-ink-light">Add a principle in your code to check it here.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map(({ principle, checkin }) => (
            <CheckRow
              key={principle.id}
              principle={principle}
              checkin={checkin}
              onSet={(kept, note) => handleSet(principle.id, kept, note)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function EthicsTab({
  today,
  principles,
  checkins,
}: {
  today: string;
  principles: KarmicEthicsPrinciple[];
  checkins: KarmicEthicsCheckin[];
}) {
  const [view, setView] = useState<"today" | "history">("today");
  const yesterday = isoAddDays(today, -1);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillDate, setBackfillDate] = useState(yesterday);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex w-fit gap-1 rounded-lg border border-blue-100 bg-white p-0.5 text-sm">
          {(["today", "history"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                view === v ? "bg-indigo-600 text-white" : "text-ink-light hover:bg-blue-50"
              }`}
            >
              {v === "today" ? "Tonight" : "History"}
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
          📅 Check a past night
        </button>
      </div>

      {view === "history" ? (
        <History principles={principles} checkins={checkins} />
      ) : (
        <>
          <CodeEditor principles={principles} />
          <EthicsCheckEditor key={today} date={today} principles={principles} checkins={checkins} today={today} />
        </>
      )}

      {backfillOpen && (
        <DayBackfillModal
          title="Check a past night"
          subtitle="Backfill your kept/slipped check for a night you missed."
          date={backfillDate}
          onDateChange={setBackfillDate}
          maxDate={yesterday}
          onClose={() => setBackfillOpen(false)}
        >
          <EthicsCheckEditor
            key={backfillDate}
            date={backfillDate}
            principles={principles}
            checkins={checkins}
            today={today}
          />
        </DayBackfillModal>
      )}
    </div>
  );
}
