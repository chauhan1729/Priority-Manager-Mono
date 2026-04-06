"use client";

/**
 * Bundles all client-only providers into one component so they can be
 * imported by the Server Component layout without forcing it client-side.
 */

import { NotificationProvider } from "./NotificationProvider";
import { SyncProvider } from "./SyncProvider";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SyncProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </SyncProvider>
  );
}
