# Authentication Architecture

## Overview

Priority Manager uses **Supabase Auth** as the single identity layer across web and mobile. All platforms share the same `auth.users` table; the `public.profiles` table extends it with app-specific fields.

---

## Providers

| Provider | Method | Status |
|----------|--------|--------|
| Email + password | `signInWithPassword` / `signUp` | ✅ Implemented |
| Google | OAuth 2.0 redirect | ✅ Wired (requires Supabase Dashboard config) |
| Apple | OAuth 2.0 redirect | ✅ Wired (requires Supabase Dashboard config) |

---

## Web flow (Next.js 15 App Router)

### Email sign-in
```
LoginForm (client) → signInWithEmail server action
  → supabase.auth.signInWithPassword()
  → success: redirect("/daily-plan")
  → failure: return { error } → displayed in form
```

### Email sign-up
```
SignUpForm (client) → signUpWithEmail server action
  → supabase.auth.signUp({ data: { full_name } })
  → Supabase sends confirmation email with link to /auth/callback
  → User clicks link → /auth/callback → session set → /daily-plan
```

### OAuth (Google / Apple)
```
LoginForm button → signInWithGoogle/Apple server action
  → supabase.auth.signInWithOAuth({ redirectTo: /auth/callback })
  → server action calls redirect(oauthUrl)
  → Browser hits provider consent screen
  → Provider redirects to /auth/callback?code=xxx
  → exchangeCodeForSession(code) sets cookie session
  → redirect("/daily-plan")
```

### Sign-out
```
SignOutButton (client form) → signOut server action
  → supabase.auth.signOut()
  → redirect("/login")
```

---

## Auth callback route

`/auth/callback` (Route Handler) handles:
1. OAuth redirect (`?code=xxx`)
2. Email confirmation link (`?code=xxx`)

Exchanges the code for a session via `exchangeCodeForSession`. On error, redirects to `/login?error=...`.

---

## Profile creation

The DB trigger `trg_on_auth_user_created` (migration 017) fires on every `auth.users` INSERT and upserts a row in `public.profiles`:

```sql
insert into public.profiles (id, email, name, auth_provider)
values (
  new.id,
  new.email,
  coalesce(new.raw_user_meta_data->>'full_name', new.email),
  coalesce(new.raw_user_meta_data->>'provider', 'email')
)
on conflict (id) do nothing;
```

A second trigger `trg_on_profile_created` then inserts a default `reminder_preferences` row.

No manual upsert is needed in application code.

---

## Session management (web)

- Sessions are stored as **HTTP-only cookies** via `@supabase/ssr`.
- `createSupabaseServerClient()` reads cookies in Server Components, Server Actions, and Route Handlers.
- `createSupabaseBrowserClient()` reads the same cookies in Client Components (no token in `localStorage`).
- The middleware (`src/middleware.ts`) validates the session on every request:
  - Unauthenticated → redirect to `/login`
  - Authenticated on `/login` → redirect to `/daily-plan`

---

## Client-side session context

`AuthProvider` wraps the app and exposes `{ user, loading }` via React context. Use the `useUser()` hook to consume it in client components.

Server Components should call `createSupabaseServerClient().auth.getUser()` directly.

---

## Row Level Security

All tables have RLS enabled. Every policy checks `auth.uid() = user_id` (or `auth.uid() = id` for profiles). Data is fully isolated per user — no cross-user reads are possible.

---

## Mobile (Expo — future)

Mobile auth will use `@supabase/supabase-js` with `expo-secure-store` as the storage adapter so tokens are stored in the device keychain:

```typescript
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, anonKey, {
  auth: {
    storage: SecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Google/Apple sign-in on mobile will use `expo-auth-session` + `expo-crypto` with the Supabase PKCE flow.

---

## Required environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | web | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | web server only | Admin operations (future) |
| `NEXT_PUBLIC_SITE_URL` | web | Base URL for OAuth redirectTo and email links |

---

## Supabase Dashboard setup required for OAuth

1. **Google**: Auth > Providers > Google → enter Client ID + Client Secret from Google Cloud Console. Add `https://your-project.supabase.co/auth/v1/callback` as authorized redirect URI.
2. **Apple**: Auth > Providers > Apple → enter Service ID + Team ID + Key ID + private key from Apple Developer. Requires a domain with HTTPS.

---

## Security notes

- Service role key is never exposed to the client or browser.
- Sessions auto-refresh via Supabase's built-in token rotation.
- All cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Past-scheduling and data isolation are enforced at both domain layer and DB level (RLS + triggers) — auth alone is not the only guard.
