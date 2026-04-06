import { type Meeting } from "@pm/types";

/** Returns true if the meeting's end time has passed. */
export function isMeetingPast(meeting: Meeting): boolean {
  return new Date(meeting.end_at) < new Date();
}

/** Returns true if the meeting is currently in progress (started but not yet ended). */
export function isMeetingRunning(meeting: Meeting): boolean {
  const now = new Date();
  return new Date(meeting.start_at) <= now && now < new Date(meeting.end_at);
}

/**
 * Returns true when a meeting's time has passed but status is still "upcoming".
 * Spec §10.9: prompt user to classify/update rather than silently auto-finalizing.
 */
export function needsStatusUpdatePrompt(meeting: Meeting): boolean {
  return isMeetingPast(meeting) && meeting.status === "upcoming";
}

/** Spec §10.9: Past meetings — only key_takeaways are editable. */
export function getMeetingEditableFields(
  meeting: Meeting,
): (keyof Meeting)[] {
  if (isMeetingPast(meeting)) {
    // Past meeting — only takeaways + status editable (status update prompt)
    return ["key_takeaways", "status"];
  }

  // Future meeting — all fields editable
  return [
    "title",
    "linked_contact_id",
    "date",
    "start_at",
    "end_at",
    "duration_minutes",
    "agenda",
    "key_takeaways",
    "recurrence_rule",
    "status",
  ];
}

/** Returns true if the meeting's scheduled time has passed and needs takeaway prompt. */
export function needsTakeawayPrompt(meeting: Meeting): boolean {
  return (
    isMeetingPast(meeting) &&
    !meeting.key_takeaways &&
    meeting.status !== "cancelled"
  );
}

/**
 * Expands a list of meetings (including recurring ones) into all occurrences
 * that fall within [startDate, endDate] (ISO date strings, inclusive).
 *
 * Non-recurring meetings are passed through as-is.
 * Recurring meetings generate synthetic occurrence objects with the correct
 * `date`, `start_at`, and `end_at` for each occurrence within the range.
 *
 * The original meeting record's id is preserved so UI can still navigate to it.
 */
export function expandRecurringMeetings(
  meetings: Meeting[],
  startDate: string,
  endDate: string,
): Meeting[] {
  const result: Meeting[] = [];

  for (const meeting of meetings) {
    if (!meeting.recurrence_rule) {
      // No recurrence — include only if within range
      if (meeting.date >= startDate && meeting.date <= endDate) {
        result.push(meeting);
      }
      continue;
    }

    // Generate occurrences from the meeting's own date through endDate
    const originDate = meeting.date; // "YYYY-MM-DD"
    const durationMs =
      new Date(meeting.end_at).getTime() - new Date(meeting.start_at).getTime();

    let current = new Date(`${originDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const rangeStart = new Date(`${startDate}T00:00:00`);

    // Safety cap: max 366 iterations to prevent infinite loops
    let iterations = 0;
    while (current <= end && iterations < 366) {
      iterations++;
      const occDate = toISO(current);

      if (occDate >= startDate) {
        // Compute corrected start_at/end_at for this occurrence
        // Keep the time-of-day from the original start_at
        const origStart = new Date(meeting.start_at);
        const occStart = new Date(current);
        occStart.setUTCHours(
          origStart.getUTCHours(),
          origStart.getUTCMinutes(),
          origStart.getUTCSeconds(),
          0,
        );
        const occEnd = new Date(occStart.getTime() + durationMs);

        result.push({
          ...meeting,
          date: occDate,
          start_at: occStart.toISOString(),
          end_at: occEnd.toISOString(),
        });
      }

      // Advance by recurrence interval
      if (meeting.recurrence_rule === "daily") {
        current.setDate(current.getDate() + 1);
      } else if (meeting.recurrence_rule === "weekly") {
        current.setDate(current.getDate() + 7);
      } else if (meeting.recurrence_rule === "monthly") {
        current.setMonth(current.getMonth() + 1);
      } else {
        break; // unknown rule — stop
      }

      if (current < rangeStart) continue; // skip past-range occurrences quickly
    }
  }

  return result.sort((a, b) => a.start_at.localeCompare(b.start_at));
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
