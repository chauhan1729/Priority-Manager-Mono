"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Module-level event system — no React context required.
// Call showToast() from anywhere (server actions can't use it, but client
// components can call it directly after awaiting an action).
// ---------------------------------------------------------------------------

type Toast = { id: string; message: string; type: "success" | "error" };
type Listener = (toasts: Toast[]) => void;

let _toasts: Toast[] = [];
const _listeners: Set<Listener> = new Set();

function notify() {
  _listeners.forEach((l) => l([..._toasts]));
}

export function showToast(message: string, type: "success" | "error" = "success") {
  const id = crypto.randomUUID();
  _toasts = [..._toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  }, 3500);
}

// ---------------------------------------------------------------------------
// Toaster component — render once in the root layout.
// Fixed-position, stacks from bottom-right.
// ---------------------------------------------------------------------------

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener: Listener = (t) => setToasts(t);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
