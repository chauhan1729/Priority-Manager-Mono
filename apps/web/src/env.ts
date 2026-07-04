import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    // Used to build OAuth redirectTo and email confirmation URLs.
    // In dev: http://localhost:3000 — in prod: your deployed domain.
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    // Web Push (VAPID) public key. Optional — when unset, push subscription is
    // disabled and the app degrades to foreground-only notifications.
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    SUPABASE_SERVICE_ROLE_KEY: process.env["SUPABASE_SERVICE_ROLE_KEY"],
    NEXT_PUBLIC_SITE_URL: process.env["NEXT_PUBLIC_SITE_URL"],
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"],
  },
});
