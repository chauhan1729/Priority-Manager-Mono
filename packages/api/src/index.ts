/**
 * @pm/api — Data-access layer.
 *
 * Each feature module exports:
 *   - query key factories
 *   - React Query hooks (useQuery / useMutation wrappers)
 *
 * All hooks receive a typed Supabase client so they work identically
 * in Next.js (server or client components) and Expo.
 *
 * Modules are added incrementally as features are built.
 */

export { queryClient } from "./query-client";

// Feature modules — uncomment as implemented
// export * from "./queries/activities";
// export * from "./queries/calendar-events";
// export * from "./queries/meetings";
// export * from "./queries/contacts";
// export * from "./queries/projects";
// export * from "./queries/annual-goals";
// export * from "./queries/monthly-priorities";
// export * from "./queries/year-entries";
// export * from "./queries/expenses";
// export * from "./queries/schedule-instances";
