import type { Metadata } from "next";

import type { Activity, Contact, Meeting } from "@pm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CommunicationPlannerView } from "@/components/communication/CommunicationPlannerView";

export const metadata: Metadata = { title: "Communication Planner" };

export default async function CommunicationPlannerPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: contacts },
    { data: meetings },
    { data: delegatedActivities },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("full_name", { ascending: true }),

    supabase
      .from("meetings")
      .select("*")
      .eq("user_id", user.id)
      .order("start_at", { ascending: true }),

    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("section_type", "delegated")
      .not("delegated_contact_id", "is", null)
      .not("status", "in", '("completed","cancelled")')
      .order("activity_date", { ascending: false }),
  ]);

  return (
    <CommunicationPlannerView
      contacts={(contacts ?? []) as Contact[]}
      meetings={(meetings ?? []) as Meeting[]}
      delegatedActivities={(delegatedActivities ?? []) as Activity[]}
    />
  );
}
