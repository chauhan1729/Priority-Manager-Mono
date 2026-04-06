import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReminderSettingsView } from "@/components/settings/ReminderSettingsView";
import { getReminderPreferences } from "./actions";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch profile for timezone
  const { data: profile } = user
    ? await supabase.from("profiles").select("timezone, eod_review_time").eq("id", user.id).single()
    : { data: null };

  const prefs = await getReminderPreferences();

  return (
    <div className="px-6 py-8 md:px-8">
      <div className="mb-8">
        <h1 className="font-handwriting text-2xl text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-light">
          Configure notification preferences and reminders.
        </p>
      </div>

      <ReminderSettingsView
        prefs={prefs}
        timezone={profile?.timezone ?? "UTC"}
      />
    </div>
  );
}
