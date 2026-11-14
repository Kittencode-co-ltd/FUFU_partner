# FUFU Partner contributor notes

## Architecture

- Frontend routes and layouts live in `app/` and use the Next.js App Router.
- The Express app in `server/` provides authenticated `/api/*` endpoints and serves Next.js in local development.
- Supabase database migrations, edge functions, seeds, and CLI configuration live in `supabase/`; they are required project source, not archive material.
- Partner feature modules in `public/js/partner/` are loaded by the Next.js dashboard shell while they are incrementally moved to React components.
- Static assets and generated CSS live in `public/`.
- Historical documentation and replaced page shells are kept under `bin/archive/` and are not part of runtime.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
```

Keep service-role keys on the server. Protected API routes should use `requireAuth` and user-scoped Supabase access unless a narrowly scoped server-side operation explicitly requires an admin client. Never place secrets in browser code, docs, or committed environment templates.
