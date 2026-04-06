"use client";

import { useEffect } from "react";

interface Props {
  onClose: () => void;
}

/**
 * Celebrates task completion with an encouraging message.
 * Auto-dismisses after 4 seconds, or user can close manually.
 */
export function CompletionCelebrationModal({ onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center space-y-4 animate-[fadeInUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl">🎉</div>
        <div>
          <p className="font-handwriting text-2xl text-ink">You finished this cycle.</p>
          <p className="mt-1 text-base font-medium text-blue-700">You get things done.</p>
          <p className="mt-2 text-sm text-ink-light">Congratulations!</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Keep going →
        </button>
      </div>
    </div>
  );
}
