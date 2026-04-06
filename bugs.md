when i deploy this on vercel, vercel throws this error:
11:07:31.926 
@pm/web:build: > Build error occurred
11:07:31.929 
@pm/web:build: [Error: Failed to collect page data for /daily-plan/print] {
11:07:31.929 
@pm/web:build:   type: 'Error'
11:07:31.929 
@pm/web:build: }
11:07:31.944 
@pm/web:build:  ELIFECYCLE  Command failed with exit code 1.
11:07:31.962 
 ERROR  @pm/web#build: command (/vercel/path0/apps/web) /pnpm10/node_modules/.bin/pnpm run build exited (1)
11:07:31.963 
 WARNING  finished with warnings
11:07:31.963 
Warning - the following environment variables are set on your Vercel project, but missing from "turbo.json". These variables WILL NOT be available to your application and may cause your build to fail. Learn more at https://turborepo.dev/docs/crafting-your-repository/using-environment-variables#platform-environment-variables
11:07:31.964 
11:07:31.964 
[warn] @pm/web#build
11:07:31.964 
[warn]   - SUPABASE_SERVICE_ROLE_KEY 