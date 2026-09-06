"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";

// ─── Nav icons (inline SVGs, no icon library needed) ─────────────────────────

function IconDailyPlan() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="13" x2="10" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconWeekly() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <rect x="3" y="4.6" width="14" height="12.4" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 2.6V6M13 2.6V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path
        d="M8.3 9.6H12L9.9 14.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconActivities() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <polyline points="4,10 8,14 16,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="2" x2="7" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="13" y1="2" x2="13" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconYearAtAGlance() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="10" y1="3" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="10" x2="14" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconAnnualStrategies() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <polyline points="3,14 7,9 11,11 17,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconMonthlyPriorities() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <polygon points="10,2 12.5,7.5 18,8.3 14,12.2 15,17.5 10,14.8 5,17.5 6,12.2 2,8.3 7.5,7.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function IconProjectPlanner() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="2" y1="9" x2="18" y2="9" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="8" y1="5" x2="8" y2="16" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconMeetingPlanner() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="14" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 17c0-2.8 2.2-5 5-5h0.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 17c0-2.2 1.6-4 3.5-4s3.5 1.8 3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconCommunicationPlanner() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d="M17 3H3a1 1 0 00-1 1v9a1 1 0 001 1h3l3 3 3-3h5a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function IconExpenseRecord() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 6v1m0 6v1M8 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <text x="9" y="13" fontSize="7" fill="currentColor" fontWeight="bold">$</text>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Nav item definition ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/daily-plan",            label: "Daily Plan",             Icon: IconDailyPlan },
  { href: "/weekly",                label: "Weekly",                 Icon: IconWeekly },
  { href: "/activities/a",          label: "A Activities",           Icon: IconActivities },
  { href: "/activities/b",          label: "B Activities",           Icon: IconActivities },
  { href: "/someday",               label: "Someday",                Icon: IconMonthlyPriorities },
  { href: "/calendar",              label: "Calendar",               Icon: IconCalendar },
  { href: "/annual-strategies",     label: "Goals",                  Icon: IconAnnualStrategies },
  { href: "/project-planner",       label: "Project Planner",        Icon: IconProjectPlanner },
  { href: "/meeting-planner",       label: "Meeting Planner",        Icon: IconMeetingPlanner },
  { href: "/communication-planner", label: "Communication Planner",  Icon: IconCommunicationPlanner },
  { href: "/karmic",                label: "Karmic Management",       Icon: IconActivities },
  { href: "/giving",                label: "Giving",                 Icon: IconActivities },
  { href: "/settings",              label: "Settings",               Icon: IconSettings },
] as const;

// ─── Chevron icons ────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <polyline points="13,5 7,10 13,15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <polyline points="7,5 13,10 7,15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  displayName?: string | undefined;
  displayEmail: string;
  /** In drawer mode (mobile), show as overlay drawer */
  drawerMode?: boolean;
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar({
  collapsed,
  onToggleCollapse,
  displayName,
  displayEmail,
  drawerMode = false,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (drawerMode && onClose) onClose();
  };

  return (
    <aside
      className={[
        "flex flex-col border-r border-blue-100 bg-white transition-all duration-200",
        drawerMode ? "h-full w-72" : collapsed ? "w-16" : "w-60",
        drawerMode ? "" : "flex-shrink-0",
      ].join(" ")}
    >
      {/* ── Logo — click to toggle collapse (desktop) or close (drawer) ─── */}
      <div className="flex h-16 items-center gap-3 px-3 border-b border-blue-50">
        <button
          onClick={drawerMode ? onClose : onToggleCollapse}
          className={[
            "flex items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-blue-50 min-w-0",
            drawerMode ? "flex-1" : "w-full",
          ].join(" ")}
          aria-label={drawerMode ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={!drawerMode ? (collapsed ? "Expand sidebar" : "Collapse sidebar") : undefined}
        >
          <Image
            src="/favicon.svg"
            alt="Priority Manager logo"
            width={32}
            height={32}
            className="shrink-0"
            priority
          />
          {(!collapsed || drawerMode) && (
            <span className="font-handwriting text-xl text-ink truncate">
              Priority Manager
            </span>
          )}
        </button>
        {/* Close ✕ in drawer mode (secondary affordance) */}
        {drawerMode && (
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-ink-light hover:bg-blue-50 shrink-0"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
              <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={handleLinkClick}
                  className={[
                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium tracking-wide transition",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-ink-light hover:bg-blue-50 hover:text-blue-700",
                    collapsed && !drawerMode ? "justify-center" : "",
                  ].join(" ")}
                  title={collapsed && !drawerMode ? label : undefined}
                >
                  <Icon />
                  {(!collapsed || drawerMode) && (
                    <span className="truncate">{label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="border-t border-blue-100 px-3 py-4 space-y-3">
        {(!collapsed || drawerMode) ? (
          <>
            <div className="px-1 min-w-0">
              {displayName && (
                <p className="text-sm font-medium text-ink truncate">{displayName}</p>
              )}
              <p className="text-xs text-ink-light truncate">{displayEmail}</p>
            </div>
            <p className="px-1 text-xs font-medium text-ink-light">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <SignOutButton />
          </>
        ) : (
          /* Rail mode: just sign-out icon */
          <div className="flex justify-center" title="Sign out">
            <SignOutButton iconOnly />
          </div>
        )}

        {/* Hint: tap logo to collapse/expand — no separate button needed */}
      </div>
    </aside>
  );
}
