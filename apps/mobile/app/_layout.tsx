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
import { DrawerProvider } from '../src/components/providers/DrawerProvider';
import { AppDrawer } from '../src/components/layout/AppDrawer';
import { TopBar } from '../src/components/layout/TopBar';

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
            <DrawerProvider>
              <SyncProvider>
                <NotificationProvider>
                  <InnerLayout />
                </NotificationProvider>
              </SyncProvider>
            </DrawerProvider>
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
        <Stack.Screen
          name="calendar"
          options={{ headerShown: true, header: () => <TopBar title="Calendar" /> }}
        />
        <Stack.Screen
          name="meeting-planner"
          options={{ headerShown: true, header: () => <TopBar title="Meeting Planner" /> }}
        />
        <Stack.Screen
          name="year-at-a-glance"
          options={{ headerShown: true, header: () => <TopBar title="Year at a Glance" /> }}
        />
        <Stack.Screen name="annual-strategies" />
        <Stack.Screen
          name="monthly-priorities"
          options={{ headerShown: true, header: () => <TopBar title="Monthly Priorities" /> }}
        />
        <Stack.Screen name="project-planner" />
        <Stack.Screen
          name="communication-planner"
          options={{ headerShown: true, header: () => <TopBar title="Communication Planner" /> }}
        />
        <Stack.Screen
          name="expense-record"
          options={{ headerShown: true, header: () => <TopBar title="Expense Record" /> }}
        />
        <Stack.Screen
          name="settings"
          options={{ headerShown: true, header: () => <TopBar title="Settings" /> }}
        />
        <Stack.Screen
          name="notification-test"
          options={{ headerShown: true, header: () => <TopBar title="Notification Test" /> }}
        />
      </Stack>
      <AppDrawer />
      <SyncIndicator />
    </>
  );
}
