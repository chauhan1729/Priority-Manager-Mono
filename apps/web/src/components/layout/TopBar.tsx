"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

interface TopBarProps {
  onMenuOpen: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  "/daily-plan": "Daily Plan",
  "/activities": "Activities",
  "/calendar": "Calendar",
  "/year-at-a-glance": "Year at a Glance",
  "/annual-strategies": "Annual Strategies",
  "/monthly-priorities": "Monthly Priorities",
  "/project-planner": "Project Planner",
  "/meeting-planner": "Meeting Planner",
  "/communication-planner": "Communication Planner",
  "/expense-record": "Expense Record",
  "/settings": "Settings",
};

function getTitleFromPath(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  // Match prefix for nested routes like /project-planner/[id]
  const base = "/" + pathname.split("/").filter(Boolean)[0];
  return ROUTE_TITLES[base] ?? "Priority Manager";
}

/** Mobile-only top bar: logo (tappable to open drawer) + page title. Hidden on md+. */
export function TopBar({ onMenuOpen }: TopBarProps) {
  const pathname = usePathname();
  const title = getTitleFromPath(pathname);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-blue-100 bg-white px-4 md:hidden">
      {/* Logo — taps to open the sidebar drawer */}
      <button
        onClick={onMenuOpen}
        className="flex shrink-0 items-center rounded-md p-1 -ml-1 hover:bg-blue-50 transition"
        aria-label="Open navigation menu"
      >
        <Image
          src="/favicon.svg"
          alt="Priority Manager logo"
          width={28}
          height={28}
          className="shrink-0"
          priority
        />
      </button>

      <span className="font-handwriting text-xl text-ink truncate">
        {title}
      </span>
    </header>
  );
}
