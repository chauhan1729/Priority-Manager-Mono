"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";

import {
  buildPartnerBoard,
  canAddPartner,
  KARMIC_PARTNER_GROUP_ORDER,
} from "@pm/domain";
import type {
  KarmicPartner,
  KarmicPartnerAction,
  KarmicPartnerGroup,
} from "@pm/types";
import {
  addPartner,
  addPartnerAction,
  deletePartner,
  deletePartnerAction,
  togglePartnerAction,
  updatePartner,
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

// --- One partner's who + success vision (view / edit / retire) --------------
function PartnerHeader({ partner }: { partner: KarmicPartner }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(partner.name ?? "");
  const [vision, setVision] = useState(partner.success_vision ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updatePartner(partner.id, name || null, vision || null);
      if (res?.error) showToast(res.error, "error");
      else setEditing(false);
    });
  }
  function remove() {
    start(async () => {
      const res = await deletePartner(partner.id);
      if (res?.error) showToast(res.error, "error");
    });
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group/h flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md px-2 py-1 text-left hover:bg-white/70"
      >
        <span className="text-sm font-semibold text-ink">
          {partner.name || "—"}
        </span>
        {partner.success_vision && (
          <span className="text-xs text-ink-light">
            · success = {partner.success_vision}
          </span>
        )}
        <span className="text-[11px] text-indigo-400 opacity-0 transition group-hover/h:opacity-100">
          ✎ edit
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-white/80 p-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        placeholder="Who? (a name)"
        className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-indigo-400 focus:outline-none"
      />
      <input
        value={vision}
        onChange={(e) => setVision(e.target.value)}
        maxLength={500}
        placeholder="What will their success look like?"
        className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-indigo-400 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Save
        </button>
        <button
          onClick={() => {
            setName(partner.name ?? "");
            setVision(partner.success_vision ?? "");
            setEditing(false);
          }}
          className="rounded-md px-3 py-1 text-xs font-medium text-ink-light hover:bg-blue-50"
        >
          Cancel
        </button>
        {confirmingDelete ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-red-700">
              Delete + all their actions?
            </span>
            <button
              onClick={remove}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-xs text-ink-light hover:text-ink"
            >
              No
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="ml-auto text-xs font-medium text-ink-light hover:text-red-600"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// --- A partner's daily action list -----------------------------------------
function ActionList({
  actions,
  onAdd,
  onToggle,
  onDelete,
}: {
  actions: KarmicPartnerAction[];
  onAdd: (text: string) => void;
  onToggle: (a: KarmicPartnerAction) => void;
  onDelete: (a: KarmicPartnerAction) => void;
}) {
  const [text, setText] = useState("");

  function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    onAdd(t);
  }

  return (
    <div className="space-y-1.5">
      {actions.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-white px-2.5 py-1.5"
        >
          <button
            onClick={() => onToggle(a)}
            aria-label={a.done ? "Mark not done" : "Mark done"}
            className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
              a.done
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-ink-light/40 text-transparent"
            }`}
          >
            ✓
          </button>
          <p
            className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-sm ${a.done ? "text-ink-light line-through" : "text-ink"}`}
          >
            {a.text}
          </p>
          <button
            onClick={() => onDelete(a)}
            aria-label="Delete"
            className="shrink-0 rounded p-0.5 text-ink-light hover:bg-red-50 hover:text-red-500"
          >
            ×
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="What will you do to make them successful?"
          onKeyDown={(e) => e.key === "Enter" && text.trim() && add()}
          className="min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-ink placeholder:text-ink-light/50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// --- Inline "add a partner" form (manage mode) -----------------------------
function AddPartnerForm({
  group,
  singular,
}: {
  group: KarmicPartnerGroup;
  singular: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [vision, setVision] = useState("");
  const [, start] = useTransition();

  function save() {
    if (!name.trim()) return;
    start(async () => {
      const res = await addPartner(group, name, vision || null);
      if (res?.error) showToast(res.error, "error");
      else {
        setName("");
        setVision("");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-indigo-300 bg-white/50 px-3 py-2 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
      >
        ＋ Add a {singular}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-indigo-200 bg-white p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        autoFocus
        placeholder={`Who? (name of the ${singular})`}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && save()}
        className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-indigo-400 focus:outline-none"
      />
      <input
        value={vision}
        onChange={(e) => setVision(e.target.value)}
        maxLength={500}
        placeholder="What will their success look like? (optional)"
        onKeyDown={(e) => e.key === "Enter" && name.trim() && save()}
        className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-indigo-400 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!name.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => {
            setName("");
            setVision("");
            setOpen(false);
          }}
          className="rounded-md px-3 py-1 text-xs font-medium text-ink-light hover:bg-blue-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- History: past days, grouped by date then partner ----------------------
function History({
  partners,
  actions,
}: {
  partners: KarmicPartner[];
  actions: KarmicPartnerAction[];
}) {
  const nameById = new Map(partners.map((p) => [p.id, p.name ?? "—"]));
  const groupLabel = (g: KarmicPartnerGroup) =>
    ({
      coworkers: "Co-workers",
      customers: "Customers",
      suppliers: "Suppliers",
      world: "The World",
    })[g];

  const byDate = new Map<string, KarmicPartnerAction[]>();
  for (const a of actions) {
    if (!byDate.has(a.action_date)) byDate.set(a.action_date, []);
    byDate.get(a.action_date)!.push(a);
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    return (
      <div className="rounded-2xl border border-blue-100 bg-white p-8 text-center">
        <p className="text-sm text-ink-light">
          No partner actions recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((d) => (
        <div
          key={d}
          className="space-y-2 rounded-2xl border border-blue-100 bg-white p-4"
        >
          <p className="text-sm font-medium text-ink">{prettyDate(d)}</p>
          {KARMIC_PARTNER_GROUP_ORDER.map((g) => {
            const rows = byDate.get(d)!.filter((a) => a.partner_group === g);
            if (rows.length === 0) return null;
            return (
              <div key={g} className="space-y-1">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
                  {groupLabel(g)}
                </h4>
                {rows.map((a) => (
                  <p
                    key={a.id}
                    className={`text-sm ${a.done ? "text-ink-light line-through" : "text-ink"}`}
                  >
                    {a.done ? "✓ " : "○ "}
                    <span className="font-medium text-ink">
                      {nameById.get(a.partner_id) ?? "—"}
                    </span>
                    <span className="text-ink-light"> — {a.text}</span>
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// --- The board editor for one day (today or a backfilled past day) ----------
function PartnerBoardEditor({
  date,
  partners,
  actions,
  today,
  manage,
}: {
  date: string;
  partners: KarmicPartner[];
  actions: KarmicPartnerAction[];
  today: string;
  manage: boolean; // true = edit identities, add & retire partners (today only)
}) {
  const [, start] = useTransition();
  const tempId = useRef(0);

  const dayActions = actions.filter((a) => a.action_date === date);

  type Mutation =
    | {
        kind: "add";
        partnerId: string;
        group: KarmicPartnerGroup;
        tempId: string;
        text: string;
      }
    | { kind: "toggle"; id: string }
    | { kind: "delete"; id: string };
  const [optimisticActions, applyOptimistic] = useOptimistic(
    dayActions,
    (state: KarmicPartnerAction[], m: Mutation): KarmicPartnerAction[] => {
      if (m.kind === "add") {
        const row: KarmicPartnerAction = {
          id: m.tempId,
          user_id: "",
          partner_id: m.partnerId,
          partner_group: m.group,
          action_date: date,
          text: m.text,
          done: false,
          created_at: "",
          updated_at: "",
        };
        return [...state, row];
      }
      if (m.kind === "toggle")
        return state.map((a) => (a.id === m.id ? { ...a, done: !a.done } : a));
      return state.filter((a) => a.id !== m.id);
    },
  );

  const board = buildPartnerBoard(partners, optimisticActions);

  function handleAdd(partner: KarmicPartner, text: string) {
    start(async () => {
      applyOptimistic({
        kind: "add",
        partnerId: partner.id,
        group: partner.partner_group,
        tempId: `tmp-${(tempId.current += 1)}`,
        text,
      });
      const res = await addPartnerAction(
        partner.id,
        partner.partner_group,
        date,
        text,
        today,
      );
      if (res?.error) showToast(res.error, "error");
    });
  }
  function handleToggle(a: KarmicPartnerAction) {
    start(async () => {
      applyOptimistic({ kind: "toggle", id: a.id });
      const res = await togglePartnerAction(a.id, !a.done);
      if (res?.error) showToast(res.error, "error");
    });
  }
  function handleDelete(a: KarmicPartnerAction) {
    start(async () => {
      applyOptimistic({ kind: "delete", id: a.id });
      const res = await deletePartnerAction(a.id);
      if (res?.error) showToast(res.error, "error");
    });
  }

  return (
    <div className="space-y-3">
      {board.map((bucket) => {
        const totalActions = bucket.partners.reduce(
          (n, c) => n + c.actions.length,
          0,
        );
        const doneActions = bucket.partners.reduce(
          (n, c) => n + c.actions.filter((a) => a.done).length,
          0,
        );
        return (
          <section
            key={bucket.group}
            className="space-y-2.5 rounded-2xl border border-indigo-200/70 bg-indigo-50/30 p-4"
          >
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none">{bucket.emoji}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-indigo-800">
                  {bucket.label}
                </h3>
                <p className="text-[11px] text-ink-light">{bucket.hint}</p>
              </div>
              {(bucket.partners.length > 0 || totalActions > 0) && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {bucket.partners.length}
                  {totalActions > 0 ? ` · ${doneActions}/${totalActions}` : ""}
                </span>
              )}
            </div>

            {bucket.partners.length === 0 && !manage && (
              <p className="px-1 py-2 text-xs italic text-ink-light">
                No {bucket.singular}s in this group.
              </p>
            )}

            {bucket.partners.map(({ partner, actions: partnerActions }) => (
              <div
                key={partner.id}
                className="space-y-2 rounded-xl border border-indigo-100 bg-white/60 p-2.5"
              >
                {manage ? (
                  <PartnerHeader partner={partner} />
                ) : (
                  <p className="px-2 text-sm font-semibold text-ink">
                    {partner.name || "—"}
                    {partner.success_vision && (
                      <span className="font-normal text-ink-light">
                        {" "}
                        · success = {partner.success_vision}
                      </span>
                    )}
                  </p>
                )}
                <ActionList
                  actions={partnerActions}
                  onAdd={(text) => handleAdd(partner, text)}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              </div>
            ))}

            {manage &&
              (canAddPartner(partners, bucket.group) ? (
                <AddPartnerForm
                  group={bucket.group}
                  singular={bucket.singular}
                />
              ) : (
                <p className="px-1 text-[11px] italic text-ink-light">
                  Group full — delete one to add another.
                </p>
              ))}
          </section>
        );
      })}
    </div>
  );
}

export function PartnersTab({
  today,
  partners,
  actions,
}: {
  today: string;
  partners: KarmicPartner[];
  actions: KarmicPartnerAction[];
}) {
  const [view, setView] = useState<"today" | "history">("today");
  const yesterday = isoAddDays(today, -1);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillDate, setBackfillDate] = useState(yesterday);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex w-fit max-w-full gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-blue-100 bg-white p-0.5 text-sm scrollbar-hide">
          {(["today", "history"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                view === v
                  ? "bg-indigo-600 text-white"
                  : "text-ink-light hover:bg-blue-50"
              }`}
            >
              {v === "today" ? "Today" : "History"}
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
          📅 Log a past day
        </button>
      </div>

      {view === "history" ? (
        <History partners={partners} actions={actions} />
      ) : (
        <>
          <p className="rounded-lg bg-indigo-50/60 px-3 py-2 text-xs text-ink-light">
            Make your partners successful first — no strings attached. Your own
            success is the echo.
          </p>
          <PartnerBoardEditor
            key={today}
            date={today}
            partners={partners}
            actions={actions}
            today={today}
            manage
          />
        </>
      )}

      {backfillOpen && (
        <DayBackfillModal
          title="Log a past day"
          subtitle="Backfill what you did to make your partners successful on a day you missed."
          date={backfillDate}
          onDateChange={setBackfillDate}
          maxDate={yesterday}
          onClose={() => setBackfillOpen(false)}
        >
          <PartnerBoardEditor
            key={backfillDate}
            date={backfillDate}
            partners={partners}
            actions={actions}
            today={today}
            manage={false}
          />
        </DayBackfillModal>
      )}
    </div>
  );
}
