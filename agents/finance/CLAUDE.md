# Finance Module — Sub-Agent Context

## Purpose
Income overview, transaction history, revenue analytics, and commission reporting. Shows partners how much they've earned, FUFU's cut, and trends over time. Separate from POS (which handles the checkout moment) — Finance is the reporting layer.

## Files Owned
| File | Role |
|---|---|
| `js/partner/finance.js` | Income page rendering + POS UI (dual role) |

## API Endpoints

### Existing in `api.js`
- `POST /api/transactions` — record a new transaction (with 5% commission auto-calc)

### Missing (need to add to `api.js`)
```
GET /api/transactions?store_id=UUID&from=YYYY-MM-DD&to=YYYY-MM-DD&status=paid
GET /api/transactions/summary?store_id=UUID&period=day|week|month
GET /api/transactions/export?store_id=UUID&from=YYYY-MM-DD&to=YYYY-MM-DD  ← CSV/Excel
```

## Supabase Table: `transactions` (exists)
```
id, user_id, store_id,
amount,         -- gross amount (THB)
commission,     -- 5% of amount (auto-calculated)
net_amount,     -- amount - commission
type,           -- transaction category string
created_at
```
Gap: no `payment_method`, no `status`, no line items, no `date` field separate from `created_at`.

## Income Stats (displayed on income page)
```
inc-today      ← sum of transactions WHERE date = today
inc-week       ← sum WHERE date >= 7 days ago
inc-month      ← sum WHERE date >= start of month
inc-commission ← sum of commission column for same period
```

## Current State
- ✅ Income stats UI (4 stat cards: today/week/month/commission)
- ✅ Transaction history table with payment method icons
- ✅ Weekly revenue bar chart (custom CSS bars, no library)
- ✅ POS quick-checkout modal UI (limited)
- ✅ Mock transaction data for all partner types
- ❌ **No GET /api/transactions endpoint** — all income stats show mock data
- ❌ No date range filter on transaction history
- ❌ No export to CSV/Excel (flag `ENABLE_FINANCE_EXPORT = true` but no implementation)
- ❌ No monthly income trend chart
- ❌ No breakdown by service type
- ❌ No profit margin calculation (cost vs revenue)

## Transaction Types (for `type` field)
```
consultation    ← vet OPD visit
vaccination     ← vaccine service
surgery         ← surgical procedure
lab             ← lab work
grooming        ← grooming service
hotel_stay      ← hotel per night
retail          ← product sale
other
```

## Weekly Chart
The income page shows a 7-bar chart (Mon–Sun) using custom CSS bars.
Chart is currently hardcoded mock data. Needs to fetch real daily aggregates.

```js
// Chart bar height = percentage of max day's revenue
// Bar color = var(--primary) default, var(--accent) for weekend
```

## Commission Reporting
- FUFU charges 5% on all transactions (`COMMISSION_RATE = 0.05`)
- `inc-commission` card shows how much was paid to FUFU this month
- Partners need this for accounting reconciliation

## Export Feature
Flag: `FEATURE_FLAGS.ENABLE_FINANCE_EXPORT = true`
Export button should generate CSV with columns:
```
Date, Invoice#, Pet, Owner, Service, Amount, Payment Method, Commission, Net Amount, Status
```
Browser-side CSV generation using `Blob` + `URL.createObjectURL` is fine (no server needed).

## Key Exports
```js
export async function renderFinancePage(role)  // Called by dashboard.js for 'income' page
```

## Cross-Module Dependencies
- **POS**: creates transaction records that appear in finance history
- **Queue**: completed queue items drive the volume metric
- **Inventory**: cost price data enables profit margin view
- **Admin**: admin role sees aggregated finance across all partners (different endpoint needed)

## Admin Overview vs Partner Finance
- Partner sees: only their own store's transactions
- Admin (`role === 'admin'`) sees: all partners aggregated on `page-overview`
- Admin needs a separate `/api/admin/revenue` endpoint (not yet implemented)

## Conventions
- All amounts in Thai Baht (฿), integers only
- Format currency with `formatBaht()` from `js/utils/formatters.js`
- Gate export feature with `FEATURE_FLAGS.ENABLE_FINANCE_EXPORT`
- Commission always 5% — never calculate on frontend alone; verify against server response
- Refunded transactions: count as negative amount in period sum
