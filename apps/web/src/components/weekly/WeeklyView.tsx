"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useTransition } from "react";

import {
  addWeeksISO,
  canCreateActivityOnDate,
  getSomedayReviewDue,
  weekDayISOs,
} from "@pm/domain";
import type { Activity, Project } from "@pm/types";
import { deleteActivity } from "@/app/(app)/activities/actions";
import {
  assignToDay,
  createWeeklyActivity,
  markWeeklyReviewDone,
  moveToWeeklyPool,
  moveWeeklyItemToSomeday,
  pullIntoWeek,
  type ActionResult,
} from "@/app/(app)/weekly/actions";
import { truncateProjectName } from "@/components/activities/ParkedProjectPicker";
import { showToast } from "@/components/ui/Toaster";

const DAY_INITIALS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDayNumber(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}

function formatWeekTitle(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${weekEnd}T12:00:00`);
  const startMonth = start.toLocaleDateString(undefined, { month: "short" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  if (startMonth === endMonth) return `${startMonth} ${startDay}–${endDay}`;
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function PriorityBadge({ priority }: { priority: Activity["priority"] }) {
  const isA = priority === "A";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        isA ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"
      }`}
    >
      {priority}
    </span>
  );
}

/** A pool item: no day yet, so its main affordance is the day picker. */
function PoolRow({
  item,
  weekDays,
  today,
  dayLoad,
  projectName,
}: {
  item: Activity;
  weekDays: string[];
  today: string;
  dayLoad: Record<string, { a: number; total: number }>;
  projectName: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleAssign(dateISO: string) {
    startTransition(async () => {
      const res = await assignToDay(item.id, dateISO);
      if (res?.error) showToast(res.error, "error");
      else showToast(`Moved to ${formatShortDate(dateISO)}`);
    });
  }

  return (
    <div className="rounded-xl border border-blue-50 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <PriorityBadge priority={item.priority} />
            <p className="truncate text-sm font-medium text-ink">
              {item.title}
            </p>
          </div>
          {projectName && (
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-light">
              <span aria-hidden="true">📁</span>
              <span className="truncate">{projectName}</span>
            </p>
          )}
          {item.note && (
            <p className="mt-0.5 break-words text-xs italic text-ink-light">
              “{item.note}”
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            onClick={() =>
              startTransition(async () => {
                const res = await moveWeeklyItemToSomeday(item.id);
                if (res?.error) showToast(res.error, "error");
                else showToast("Parked on Someday");
              })
            }
            disabled={isPending}
            title="Park on Someday"
            className="rounded-md border border-blue-100 px-2 py-1 text-[11px] font-medium text-ink-light hover:bg-blue-50 disabled:opacity-50"
          >
            ☾<span className="hidden sm:inline"> Someday</span>
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

      <div className="mt-2.5">
        <span className="text-[11px] text-ink-light">Put it on:</span>
        {/* Fixed 7-column grid: the chips always divide the row width, so they can never
            overflow however narrow the screen gets. */}
        <div className="mt-1 grid grid-cols-7 gap-1">
          {weekDays.map((day, i) => {
            const allowed = canCreateActivityOnDate(day);
            const load = dayLoad[day];
            return (
              <button
                key={day}
                onClick={() => handleAssign(day)}
                disabled={isPending || !allowed}
                title={
                  allowed
                    ? `${DAY_INITIALS[i]} ${formatDayNumber(day)}${
                        load ? ` — ${load.a} A, ${load.total} total` : ""
                      }`
                    : "That day has passed"
                }
                className={`flex flex-col items-center rounded-md border px-1 py-1 transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  day === today
                    ? "border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "border-blue-100 text-ink hover:bg-blue-50"
                }`}
              >
                <span className="text-[10px] leading-tight">
                  {DAY_INITIALS[i]}
                </span>
                <span className="text-xs font-semibold leading-tight">
                  {formatDayNumber(day)}
                </span>
                <span className="h-3 text-[9px] leading-tight text-amber-700">
                  {load && load.a > 0 ? `${load.a}A` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A stranded pool item or an overdue dated activity — both move into the current week. */
function CarryRow({ item, weekStart }: { item: Activity; weekStart: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <PriorityBadge priority={item.priority} />
          <p className="truncate text-sm text-ink">{item.title}</p>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-light">
          {item.is_weekly ? "left in" : "was"}{" "}
          {formatShortDate(item.activity_date)}
        </p>
      </div>
      <button
        onClick={() =>
          startTransition(async () => {
            const res = await moveToWeeklyPool(item.id, weekStart);
            if (res?.error) showToast(res.error, "error");
            else showToast("Moved into this week");
          })
        }
        disabled={isPending}
        className="flex-shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
      >
        Move<span className="hidden sm:inline"> to this week</span>
      </button>
    </div>
  );
}

function SomedayReviewRow({
  item,
  weekStart,
}: {
  item: Activity;
  weekStart: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-50 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{item.title}</p>
        {item.note && (
          <p className="mt-0.5 break-words text-xs italic text-ink-light">
            “{item.note}”
          </p>
        )}
      </div>
      <button
        onClick={() =>
          startTransition(async () => {
            const res = await pullIntoWeek(item.id, weekStart);
            if (res?.error) showToast(res.error, "error");
            else showToast("Pulled into this week");
          })
        }
        disabled={isPending}
        className="flex-shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        Pull in<span className="hidden sm:inline">to this week</span>
      </button>
    </div>
  );
}

export function WeeklyView({
  weekStart,
  weekEnd,
  currentWeekStart,
  today,
  pool,
  stranded,
  overdue,
  someday,
  dayLoad,
  lastReviewedDate,
  projects,
}: {
  weekStart: string;
  weekEnd: string;
  currentWeekStart: string;
  today: string;
  pool: Activity[];
  stranded: Activity[];
  overdue: Activity[];
  someday: Activity[];
  dayLoad: Record<string, { a: number; total: number }>;
  lastReviewedDate: string | null;
  projects: Pick<Project, "id" | "name" | "status">[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createWeeklyActivity,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [isReviewPending, startReviewTransition] = useTransition();

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
      showToast("Added to this week");
    }
  }, [state]);

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const weekDays = weekDayISOs(weekStart);
  const isCurrentWeek = weekStart === currentWeekStart;
  // Past weeks stay visible but read-only: nothing new can be staged into a week that has gone.
  const isPastWeek = weekStart < currentWeekStart;
  const carryItems = [...stranded, ...overdue];
  const reviewDue =
    isCurrentWeek && getSomedayReviewDue(lastReviewedDate, today);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-blue-100 px-4 py-3 md:px-8 md:py-4">
        <h1 className="mb-2 hidden font-handwriting text-2xl text-ink md:block">
          Weekly
        </h1>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-blue-100 bg-white px-1 py-0.5">
              <Link
                href={`/weekly?week=${addWeeksISO(weekStart, -1)}`}
                className="rounded px-2 py-1 text-sm text-ink-light transition hover:bg-blue-50 hover:text-blue-700"
                aria-label="Previous week"
              >
                ←
              </Link>
              <span className="min-w-[120px] px-1 text-center text-sm font-medium text-ink">
                {isCurrentWeek
                  ? "This week"
                  : formatWeekTitle(weekStart, weekEnd)}
              </span>
              <Link
                href={`/weekly?week=${addWeeksISO(weekStart, 1)}`}
                className="rounded px-2 py-1 text-sm text-ink-light transition hover:bg-blue-50 hover:text-blue-700"
                aria-label="Next week"
              >
                →
              </Link>
            </div>

            {!isCurrentWeek && (
              <Link
                href="/weekly"
                className="text-xs text-blue-600 hover:underline"
              >
                This week
              </Link>
            )}
          </div>

          <span className="hidden text-xs text-ink-light sm:inline">
            {pool.length} waiting for a day
          </span>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 md:px-8">
        {reviewDue && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-ink">
              <span className="font-medium">Weekly review is due.</span>{" "}
              <span className="text-ink-light">
                {lastReviewedDate
                  ? `Last done ${formatShortDate(lastReviewedDate)}.`
                  : "You haven’t done one yet."}
              </span>
            </p>
            <button
              onClick={() =>
                startReviewTransition(async () => {
                  const res = await markWeeklyReviewDone();
                  if (res?.error) showToast(res.error, "error");
                  else showToast("Weekly review marked done");
                })
              }
              disabled={isReviewPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Mark review done
            </button>
          </div>
        )}

        {/* The pool */}
        <section>
          <h2 className="font-handwriting text-lg text-ink">This week</h2>
          <p className="mb-3 mt-0.5 text-xs text-ink-light">
            Committed to the week, not yet to a day. Give one a day to send it
            to your Daily Plan.
          </p>

          {!isPastWeek && (
            <form
              ref={formRef}
              action={formAction}
              className="mb-3 flex flex-wrap gap-2"
            >
              <input type="hidden" name="week_start" value={weekStart} />
              <input
                name="title"
                type="text"
                required
                placeholder="Add something for this week…"
                className="w-full min-w-0 basis-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
              />
              {projects.length > 0 && (
                <select
                  name="linked_project_id"
                  defaultValue=""
                  aria-label="Project"
                  className="min-w-0 flex-1 truncate rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {truncateProjectName(p.name)}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add
              </button>
            </form>
          )}
          {state && "error" in state && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {state.error}
            </p>
          )}

          {pool.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-light">
              {isPastWeek
                ? "Nothing was staged for this week."
                : "Nothing staged for this week yet. Add something above, or pull an item up from Someday."}
            </p>
          ) : (
            <div className="space-y-2">
              {pool.map((item) => (
                <PoolRow
                  key={item.id}
                  item={item}
                  weekDays={weekDays}
                  today={today}
                  dayLoad={dayLoad}
                  projectName={
                    item.linked_project_id
                      ? (projectMap.get(item.linked_project_id) ?? null)
                      : null
                  }
                />
              ))}
            </div>
          )}
        </section>

        {!isPastWeek && carryItems.length > 0 && (
          <section>
            <h2 className="font-handwriting text-lg text-ink">
              Still open from before
            </h2>
            <p className="mb-3 mt-0.5 text-xs text-ink-light">
              These slipped past without being finished. Bring them into this
              week or let them go.
            </p>
            <div className="space-y-2">
              {carryItems.map((item) => (
                <CarryRow key={item.id} item={item} weekStart={weekStart} />
              ))}
            </div>
          </section>
        )}

        {!isPastWeek && (
          <section>
            <h2 className="font-handwriting text-lg text-ink">
              Someday — review these
            </h2>
            <p className="mb-3 mt-0.5 text-xs text-ink-light">
              Your parked list. Anything ready to happen this week?
            </p>
            {someday.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-light">
                Nothing parked.
              </p>
            ) : (
              <div className="space-y-2">
                {someday.map((item) => (
                  <SomedayReviewRow
                    key={item.id}
                    item={item}
                    weekStart={weekStart}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
