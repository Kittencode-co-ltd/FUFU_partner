# POS Module — Sub-Agent Context

## Purpose
Point of Sale: create invoices from a queue/consultation, select products/services, choose payment method, generate receipt, and record the transaction. Used at checkout after OPD, grooming, hotel checkout, or direct retail sale.

## Files Owned
| File | Role |
|---|---|
| `js/partner/finance.js` | Income page + POS UI (combined module) |
| `js/partner/invoice.js` | Invoice/receipt HTML template + print logic |

## API Endpoints

### POST /api/transactions (exists in `api.js`)
```js
// Request
{ user_id, store_id, amount, type }

// Auto-calculates: commission = amount * 0.05, net_amount = amount - commission
// Inserts into `transactions` table
// Response: { success: true, data: { id, amount, commission, net_amount, ... } }
```

### Missing endpoints (need to add to `api.js`)
```
GET  /api/transactions?store_id=UUID&date=YYYY-MM-DD  ← transaction history
POST /api/invoice                                       ← save invoice with line items
GET  /api/invoice/:id                                   ← fetch invoice for reprint
```

## Supabase Tables

### `transactions` (exists)
```
id, user_id, store_id, amount, commission, net_amount, type, created_at
```
Note: `type` field stores the transaction category string (e.g. 'consultation', 'grooming', 'retail').

### `invoices` (planned — does NOT exist yet)
```
id, store_id, queue_entry_id, medical_record_id,
invoice_number,    -- auto-generated: INV-YYYYMMDD-XXXX
line_items,        -- JSONB array: [{ name, qty, unit_price, total }]
subtotal, discount, tax, total,
payment_method,    -- 'cash' | 'promptpay' | 'card' | 'transfer' | 'voucher'
payment_reference, -- QR ref, card last4, etc.
status,            -- 'draft' | 'paid' | 'deposit' | 'refunded' | 'cancelled'
created_by, created_at
```

## Payment Methods
```js
cash      → เงินสด       (icon: fa-money-bill-wave, color: #10B981)
promptpay → พร้อมเพย์    (icon: fa-qrcode, color: #3B82F6) — ENABLE_PROMPTPAY flag
card      → บัตรเครดิต   (icon: fa-credit-card, color: #8B5CF6)
transfer  → โอนเงิน      (icon: fa-building-columns, color: #F59E0B)
voucher   → บัตรกำนัล    (icon: fa-ticket, color: #EC4899)
```

## Current State
- ✅ Transaction mock data rendered in income page
- ✅ Payment method constants and display
- ✅ Invoice HTML template in `invoice.js` with print layout
- ✅ Commission auto-calculation (5%) in `POST /api/transactions`
- ✅ PromptPay flag exists (`ENABLE_PROMPTPAY = false`)
- ❌ **No real POS UI** — no product selection, no checkout flow
- ❌ No GET transactions endpoint to populate history from real DB
- ❌ PromptPay QR generation not implemented
- ❌ No invoice line-items table in DB
- ❌ Thermal printer integration (placeholder only)
- ❌ Deposit / partial payment workflow
- ❌ Refund workflow

## Invoice Template (`invoice.js`)
```js
export function printInvoice(invoiceData)   // Opens print window with formatted receipt
export function getSampleInvoiceData()      // Returns mock invoice for testing print
```

Invoice data structure:
```js
{
  invoiceNumber: 'INV-20260416-001',
  date: '2026-04-16',
  storeName: 'Happy Paws Clinic',
  storePhone: '02-xxx-xxxx',
  petName: 'บัดดี้',
  ownerName: 'คุณสมชาย',
  lineItems: [
    { name: 'ตรวจทั่วไป', qty: 1, unitPrice: 500, total: 500 },
    { name: 'วัคซีน DHPPL', qty: 1, unitPrice: 800, total: 800 },
  ],
  subtotal: 1300,
  discount: 0,
  total: 1300,
  paymentMethod: 'cash',
  commissionAmount: 65,   // 5% to FUFU
  netAmount: 1235,
}
```

## POS Flow (needs implementation)
1. User opens POS (from queue card "💳 ชำระเงิน" button or from Finance page)
2. System pre-fills items from OPD prescription / services rendered
3. User can add/remove line items, apply discount
4. User selects payment method
5. If PromptPay: generate QR code (PromptPay API or promptpay-qr library)
6. Confirm payment → `POST /api/transactions` + `POST /api/invoice`
7. Generate receipt → `printInvoice(invoiceData)` for thermal/A4 print
8. Mark queue item as `completed` if from queue

## Commission Rule
FUFU takes 5% of every transaction:
```js
const COMMISSION_RATE = 0.05;  // from config.js
const commission = Math.round(amount * COMMISSION_RATE * 100) / 100;
const net_amount = amount - commission;
```
This is auto-calculated in `POST /api/transactions` on the backend. Never calculate on frontend only.

## Cross-Module Dependencies
- **Queue**: POS opens from a queue card (receives `queueItem` context)
- **OPD**: pre-fills items from prescription and services in OPD record
- **Inventory**: selected products reduce stock via inventory dispense
- **Finance**: completed transactions appear in finance/income stats
- **Document**: `POST /api/transactions` should optionally trigger receipt document creation
- **Audit**: all transactions must be logged — `logAudit('PAYMENT', 'transaction', id, ...)`

## Conventions
- Feature flag: `FEATURE_FLAGS.ENABLE_POS` must be true to show POS UI
- PromptPay: gate all QR-related UI behind `FEATURE_FLAGS.ENABLE_PROMPTPAY`
- Invoice numbers: `INV-YYYYMMDD-XXXX` format (4-digit sequence per day)
- Never delete transaction records — use `status: 'refunded'` or `status: 'cancelled'`
- All amounts in Thai Baht (฿), stored as integers (satang not used)
