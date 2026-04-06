# Vercel Deployment Walkthrough

To publish your **Priority Manager (Mono)** app on Vercel, follow these steps:

## 1. Import Repository
- Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New"** > **"Project"**.
- Select your repository: `Priority-Manager-Mono`.

## 2. Project Settings
Vercel should automatically detect that this is a **Turborepo** monorepo. 

- **Root Directory**: `apps/web`
- **Framework Preset**: `Next.js`
- **Build Command**: `npx turbo build --filter=web` (Usually auto-detected)
- **Install Command**: `pnpm install` (Make sure pnpm is selected)

## 3. Environment Variables
You MUST add the following environment variables in the Project Settings during or after import:

| Variable Name | Description | Where to find |
|---------------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL | Supabase Dashboard > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key | Supabase Dashboard > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Service Role Key | Supabase Dashboard > Project Settings > API |
| `NEXT_PUBLIC_SITE_URL` | Your production URL | Your final Vercel domain (e.g., `https://priority-manager.vercel.app`) |

## 4. Why these are required?
- **Supabase Keys**: Essential for authentication and data synchronization.
- **Site URL**: Required for OAuth redirects (Google/Apple login) and email links to work correctly.
- **Root Directory**: Since this is a monorepo, Vercel needs to know that the actual web app is inside `apps/web`.

## 5. Post-Deployment Steps
Once deployed, remember to add your Vercel URL to your **Supabase Auth Redirect Allowlist**:
- Go to **Supabase Dashboard** > **Authentication** > **URL Configuration**.
- Add your Vercel domain to the **Redirect URLs**.
