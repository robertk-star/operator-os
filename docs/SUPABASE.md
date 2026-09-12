# Supabase for OperatorOS

This template uses its own Supabase project. Do not point it at the private RobertOS database.

## Project

- Dashboard: https://supabase.com/dashboard/project/crughgiwfhhbnpbzaifm
- API URL: https://crughgiwfhhbnpbzaifm.supabase.co

## Local and Vercel env

Copy `.env.example` to `.env.local`.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only, never shipped to the browser)

Get the keys from Project Settings → API.

On Vercel, add the same three values to the `operator-os` project after Git is linked.

## Apply schema

1. Open SQL Editor in the dashboard.
2. Paste and run `supabase/migrations/20260912080000_core_workspace.sql`.
3. Confirm tables exist under Table Editor.

Or use the CLI:

```bash
npx supabase db push --project-ref crughgiwfhhbnpbzaifm
```

## Rules

- One workspace is the tenant.
- Every core row has `workspace_id`.
- RLS allows members of that workspace only.
- Service role is for server routes and first-run provisioning only.
- Packs add tables later. They do not reuse RobertOS vertical tables.
