# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the combined Express + Next.js dev server (port 3000)
npm run dev

# Build the Next.js landing page for production
npm run build

# Lint and typecheck
npm run lint
npm run typecheck

# Watch Tailwind during legacy portal UI development (separate terminal)
npm run watch:css

# Build minified CSS for production
npm run build:css
```

Automated API tests use Node's test runner. Manual API testing uses `curl` against `http://localhost:3000`. See `agents/test/CLAUDE.md` for test coverage and environment setup; do not copy credentials into docs.

## Architecture

**Stack:** Node.js 20+ / Express 4 (ES modules) · Next.js 16 + React 19 for the public landing page · Supabase (Postgres + Auth) · Vanilla JS (ES modules) for the existing partner portal · Tailwind CSS 3 · PWA

### Request flow

```
Browser → / → Express → Next.js App Router (app/page.jsx)
Browser → /login.html or /dashboard.html → public/*.html → public/js/partner/*.js
                                                      ↓
                                   apiFetch('/api/...') via public/js/utils/api-client.js
                                                      ↓
                                    server/index.js → server/routes/*.js
                                                      ↓
                                    req.supabase (user-scoped, RLS enforced)
```

- `server/middleware/auth.js` — `requireAuth` middleware verifies the Bearer JWT, attaches `req.user` and a **user-scoped** Supabase client (`req.supabase`) so Row Level Security is applied automatically.
- `apiFetch` in `public/js/utils/api-client.js` — authenticated fetch wrapper; auto-attaches Bearer token from `localStorage` and redirects to `/login.html` on 401.
- `/` is rendered by Next.js; `/_next/*` is routed to Next.js after static assets. `/index.html` redirects to `/`. Existing `/login.html`, `/register.html`, and `/dashboard.html` pages are served from `public/`. Unknown non-API routes fall back to `public/login.html`.

### Frontend module system

The public home page is the Next.js App Router page at `app/page.jsx`. `server/index.js` runs Next.js and Express together. The existing partner portal remains the HTML/ES module shell at `public/dashboard.html`, driven by `public/js/partner/dashboard.js`, which handles sidebar navigation, page switching, and RBAC gating. `public/js/app.js` lazy-imports the relevant legacy portal module.

Every partner module (`queue.js`, `opd-card.js`, `finance.js`, etc.) is a single ES module that exports one primary `render*()` function. Modules communicate via `CustomEvent` dispatched on `document`:

```js
// queue.js fires → dashboard.js listens → calls renderOPDCard()
document.dispatchEvent(new CustomEvent('fufu:openOPD', { detail: queueItem }));
```

### Auth / session state (localStorage)

All keys are defined in `public/js/utils/config.js → STORAGE_KEYS`. Use `storage.saveSession()` / `storage.clearSession()` from `public/js/utils/storage.js` rather than writing localStorage directly.

| Key constant | localStorage key | Value |
|---|---|---|
| `TOKEN` | `fufu_token` | Supabase JWT |
| `REFRESH_TOKEN` | `fufu_refresh_token` | Supabase refresh token |
| `USER` | `fufu_user` | JSON `{ email, id }` |
| `STORE_ID` | `fufu_store_id` | UUID of active store |
| `STORE_NAME` | `fufu_store_name` | Display name of active store |
| `STORE_CATEGORY` | `fufu_store_category` | `vet_clinic` \| `pet_shop` \| `pet_hotel` \| `pet_grooming` |
| `ROLE` | `fufu_role` | `vet` \| `shop` \| `hotel` \| `grooming` \| `admin` |
| `STAFF_ID` | `fufu_staff_id` | Staff member UUID (for audit logs) |
| `STAFF_ROLE` | `fufu_staff_role` | `owner` \| `vet` \| `reception` \| `staff` \| `accountant` |
| `MASKING_LEVEL` | `fufu_masking_level` | `1` (full) \| `2` (partial) \| `3` (hidden) |
| `FONT_SCALE` | `fufu_font_scale` | UI font size preference |
| `PROMPTPAY_ID` | `fufu_promptpay_id` | PromptPay ID for payment QR |

`fufu_mode` (mode switcher state, not in `STORAGE_KEYS`) is managed by `dashboard.js` directly.

### RBAC

Two independent access layers:
- **Partner type** (`STORE_CATEGORY`) — determines which nav items and modules are visible.
- **Staff role** (`STAFF_ROLE`) — determines field-level permissions within a store. Logic lives in `public/js/partner/rbac.js`.

### Staff mode

`dashboard.js` also has a **mode switcher** (independent from `STAFF_ROLE`) that restricts which pages a logged-in session can access. Modes are defined in the `MODES` constant in `dashboard.js`:

