# Deployment

## Vercel

This repository uses Next.js App Router pages and a Next.js API catch-all that forwards `/api/*` requests to Express. Deploy it as a Next.js project; do not deploy `public/` as a static site or set a custom output directory.

1. Import `Kittencode-co-ltd/FUFU_partner` into Vercel.
2. Keep the detected Next.js framework, root directory, install command, build command (`npm run build`), and output settings at their defaults.
3. Add the production variables below under Vercel Project Settings → Environment Variables. Set them for Production, and add appropriate staging Supabase values for Preview if previews should connect to staging.
4. Apply all pending SQL migrations from `supabase/migrations/` to the matching Supabase project before directing users to the deployment.
5. Deploy and confirm `/`, `/login`, `/dashboard`, `/api/auth/*`, and a Supabase-backed workflow.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production` for Production. |
| `Project_URL` | Yes | Remote Supabase project URL; never a localhost URL in hosted environments. |
| `publishable_key` | Yes | Supabase publishable/anon key used by the portal and API. |
| `service_role_key` | Yes for full store access | Supabase service-role key used server-side for privileged store lookups. Keep secret; never prefix with `NEXT_PUBLIC_`. |
| `CORS_ORIGINS` | Recommended | Comma-separated trusted origins. The production partner and webapp domains are already allowed by the API. |
| `NEXT_PUBLIC_WEBAPP_URL` | If using app-origin links | Public webapp URL embedded into the frontend during the build. |
| `ERROR_MONITOR_URL` | Optional | Error collector endpoint. |

Do not configure a static export. Vercel builds the Next.js pages and deploys the API catch-all as a serverless function. Local self-hosting remains available through `npm run build` followed by `npm start`.

## GitHub checks

The `Partner and Supabase CI` workflow runs on pull requests and pushes to `main` and `mvp/**`. It installs from the lockfile, runs lint and tests, builds the app, scans for secrets, and starts a local Supabase instance for database and API integration checks. Configure the repository to require this workflow before merging if branch protection is enabled.

## Release checklist

- Confirm Vercel Production uses the production Supabase project and Preview uses staging.
- Confirm all required production secrets are set in Vercel, not in GitHub files or client-side variables.
- Apply migrations and database tests to the intended Supabase project.
- Review the Vercel build and serverless function logs after deployment.
- Verify login, store selection (including inactive stores), and read/write access for an active store.
