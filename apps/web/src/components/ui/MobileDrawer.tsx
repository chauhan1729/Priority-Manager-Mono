"use client";

import { useEffect } from "react";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Side the drawer slides in from. Default: "left" */
  side?: "left" | "right";
  /** Max width class. Default: "max-w-xs" (320px) */
  maxWidthClass?: string;
}

/**
 * Reusable slide-in drawer with backdrop.
 * Used by the mobile sidebar and any bottom-sheet-style filter panels.
 */
export function MobileDrawer({
  open,
  onClose,
  children,
  side = "left",
  maxWidthClass = "max-w-xs",
}: MobileDrawerProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll while drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const slideClass = side === "left"
    ? "left-0 top-0 bottom-0"
    : "right-0 top-0 bottom-0";

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`relative z-50 flex h-full w-full flex-col bg-white shadow-xl ${maxWidthClass} ${
          side === "right" ? "ml-auto" : ""
        }`}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}
