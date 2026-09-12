# Supabase for OperatorOS

Browser-only setup. No local CLI.

## Live app

https://operator-os-rdk1.vercel.app

## Project

- Dashboard: https://supabase.com/dashboard/project/crughgiwfhhbnpbzaifm
- API URL: https://crughgiwfhhbnpbzaifm.supabase.co

## Already applied

1. `supabase/migrations/20260912080000_core_workspace.sql`
2. Run `supabase/migrations/20260912083000_workspace_bootstrap_policies.sql` in the SQL Editor so a signed-in user can create a workspace.

## Auth URLs in the dashboard

Authentication → URL Configuration:

- Site URL: https://operator-os-rdk1.vercel.app
- Redirect allow list: https://operator-os-rdk1.vercel.app/auth/callback

## Vercel env

Project Settings → Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only, not required for first-run workspace create)

## First run in the browser

1. Open https://operator-os-rdk1.vercel.app/login
2. Create account or sign in.
3. Confirm email if Supabase asks.
4. Name the workspace (solo or team).
5. Land on /app.
