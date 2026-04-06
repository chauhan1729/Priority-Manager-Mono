"use client";

import { useState } from "react";

import type { Contact } from "@pm/types";

interface Props {
  contact: Contact;
  delegatedActivityCount: number;
  isPending: boolean;
  onConfirm: (mode: "soft" | "unlink") => void;
  onClose: () => void;
}

/**
 * Safe delete confirmation modal — spec §10.7.
 * "Do not delete historical records by default."
 * Provides two options when linked activities exist.
 */
export function DeleteContactModal({
  contact,
  delegatedActivityCount,
  isPending,
  onConfirm,
  onClose,
}: Props) {
  const [mode, setMode] = useState<"soft" | "unlink">("soft");

  const hasDependents = delegatedActivityCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 className="font-handwriting text-xl text-ink">Delete Contact</h2>
          <p className="text-xs text-ink-light mt-1">
            Are you sure you want to delete <strong className="text-ink">{contact.full_name}</strong>?
          </p>
        </div>

        {hasDependents && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
            <p className="text-xs font-medium text-amber-800">
              This contact has {delegatedActivityCount} linked delegated{" "}
              {delegatedActivityCount === 1 ? "activity" : "activities"}.
              Choose how to handle them:
            </p>

            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="delete-mode"
                  value="soft"
                  checked={mode === "soft"}
                  onChange={() => setMode("soft")}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <p className="text-xs font-medium text-ink">Delete contact only</p>
                  <p className="text-[10px] text-ink-light mt-0.5">
                    Keep all historical activity records intact. Activities will
                    lose their contact reference but will remain in your history.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="delete-mode"
                  value="unlink"
                  checked={mode === "unlink"}
                  onChange={() => setMode("unlink")}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <p className="text-xs font-medium text-ink">Unlink activities and delete contact</p>
                  <p className="text-[10px] text-ink-light mt-0.5">
                    Remove contact reference from {delegatedActivityCount}{" "}
                    {delegatedActivityCount === 1 ? "activity" : "activities"}.
                    The activities themselves are preserved.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {!hasDependents && (
          <p className="text-xs text-ink-light rounded-lg bg-gray-50 px-3 py-2">
            No linked activities. The contact will be removed safely.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1 border-t border-blue-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-light hover:bg-blue-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(mode)}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete contact"}
          </button>
        </div>
      </div>
    </div>
  );
}
