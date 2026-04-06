import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Toaster } from "@/components/ui/Toaster";
import { ClientProviders } from "@/components/providers/ClientProviders";

const NAV_ITEMS = [
  { href: "/daily-plan",            label: "Daily Plan" },
  { href: "/activities",            label: "Activities" },
  { href: "/calendar",              label: "Calendar" },
  { href: "/year-at-a-glance",      label: "Year at a Glance" },
  { href: "/annual-strategies",     label: "Annual Strategies" },
  { href: "/monthly-priorities",    label: "Monthly Priorities" },
  { href: "/project-planner",       label: "Project Planner" },
  { href: "/meeting-planner",       label: "Meeting Planner" },
  { href: "/communication-planner", label: "Communication Planner" },
  { href: "/expense-record",        label: "Expense Record" },
  { href: "/settings",              label: "Settings" },
] as const;

/**
 * Protected app shell — spec §16.1.
 * Sidebar: collapsible, larger font, date at bottom, sign-out.
 * Server Component: reads authenticated user from cookie session.
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
      <div className="flex h-screen overflow-hidden bg-paper">
        {/* Sidebar — spec §16.1 */}
        <aside className="flex w-60 flex-shrink-0 flex-col border-r border-blue-100 bg-white">
          {/* Logo */}
          <div className="flex h-16 items-center px-6">
            <span className="font-handwriting text-xl text-ink">Priority Manager</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium tracking-wide text-ink-light transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer: user info + sign-out — spec §16.1 date text readable */}
          <div className="border-t border-blue-100 px-4 py-4 space-y-3">
            {/* User */}
            <div className="px-1">
              {displayName && (
                <p className="text-sm font-medium text-ink truncate">{displayName}</p>
              )}
              <p className="text-xs text-ink-light truncate">{displayEmail}</p>
            </div>

            {/* Date */}
            <p className="px-1 text-xs font-medium text-ink-light">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>

            <SignOutButton />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Global toast notifications */}
        <Toaster />
      </div>
    </ClientProviders>
  );
}
