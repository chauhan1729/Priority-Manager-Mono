import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Toaster } from "@/components/ui/Toaster";
import { ClientProviders } from "@/components/providers/ClientProviders";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Protected app shell — spec §16.1.
 * Server Component: reads authenticated user from cookie session.
 * Delegates all responsive layout logic to the AppShell client component.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but be safe
  const displayName = user?.user_metadata?.["full_name"] as string | undefined;
  const displayEmail = user?.email ?? "";

  return (
    <ClientProviders>
      <AppShell displayName={displayName} displayEmail={displayEmail}>
        {children}
      </AppShell>
      <Toaster />
    </ClientProviders>
  );
}