| Mode | Pages visible |
|---|---|
| `all` | everything |
| `counter` | home, queue, pets, pos, income |
| `doctor` | home, queue, opd, medical, pets, inventory |
| `pharmacy` | home, inventory |
| `finance` | home, income |

The active mode is stored in `localStorage` under key `fufu_mode` and survives page reloads.

### Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `PORT` | Express port (default `3000`) |
| `Project_URL` | Supabase project URL |
| `publishable_key` | Supabase anon key |
| `service_role_key` | Supabase service-role key — bypasses RLS; used by `appointments.js` (cross-store reads) and auth change-password |

Note: the env var is lowercase `service_role_key` — match exactly or routes will fail silently.

## Key patterns

### Making API calls (frontend)

```js
import { apiFetch } from '../utils/api-client.js';
const data = await apiFetch('/api/queue?store_id=' + storeId);
```

Never call Supabase directly from frontend modules — always go through the Express API layer.

### Adding a new API route

1. Create `server/routes/<feature>.js` exporting a Router.
2. Mount it in `server/index.js`: `app.use('/api/<feature>', featureRoutes)`.
3. Apply `requireAuth` middleware on protected endpoints: `import { requireAuth } from '../middleware/auth.js'`.
4. Use `req.supabase` (not a fresh client) so RLS is respected.

### Audit logging (required for all sensitive mutations)

```js
import { logAudit } from './audit.js';
logAudit('UPDATE', 'medical_record', recordId, oldData, newData, 'reason');
```

`audit_logs` is **INSERT-only** — never UPDATE or DELETE rows in this table.

### Data masking

```js
import { maskPhone, maskName } from './data-masking.js';
maskPhone('0812345678', level); // 1=full, 2=partial, 3=hidden
```

### Feature flags

Defined in `public/js/utils/config.js → FEATURE_FLAGS`. Toggle experimental features without a deploy. Check the flag before rendering a module.

## Business rules (do not change)

1. **Commission** — FUFU charges 5% on all transactions (`COMMISSION_RATE = 0.05`).
2. **FEFO** — Inventory always dispenses the earliest-expiry batch first.
3. **Queue numbering** — Format `A001`, `A002`, resets daily per store.
4. **Multi-store** — One user can own multiple stores; active store context is `selected_store_id`.
5. **Audit immutability** — `audit_logs` rows can never be updated or deleted.
6. **Body map removed** — Not implemented in OPD card (decision 2026-04-26).

## Sub-agent context files

Each `agents/<module>/CLAUDE.md` contains module-specific DB schemas, API contracts, UI conventions, and inter-module event interfaces. Read the relevant agent file before working on a module:

| Agent | Primary files |
|---|---|
| `agents/auth/` | `public/js/auth.js`, `server/routes/auth.js` |
| `agents/queue/` | `public/js/partner/queue.js`, `server/routes/queue.js` |
| `agents/clinic/` | `public/js/partner/opd-card.js`, `medical.js`, `ipd.js`, `server/routes/medical.js`, `ipd.js` |
| `agents/inventory/` | `public/js/partner/inventory.js`, `server/routes/inventory.js` |
| `agents/pos/` | `public/js/partner/pos.js`, `invoice.js`, `server/routes/pos.js` |
| `agents/finance/` | `public/js/partner/finance.js`, `server/routes/finance.js` |
| `agents/grooming/` | `public/js/partner/grooming.js`, `server/routes/grooming.js` |
| `agents/hotel/` | `public/js/partner/hotel.js`, `server/routes/hotel.js` |
| `agents/document/` | `public/js/partner/documents.js`, `server/routes/documents.js` |
| `agents/pm/` | Project status, phase plan, module dependency map |
| `agents/test/` | API test suite, UI checklists, test credentials |

Additional routes mounted in `server/index.js` with **no dedicated agent file**:

| Route prefix | File | Purpose |
|---|---|---|
| `/api/appointments` | `server/routes/appointments.js` | Reads booking inbox from mobile-app customers; uses service-role client for cross-store queries |
| `/api/staff` | `server/routes/staff.js` | Staff management within a store |
| `/api/stores` | `server/routes/stores.js` | Store CRUD and multi-store context switching |
| `/api/tasks` | `server/routes/tasks.js` | Kanban task board (`public/js/partner/kanban.js`) |
| `/api/pets` | `server/routes/pets.js` | Pet profiles (`public/js/partner/pets.js`) |

> **Note:** `agents/CLAUDE.md` (the root overview file) documents the old monolith structure (`api.js`, `js/` paths). Ignore its file-tree section — the current layout is `server/` + `public/js/`.

## Completion status (as of 2026-04-26)

Many modules render from **mock data** — real DB/API wiring is still in progress (~38% overall). Modules most in need of real data: Hotel, Grooming, Inventory, POS, Documents. See `agents/pm/CLAUDE.md` for the full phase plan and task board.
