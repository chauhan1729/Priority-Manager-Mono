/**
 * GET /daily-plan/print?date=YYYY-MM-DD
 * Returns a print-optimized HTML page of the daily plan.
 * Spec §15: PDF daily plan export.
 *
 * The returned HTML is styled for print and includes a script that calls
 * window.print() on load — the browser then saves as PDF via its print dialog.
 */

import { NextRequest, NextResponse } from "next/server";

import { todayISO } from "@pm/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface Activity {
  id: string;
  title: string;
  section_type: string;
  priority: string | null;
  status: string;
  estimated_minutes: number;
  linked_project_id: string | null;
}

interface Meeting {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
}

interface ScheduleInstance {
  id: string;
  source_type: string;
  source_id: string;
  start_at: string;
  end_at: string;
  focus_minutes: number | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date") ?? todayISO();

  const [
    { data: activities },
    { data: scheduleInstances },
    { data: meetings },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("id, title, section_type, priority, status, estimated_minutes, linked_project_id")
      .eq("user_id", user.id)
      .eq("activity_date", date)
      .order("created_at", { ascending: true }),
    supabase
      .from("schedule_instances")
      .select("id, source_type, source_id, start_at, end_at, focus_minutes")
      .eq("user_id", user.id)
      .eq("schedule_date", date)
      .order("start_at", { ascending: true }),
    supabase
      .from("meetings")
      .select("id, title, start_at, end_at, status")
      .eq("user_id", user.id)
      .eq("date", date),
    supabase.from("profiles").select("name").eq("id", user.id).single(),
  ]);

  const activitiesList = (activities ?? []) as Activity[];
  const instancesList = (scheduleInstances ?? []) as ScheduleInstance[];
  const meetingsList = (meetings ?? []) as Meeting[];
  const userName = (profile?.name as string | undefined) ?? user.email ?? "";

  // Build scheduled timeline entries
  const timelineItems = instancesList.map((inst) => {
    if (inst.source_type === "meeting") {
      const meeting = meetingsList.find((m) => m.id === inst.source_id);
      return {
        start: inst.start_at,
        end: inst.end_at,
        label: meeting?.title ?? "Meeting",
        type: "meeting",
      };
    }
    const activity = activitiesList.find((a) => a.id === inst.source_id);
    return {
      start: inst.start_at,
      end: inst.end_at,
      label: activity?.title ?? "Activity",
      type: "activity",
      focus: inst.focus_minutes,
    };
  });

  // Unscheduled activities
  const scheduledIds = new Set(instancesList.map((i) => i.source_id));
  const unscheduled = activitiesList.filter((a) => !scheduledIds.has(a.id));

  // Section grouping for unscheduled
  const sectionGroups: Record<string, Activity[]> = {};
  for (const a of unscheduled) {
    const key = a.section_type ?? "other";
    if (!sectionGroups[key]) sectionGroups[key] = [];
    sectionGroups[key]!.push(a);
  }

  const SECTION_LABELS: Record<string, string> = {
    work: "Work",
    outside: "Outside",
    delegated: "Delegated",
    unplanned: "Unplanned",
  };

  const PRIORITY_LABEL: Record<string, string> = { A: "A", B: "B" };

  const STATUS_SYMBOL: Record<string, string> = {
    completed: "✓",
    working: "◉",
    postponed: "→",
    cancelled: "✕",
    not_started: "○",
    delegated: "↗",
  };

  function renderTimeline(): string {
    if (timelineItems.length === 0) return "<p class='empty'>No scheduled blocks for this day.</p>";
    return timelineItems
      .map(
        (item) => `
      <div class="block ${item.type}">
        <div class="block-time">${formatTime(item.start)} – ${formatTime(item.end)}</div>
        <div class="block-label">${item.label}${item.focus ? ` <span class="focus-label">${item.focus}m focus</span>` : ""}</div>
      </div>`,
      )
      .join("");
  }

  function renderUnscheduled(): string {
    if (unscheduled.length === 0) return "<p class='empty'>All activities are scheduled.</p>";
    return Object.entries(sectionGroups)
      .map(
        ([section, acts]) => `
      <div class="section">
        <h3>${SECTION_LABELS[section] ?? section}</h3>
        <ul>
          ${acts
            .map(
              (a) => `
            <li>
              <span class="status">${STATUS_SYMBOL[a.status] ?? "○"}</span>
              ${a.priority ? `<span class="priority">${PRIORITY_LABEL[a.priority] ?? a.priority}</span>` : ""}
              <span class="task-title">${a.title}</span>
              <span class="duration">${Math.round(a.estimated_minutes / 60 * 10) / 10}h</span>
            </li>`,
            )
            .join("")}
        </ul>
      </div>`,
      )
      .join("");
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Daily Plan — ${formatDate(date)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12pt;
      color: #1a1a2e;
      background: white;
      padding: 2cm 2.5cm;
      max-width: 21cm;
      margin: 0 auto;
    }

    header {
      border-bottom: 2px solid #1a1a2e;
      padding-bottom: 0.5cm;
      margin-bottom: 0.8cm;
    }

    header h1 {
      font-family: "Patrick Hand", Georgia, cursive;
      font-size: 22pt;
      font-weight: normal;
      letter-spacing: 0.02em;
    }

    header .meta {
      font-size: 9pt;
      color: #666;
      margin-top: 3pt;
    }

    h2 {
      font-size: 13pt;
      font-weight: bold;
      margin: 0.6cm 0 0.3cm;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #333;
      border-bottom: 1px solid #ddd;
      padding-bottom: 2pt;
    }

    h3 {
      font-size: 10pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      margin: 0.4cm 0 0.2cm;
    }

    /* Timeline */
    .block {
      display: flex;
      align-items: baseline;
      gap: 0.4cm;
      padding: 4pt 0;
      border-bottom: 1px dotted #ddd;
    }

    .block-time {
      font-size: 9pt;
      color: #555;
      min-width: 3.5cm;
      font-variant-numeric: tabular-nums;
    }

    .block-label { font-size: 11pt; }

    .block.meeting .block-label { font-style: italic; }

    .focus-label {
      font-size: 8pt;
      color: #777;
      margin-left: 4pt;
    }

    /* Unscheduled */
    ul {
      list-style: none;
      padding: 0;
    }

    ul li {
      display: flex;
      align-items: baseline;
      gap: 6pt;
      padding: 3pt 0;
      border-bottom: 1px dotted #eee;
    }

    .status { font-size: 10pt; min-width: 14pt; }
    .priority {
      font-size: 8pt;
      font-weight: bold;
      background: #1a1a2e;
      color: white;
      padding: 0 3pt;
      border-radius: 2pt;
    }
    .task-title { flex: 1; }
    .duration { font-size: 9pt; color: #888; }

    .section { margin-bottom: 0.4cm; }

    .empty { font-size: 10pt; color: #999; font-style: italic; padding: 4pt 0; }

    /* Notes box */
    .notes-box {
      margin-top: 0.8cm;
      border: 1px solid #ccc;
      padding: 0.4cm;
      min-height: 4cm;
    }

    .notes-box h2 { border: none; padding: 0; margin-bottom: 0.3cm; }

    @media print {
      body { padding: 0; }
      @page { margin: 2cm 2.5cm; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Daily Plan</h1>
    <p class="meta">${formatDate(date)}${userName ? ` · ${userName}` : ""}</p>
  </header>

  <h2>Timeline</h2>
  ${renderTimeline()}

  <h2 style="margin-top:0.8cm">Unscheduled</h2>
  ${renderUnscheduled()}

  <div class="notes-box">
    <h2>Notes</h2>
  </div>

  <script>window.addEventListener('load', () => window.print());</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
