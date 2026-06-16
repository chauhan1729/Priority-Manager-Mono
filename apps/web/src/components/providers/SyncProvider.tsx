"use client";

/**
 * SyncProvider
 * Spec §14: connectivity-aware offline sync.
 *
 * - Detects online/offline state via navigator.onLine + window events.
 * - On coming back online, drains the localStorage sync queue to Supabase.
 * - Exposes sync state (pendingCount, isSyncing, hasErrors) via context.
 * - Renders SyncStatusIndicator in the sidebar footer area.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { getRetryable } from "@pm/domain";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { drainQueue } from "@/lib/sync/supabase-sync";
import { getPendingCount, loadQueue } from "@/lib/sync/web-sync-store";
import { SyncStatusIndicator } from "@/components/ui/SyncStatusIndicator";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  hasErrors: boolean;
}

const SyncContext = createContext<SyncState>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  hasErrors: false,
});

export function useSyncState(): SyncState {
  return useContext(SyncContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SyncProvider({ children }: { children: React.ReactNode }) {
  // Seed to `true` so the first client render matches the server (which has no
  // `navigator`). The real connectivity is read in useEffect after mount —
  // reading navigator.onLine during render causes a hydration mismatch.
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);

  // Refresh pending count from localStorage
  const refreshPending = useCallback(() => {
    setPendingCount(getPendingCount());
  }, []);

  // Drain queue when back online
  const drain = useCallback(async () => {
    const queue = loadQueue();
    const retryable = getRetryable(queue);
    if (retryable.length === 0) {
      refreshPending();
      return;
    }

    setIsSyncing(true);
    setHasErrors(false);

    try {
      const supabase = createSupabaseBrowserClient();
      const result = await drainQueue(supabase, retryable);

      if (result.errors > 0 || result.exhausted.length > 0) {
        setHasErrors(true);
        console.warn("[sync] Some items failed:", result);
      }
    } catch (err) {
      setHasErrors(true);
      console.error("[sync] Drain failed:", err);
    } finally {
      setIsSyncing(false);
      refreshPending();
    }
  }, [refreshPending]);

  // Set up online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      drain().catch(() => {});
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Sync real connectivity now that we're on the client (post-hydration).
    setIsOnline(navigator.onLine);

    // Initial load
    refreshPending();

    // If already online and there's a queue, drain it
    if (navigator.onLine) {
      drain().catch(() => {});
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [drain, refreshPending]);

  const state: SyncState = { isOnline, pendingCount, isSyncing, hasErrors };

  return (
    <SyncContext.Provider value={state}>
      {children}
      {/* Render sync indicator as a floating badge (portal-like) */}
      <div className="fixed bottom-4 left-4 z-50">
        <SyncStatusIndicator
          isOnline={isOnline}
          pendingCount={pendingCount}
          isSyncing={isSyncing}
          hasErrors={hasErrors}
        />
      </div>
    </SyncContext.Provider>
  );
}
