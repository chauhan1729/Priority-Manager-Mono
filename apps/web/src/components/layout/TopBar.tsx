"use client";

import Image from "next/image";

interface TopBarProps {
  onMenuOpen: () => void;
}

/** Mobile-only top bar: logo (tappable) + App Name. Hidden on md+. */
export function TopBar({ onMenuOpen }: TopBarProps) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-blue-100 bg-white px-4 md:hidden">
      {/* Logo — taps to open the sidebar drawer (no hamburger) */}
      <button
        onClick={onMenuOpen}
        className="flex items-center gap-2.5 rounded-md p-1 -ml-1 hover:bg-blue-50 transition"
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
        <span className="font-handwriting text-lg text-ink">Priority Manager</span>
      </button>
    </header>
  );
}
