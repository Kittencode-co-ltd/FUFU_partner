# Auth Module — Sub-Agent Context

## Purpose
Handle all authentication, session management, store selection, and access guard for the FUFU Partner Portal.

## Files Owned
| File | Role |
|---|---|
| `js/auth.js` | Main auth logic (login, logout, store selection, guards) |
| `api.js` lines 49–123 | Backend endpoints: `/api/auth`, `/api/register` |
| `css/auth.css` | Login/register page styles |
| `js/register.js` | Registration flow |

## API Endpoints (in `api.js`)

### POST /api/auth
```js
// Request
{ action: 'login', email, password }

// Response (success)
{ success: true, token, refresh_token, user, stores: [] }

// Response (fail)
{ success: false, error: 'message' }
```
**Side effect**: calls Supabase RPC `is_fufu_staff(user_id)` to verify partner access. Non-partners are rejected with 403.

### POST /api/register
```js
// Request
{ email, password, name, phone, type: 'partner'|'user', partnerType: 'vet_clinic'|... }

// Creates: auth user + row in profiles (user) OR partners (partner)
```

## Supabase Tables Used
- `profiles` — public user profiles
- `partners` — partner business profiles (name, email, phone, type)
- `stores` — stores owned by partner, queried by `owner_email`
- RPC `is_fufu_staff(user_id)` — returns bool, validates partner access right

## localStorage State Managed
```js
STORAGE_KEYS.TOKEN         // 'fufu_token'        — JWT
STORAGE_KEYS.ROLE          // 'fufu_role'          — 'vet'|'shop'|'hotel'|'grooming'|'admin'
STORAGE_KEYS.USER          // 'fufu_user'          — JSON { email, id }
STORAGE_KEYS.STORE_ID      // 'selected_store_id'  — UUID
STORAGE_KEYS.STORE_CATEGORY // 'selected_store_category' — raw category string
```

## Key Exports from `js/auth.js`
```js
isAuthenticated()          // → bool, checks token exists and not 'demo_token'
requireAuth(currentPage)   // Guard: redirects to login.html if not auth'd
getRedirectUrl()           // Reads ?redirect= param for post-login redirect
getCurrentUser()           // → { email, id } from localStorage
getCurrentRole()           // → 'vet' | 'shop' | 'hotel' | 'grooming' | 'admin'
doLogin(email, password)   // → { success, token, user, stores, error }
selectStore(storeId, category, token, userEmail)  // saves to localStorage + redirects
renderStoreSelection(stores, token, user)         // renders store picker UI after login
logout(redirectTo)         // clears localStorage + redirects
categoryToRole(category)   // 'vet_clinic' → 'vet', etc.
categoryToLabel(category)  // 'vet_clinic' → 'คลินิกสัตว์แพทย์'
```

## Current State
- ✅ Login via Supabase Auth (email + password)
- ✅ Store selection UI after login
- ✅ Auth guard (`requireAuth`) on dashboard
- ✅ Logout clears all localStorage
- ✅ Partner registration flow (`register.js`)
- ❌ Token refresh — no refresh_token rotation implemented; token expires silently
- ❌ Staff sub-auth — currently one owner per store; no staff member login under a store
- ❌ Remember me — token always stored in localStorage (not sessionStorage option)
- ❌ SSO / social login

## Staff Role System (in `js/partner/rbac.js`)
Staff roles within a store are separate from partner type:
```
owner       → full access
vet         → medical + queue
reception   → queue + POS
staff       → read-only + inventory
accountant  → finance only
```
Currently `fufu_staff_role` is stored in localStorage but not enforced at API level — only at UI level via `rbac.js`.

## Known Issues
1. `isAuthenticated()` only checks if token exists, not if it's expired — need to catch 401s from API and redirect to login
2. After `selectStore()`, `fufu_role` is set from store category (not from actual staff role in DB)
3. `is_fufu_staff` RPC must exist in Supabase DB — if missing, login always fails

## Conventions
- All API calls include `Authorization: Bearer ${token}` header
- On any 401 response from `/api/*`, should redirect to login (not yet implemented globally)
- Never store raw password anywhere
- Audit: sensitive auth events (failed login attempts) should eventually be logged to `audit_logs`
