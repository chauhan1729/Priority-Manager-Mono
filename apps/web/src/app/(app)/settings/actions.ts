"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpdateReminderPreferencesData {
  eod_review_enabled?: boolean;
  eod_review_time?: string; // "HH:MM"
  meeting_reminder_minutes_before?: number;
  morning_summary_enabled?: boolean;
  morning_summary_time?: string; // "HH:MM"
  birthday_reminder_days_before?: number;
  travel_reminder_days_before?: number;
  renewal_reminder_days_before?: number;
  activity_starting_enabled?: boolean;
  activity_reminder_minutes_before?: number;
  activity_overdue_enabled?: boolean;
  event_reminder_minutes_before?: number;
  currency_code?: string;
  notification_sound?: string;
  notification_sound_enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns the current user's reminder preferences, or null if not yet created.
 * The UI should show defaults when null and create on first save.
 */
export async function getReminderPreferences() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("reminder_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Upserts the current user's reminder preferences.
 * Creates the row on first call (upsert by user_id unique constraint).
 */
export async function updateReminderPreferences(
  data: UpdateReminderPreferencesData,
): Promise<{ error: string } | void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Validate time fields format. Postgres `time` columns round-trip as "HH:MM:SS",
  // so accept an optional seconds component and normalize back to "HH:MM" for storage.
  const timeFields = ["eod_review_time", "morning_summary_time"] as const;
  for (const field of timeFields) {
    const val = data[field];
    if (val !== undefined) {
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(val)) {
        return { error: `${field} must be in HH:MM format` };
      }
      data[field] = val.slice(0, 5);
    }
  }

  // Validate numeric fields
  const minuteFields = [
    "meeting_reminder_minutes_before",
    "activity_reminder_minutes_before",
    "event_reminder_minutes_before",
  ] as const;
  for (const field of minuteFields) {
    const val = data[field];
    if (val !== undefined && (val < 0 || val > 120)) {
      return { error: `${field} must be 0–120` };
    }
  }

  const daysFields = [
    "birthday_reminder_days_before",
    "travel_reminder_days_before",
    "renewal_reminder_days_before",
  ] as const;
  for (const field of daysFields) {
    const val = data[field];
    if (val !== undefined && (val < 0 || val > 30)) {
      return { error: `${field} must be 0–30` };
    }
  }

  const { error } = await supabase.from("reminder_preferences").upsert(
    {
      user_id: user.id,
      ...data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
// Profile timezone + eod_review_time (kept in both profiles and reminder_preferences)
// ---------------------------------------------------------------------------

export interface UpdateProfilePrefsData {
  timezone?: string;
  eod_review_time?: string | null; // "HH:MM" or null
}

/**
 * Updates the user's profile-level timezone and eod_review_time.
 * These mirror reminder_preferences but are also stored on the profile for easy access.
 */
export async function updateProfilePrefs(
  data: UpdateProfilePrefsData,
): Promise<{ error: string } | void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
}
