import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from '../src/lib/supabase/client';
import { AuthProvider, useAuth } from '../src/components/providers/AuthProvider';
import { SyncProvider, SyncIndicator } from '../src/components/providers/SyncProvider';
import { NotificationProvider } from '../src/components/providers/NotificationProvider';

// Keep splash visible until we are ready
SplashScreen.preventAutoHideAsync();

// Mobile QueryClient — same defaults as @pm/api but with refetchOnWindowFocus off
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 10,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ---------------------------------------------------------------------------
// Auth guard — runs inside AuthProvider so useAuth() is available
// ---------------------------------------------------------------------------

function AuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)/daily-plan');
    }
  }, [user, loading, segments, router]);

  return null;
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      PatrickHand: PatrickHand_400Regular,
      Inter: Inter_400Regular,
      'Inter-Medium': Inter_500Medium,
      'Inter-SemiBold': Inter_600SemiBold,
    })
      .catch(console.warn)
      .finally(() => setFontsLoaded(true));
  }, []);

  // Keep splash screen until fonts AND auth state are both resolved.
  // The InnerLayout below hides it once auth loading clears.

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider>
          <AuthProvider>
            <SyncProvider>
              <NotificationProvider>
                <InnerLayout />
              </NotificationProvider>
            </SyncProvider>
          </AuthProvider>
        </SupabaseProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// Separate component so useAuth() can be called after AuthProvider mounts
function InnerLayout() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  return (
    <>
      <StatusBar style="dark" />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <SyncIndicator />
    </>
  );
}
