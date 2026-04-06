import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, View } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '../../lib/supabase/client';
import { drainQueue, getPendingCount } from '../../lib/sync/async-storage-sync';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SyncContextValue {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  hasErrors: boolean;
}

const SyncContext = createContext<SyncContextValue>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  hasErrors: false,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const onlineRef = useRef(true);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const drain = useCallback(async () => {
    if (!onlineRef.current) return;
    const count = await getPendingCount();
    if (count === 0) return;

    setIsSyncing(true);
    setHasErrors(false);
    try {
      const result = await drainQueue(supabase);
      if (result.errors > 0) setHasErrors(true);
    } catch {
      setHasErrors(true);
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  // Network state listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected === true;
      onlineRef.current = connected;
      setIsOnline(connected);
      if (connected) {
        drain();
      }
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      const connected = state.isConnected === true;
      onlineRef.current = connected;
      setIsOnline(connected);
    });

    return () => unsubscribe();
  }, [drain]);

  // App foreground listener
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        drain();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [drain]);

  // Refresh pending count on mount
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing, hasErrors }}>
      {children}
    </SyncContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSyncState(): SyncContextValue {
  return useContext(SyncContext);
}

// ---------------------------------------------------------------------------
// SyncIndicator — floating badge for offline / syncing / error states
// ---------------------------------------------------------------------------

export function SyncIndicator() {
  const { isOnline, isSyncing, hasErrors, pendingCount } = useSyncState();

  // Only show when there is something to communicate
  if (isOnline && !isSyncing && !hasErrors && pendingCount === 0) return null;

  let bg: string;
  let label: string;

  if (!isOnline) {
    bg = colors.gray[600];
    label = 'Offline';
  } else if (isSyncing) {
    bg = colors.blue[600];
    label = `Syncing${pendingCount > 0 ? ` (${pendingCount})` : ''}…`;
  } else if (hasErrors) {
    bg = colors.red[600];
    label = 'Sync error';
  } else if (pendingCount > 0) {
    bg = colors.amber[500];
    label = `${pendingCount} pending`;
  } else {
    return null;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]} pointerEvents="none">
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: spacing['3xl'],
    alignSelf: 'center',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    zIndex: 9998,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  badgeText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#FFFFFF',
  },
});
