"use client";

import { useState, useEffect, useCallback } from "react";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileDrawer } from "@/components/ui/MobileDrawer";

interface AppShellProps {
  children: React.ReactNode;
  displayName?: string | undefined;
  displayEmail: string;
}

const STORAGE_KEY = "pm.sidebarCollapsed";

/**
 * Client shell that owns sidebar collapsed/open state.
 *
 * Behaviour by breakpoint:
 *  mobile  (< 768px)  — sidebar hidden; TopBar hamburger opens a MobileDrawer
 *  tablet  (768–1023) — sidebar starts collapsed (rail, 64px)
 *  desktop (≥ 1024px) — sidebar starts expanded (240px), user can collapse
 *
 * Collapse preference is persisted in localStorage.
 */
export function AppShell({ children, displayName, displayEmail }: AppShellProps) {
  // Desktop/tablet: collapsed = rail mode
  const [collapsed, setCollapsed] = useState(false);
  // Mobile: drawer open
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Track if we have read from localStorage yet (avoid hydration mismatch)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // On tablet (< 1024px) default to collapsed; on desktop respect saved preference
    const isNarrow = window.innerWidth < 1024;
    if (isNarrow) {
      setCollapsed(true);
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setCollapsed(saved === "true");
    }
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {/* ── Desktop / Tablet sidebar (hidden on mobile) ─────────────────── */}
      <div className="hidden md:block">
        {mounted && (
          <Sidebar
            collapsed={collapsed}
            onToggleCollapse={handleToggleCollapse}
            displayName={displayName}
            displayEmail={displayEmail}
          />
        )}
        {/* Placeholder during SSR / before mount to prevent layout shift */}
        {!mounted && <div className="w-60 border-r border-blue-100 bg-white" />}
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} maxWidthClass="max-w-[280px]">
        <Sidebar
          collapsed={false}
          onToggleCollapse={closeDrawer}
          displayName={displayName}
          displayEmail={displayEmail}
          drawerMode
          onClose={closeDrawer}
        />
      </MobileDrawer>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <TopBar onMenuOpen={openDrawer} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
