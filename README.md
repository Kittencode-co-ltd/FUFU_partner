# FUFU Partner

FUFU Partner is a Next.js App Router application with an Express API and Supabase backend.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Local environment values belong in `.env`; use the checked-in `.env.example` files as templates and keep service-role credentials server-side.

## Application structure

- `app/` — Next.js pages and layouts for the landing page, authentication, onboarding, dashboard, and receipts.
- `server/` — Express entrypoint, authentication, security middleware, and `/api/*` routes.
- `public/js/partner/` — existing feature modules used inside the Next.js dashboard shell.
- `public/css/` — generated portal styles and receipt print styles.
- `supabase/` — database migrations, local configuration, edge functions, and seeds; these are operational source files and must stay in the repository.
- `scripts/` — database maintenance and migration utilities.
- `test/` — API and security regression checks.
- `bin/archive/` — preserved documentation and replaced HTML page shells; archived files are not loaded by the application.

The supported application routes are `/`, `/login`, `/register`, `/onboarding`, `/dashboard`, and `/receipt`. The former `.html` URLs redirect to their Next.js routes for existing links and installed clients.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
```

`npm run build` regenerates Tailwind output and builds the Next.js app. Apply Supabase migrations from `supabase/migrations/` using the Supabase CLI for the target environment.

## Deploy

The app is configured for Vercel. Import this repository, select the Next.js framework preset, and use the default install/build/output settings. The `pages/api/[...path].js` function serves the Express API, while Next.js serves the portal pages. Do not configure a separate static output directory.

Set the production environment variables in the Vercel project before the first deployment. Use the production Supabase values from `.env.production.example`; never commit a real `.env` file or expose `service_role_key` as a `NEXT_PUBLIC_*` variable. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full checklist and Supabase migration steps.

GitHub Actions runs lint, tests, a production build, secret scanning, and Supabase database checks on pull requests and pushes to `main` or `mvp/**`.
