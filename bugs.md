@pm/web:build: Failed to compile.
@pm/web:build: 
@pm/web:build: ./src/components/daily-plan/DailyPlanView.tsx:93:7
@pm/web:build: Type error: This comparison appears to be unintentional because the types '"not_started" | "delegated" | "working" | "postponed"' and '"archived"' have no overlap.
@pm/web:build: 
@pm/web:build:   91 |       a.status !== "completed" &&
@pm/web:build:   92 |       a.status !== "cancelled" &&
@pm/web:build: > 93 |       a.status !== "archived",
@pm/web:build:      |       ^
@pm/web:build:   94 |   );
@pm/web:build:   95 |
@pm/web:build:   96 |   function handleCarryForward(activityId: string, linkedProjectId: string | null) {
@pm/web:build: Next.js build worker exited with code: 1 and signal: null
@pm/web:build:  ELIFECYCLE  Command failed with exit code 1.
 ERROR  @pm/web#build: command (/vercel/path0/apps/web) /pnpm10/node_modules/.bin/pnpm run build exited (1)
