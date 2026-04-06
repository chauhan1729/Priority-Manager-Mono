"use client";

import { useAuthContext } from "@/components/providers/AuthProvider";

/**
 * Returns the current authenticated user and loading state.
 * Must be used inside a component wrapped by AuthProvider.
 *
 * @example
 * const { user, loading } = useUser();
 */
export function useUser() {
  return useAuthContext();
}
