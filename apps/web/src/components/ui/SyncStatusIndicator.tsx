"use client";

/**
 * Lightweight sync status indicator.
 * Shows: online/offline state + pending queue depth.
 * Spec §14: user-visible sync state where practical.
 */

interface Props {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  hasErrors: boolean;
}

export function SyncStatusIndicator({ isOnline, pendingCount, isSyncing, hasErrors }: Props) {
  // Only render if there's something worth showing
  if (isOnline && pendingCount === 0 && !isSyncing && !hasErrors) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium">
      {!isOnline ? (
        <>
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-700">Offline</span>
        </>
      ) : isSyncing ? (
        <>
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-blue-700">Syncing…</span>
        </>
      ) : hasErrors ? (
        <>
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-red-700">Sync error</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="text-amber-700">{pendingCount} pending</span>
        </>
      ) : null}
    </div>
  );
}
