# Inventory Agent — CLAUDE.md

## Scope (อ่านก่อนทำงาน)
Module นี้ครอบคลุมเฉพาะ:
- **FEFO** — First-Expired-First-Out dispense logic
- **Batch Tracking** — รับสินค้าเป็น lot, ติดตาม expiry ราย batch
- **Expiry Alerts** — แจ้งเตือน 30 / 60 / 90 วันก่อนหมดอายุ
- **Re-order Point** — rule-based manual threshold เท่านั้น

**ไม่อยู่ใน scope:** AI forecasting, demand prediction, auto-promotion, Bargain Dashboard (flag ปิดไว้)

---

## Files ที่ Agent นี้ดูแล

| File | หน้าที่ |
|---|---|
| `js/partner/inventory.js` | UI ทั้งหมด — product grid, stock alerts, movement log, supplier table |
| `api.js` (เพิ่มเติม) | ต้องเพิ่ม endpoints ใหม่สำหรับ batch และ movement |
| `css/partner-modules.css` | styles สำหรับ inventory UI |

**อย่าแก้ไข:** `js/utils/formatters.js`, `js/utils/config.js`, `js/utils/supabase-client.js`

---

## Codebase ที่มีอยู่จริง (อ่านแล้ว)

### Exports จาก `inventory.js`
```js
export function renderProducts(products)   // product grid บน page-products
export function renderInventoryExtras()    // stock alerts + movement log + supplier table
```

### Helper functions (มีอยู่แล้ว — ใช้ต่อได้)
```js
// threshold คงที่ใน inventory.js
const LOW_STOCK_THRESHOLD = 10;
const CRITICAL_STOCK_THRESHOLD = 3;

function getStockStatus(stock)
// returns { label, class, color, bg }
// stock <= 3  → { label: '🔴 วิกฤต',   color: '#EF4444', bg: '#FEE2E2' }
// stock <= 10 → { label: '🟡 ใกล้หมด', color: '#F59E0B', bg: '#FEF3C7' }
// stock > 10  → { label: '🟢 ปกติ',    color: '#10B981', bg: '#D1FAE5' }

function checkExpiry(expiryDate)
// returns { isExpired: bool, isNearExpiry: bool, daysLeft: number }
// near-expiry = daysLeft > 0 && daysLeft <= 90  ← ปัจจุบันตายตัวที่ 90 วัน
// ต้องเปลี่ยนเป็น multi-tier: 30 / 60 / 90

function profitMargin(cost, sell)
// returns percentage integer
```

### Mock data structure ปัจจุบัน (ใน `inventory.js`)
```js
// extendedProducts — product-level stock (ไม่มี batch)
{
  id: 'p1',
  icon: '💉',
  name: 'วัคซีน DHPPL 5 โรค',
  costPrice: 350,
  sellPrice: 800,
  stock: 22,           // รวมทุก batch
  unit: 'เข็ม',
  category: 'vaccine', // 'vaccine'|'medicine'|'supply'|'lab'|'food'
  expiryDate: '2027-03-01',  // แค่วันเดียว — ยังไม่มี batch
  supplier: 'Zoetis Thailand'
}

// stockMovements — movement log
{
  date: '2026-04-16',
  product: 'วัคซีน DHPPL',
  type: 'OUT',    // 'IN'|'OUT'|'ADJUST'|'EXPIRED'
  qty: -2,
  reason: 'ใช้ในการรักษา - คิว A001',
  by: 'ดร.สมศักดิ์'
}

// mockSuppliers
{
  id: 's1',
  name: 'Zoetis Thailand',
  contact: 'คุณมนัส',
  phone: '02-111-1111',
  email: 'sales@zoetis.co.th',
  items: 8,
  lastOrder: '2026-04-01'
}
```

---

## Database Schema ที่ต้องสร้าง (ยังไม่มีใน Supabase)

### `products` (มีอยู่แล้ว — แต่ขาด field)
```sql
-- มีอยู่แล้ว
id, store_id, name, is_active, created_at

-- ต้องเพิ่ม
category        TEXT,   -- 'vaccine'|'medicine'|'supply'|'lab'|'food'|'retail'
unit            TEXT,   -- 'เข็ม'|'เม็ด'|'ขวด'|'ชุด'|'แผ่น'
cost_price      INT,    -- ราคาทุน (บาท, ไม่มีทศนิยม)
sell_price      INT,    -- ราคาขาย
icon            TEXT,   -- emoji
reorder_point   INT,    -- manual threshold — สั่งซื้อเพิ่มเมื่อ stock รวมต่ำกว่านี้
reorder_qty     INT,    -- จำนวนที่แนะนำให้สั่ง
supplier_id     UUID REFERENCES suppliers(id)
```

### `inventory_batches` (ต้องสร้างใหม่)
```sql
CREATE TABLE inventory_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  lot_number      TEXT NOT NULL,          -- เลข lot จากซัพพลายเออร์
  quantity        INT NOT NULL DEFAULT 0, -- จำนวนคงเหลือใน batch นี้
  initial_qty     INT NOT NULL,           -- จำนวนที่รับเข้า (ไม่เปลี่ยน)
  expiry_date     DATE,                   -- NULL = ไม่มีวันหมดอายุ (เช่น อุปกรณ์)
  received_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  cost_price      INT,                    -- ราคาทุนต่อหน่วยของ batch นี้ (อาจต่างจาก product.cost_price)
  supplier_id     UUID REFERENCES suppliers(id),
  is_active       BOOLEAN DEFAULT TRUE,   -- FALSE เมื่อ quantity = 0 หรือ expired
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index สำหรับ FEFO query
CREATE INDEX idx_batches_fefo ON inventory_batches
  (product_id, is_active, expiry_date ASC NULLS LAST);
```

### `stock_movements` (ต้องสร้างใหม่)
```sql
CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  batch_id        UUID REFERENCES inventory_batches(id),
  movement_type   TEXT NOT NULL,  -- 'IN'|'OUT'|'ADJUST'|'EXPIRED'|'RETURN'
  quantity        INT NOT NULL,   -- บวก = เพิ่ม, ลบ = ลด
  reference_type  TEXT,           -- 'queue_entry'|'purchase_order'|'manual'|'expiry_check'
  reference_id    UUID,           -- ID ของ entity ที่เกี่ยวข้อง
  reason          TEXT,
  performed_by    TEXT,           -- staff name หรือ 'system'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### `suppliers` (ต้องสร้างใหม่)
```sql
CREATE TABLE suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id),
  name        TEXT NOT NULL,
  contact     TEXT,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

### มีอยู่แล้วใน `api.js`
```
GET /api/products?store_id=UUID
→ products WHERE is_active = true ORDER BY name ASC
→ ยังไม่มี batch info, stock level, expiry
```

### ต้องเพิ่มใน `api.js`

```js
// ดึง products พร้อม stock level รวมจากทุก batch
GET /api/inventory?store_id=UUID
→ JOIN products + SUM(batches.quantity) + earliest expiry_date

// รับสินค้าเข้า (สร้าง batch ใหม่)
POST /api/inventory/receive
body: { store_id, product_id, lot_number, quantity, expiry_date, cost_price, supplier_id }
→ INSERT inventory_batches
→ INSERT stock_movements (type: 'IN')

// จ่ายสินค้าออก (FEFO — เลือก batch อัตโนมัติ)
POST /api/inventory/dispense
body: { store_id, product_id, quantity, reference_type, reference_id, reason, performed_by }
→ FEFO logic (ดูด้านล่าง)
→ INSERT stock_movements (type: 'OUT') per batch touched

// ดึง movement log
GET /api/inventory/movements?store_id=UUID&product_id=UUID&from=DATE&to=DATE
→ stock_movements JOIN products JOIN batches ORDER BY created_at DESC

// ปรับปรุงสต็อก (physical count, ของเสีย)
POST /api/inventory/adjust
body: { store_id, batch_id, quantity_delta, reason, performed_by }
→ UPDATE batch quantity
→ INSERT stock_movements (type: 'ADJUST' หรือ 'EXPIRED')

// ดึง batch list ของสินค้า
GET /api/inventory/batches?store_id=UUID&product_id=UUID&active_only=true

// ดึงสินค้าที่ใกล้หมดอายุ (สำหรับ alert dashboard)
GET /api/inventory/expiry-alerts?store_id=UUID
→ batches WHERE expiry_date IS NOT NULL
     AND is_active = true
     AND quantity > 0
     ORDER BY expiry_date ASC

// ดึงสินค้าที่ต้องสั่งซื้อ (stock รวม <= reorder_point)
GET /api/inventory/reorder-needed?store_id=UUID
→ products WHERE SUM(active_batches.quantity) <= reorder_point
```

---

## FEFO Logic (First-Expired-First-Out)

### หลักการ
เมื่อจ่ายสินค้าออก ต้องเลือก batch ที่ `expiry_date` เร็วที่สุดก่อนเสมอ

### Algorithm ใน `POST /api/inventory/dispense`
```js
async function dispenseFEFO(supabase, { store_id, product_id, quantity, reference_type, reference_id, reason, performed_by }) {
  // 1. ดึง active batches เรียงตาม expiry_date ASC (FEFO)
  //    NULL expiry_date อยู่ท้ายสุด (ไม่มีกำหนดหมดอายุ = ใช้ทีหลัง)
  const { data: batches } = await supabase
    .from('inventory_batches')
    .select('id, quantity, expiry_date, lot_number')
    .eq('store_id', store_id)
    .eq('product_id', product_id)
    .eq('is_active', true)
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true, nullsFirst: false });

  // 2. ตรวจสอบว่า stock รวมพอ
  const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
  if (totalStock < quantity) {
    throw new Error(`Stock ไม่พอ: มี ${totalStock} ต้องการ ${quantity}`);
  }

  // 3. ตัดสต็อกทีละ batch จนครบ
  let remaining = quantity;
  const movements = [];

  for (const batch of batches) {
    if (remaining <= 0) break;

    const deduct = Math.min(batch.quantity, remaining);
    const newQty = batch.quantity - deduct;

    // อัปเดต batch
    await supabase
      .from('inventory_batches')
      .update({
        quantity: newQty,
        is_active: newQty > 0,
      })
      .eq('id', batch.id);

    // บันทึก movement
    movements.push({
      store_id, product_id,
      batch_id: batch.id,
      movement_type: 'OUT',
      quantity: -deduct,
      reference_type, reference_id,
      reason: reason || `FEFO dispense - Lot: ${batch.lot_number}`,
      performed_by: performed_by || 'system',
    });

    remaining -= deduct;
  }

  // 4. Insert movements
  await supabase.from('stock_movements').insert(movements);

  return { dispensed: quantity, movements };
}
```

### กฎเพิ่มเติม
- ถ้า batch มี `expiry_date` ที่**ผ่านไปแล้ว** → ต้องไม่จ่ายออก (filter `expiry_date > NOW()` หรือ `IS NULL`)
- ถ้า product ไม่มี batch ใดเลย → return error ไม่ใช่ silent fail
- Batch ที่ `quantity = 0` → set `is_active = false` ทันที

---

## Expiry Alert — 3 ระดับ (30 / 60 / 90 วัน)

### Logic ที่ต้องแก้ใน `checkExpiry()` ใน `inventory.js`
```js
// เดิม: แค่ isNearExpiry (90 วัน ตายตัว)
// ใหม่: 3 tier
function checkExpiry(expiryDate) {
  if (!expiryDate) return { tier: null, isExpired: false, daysLeft: Infinity };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0)  return { tier: 'expired',  isExpired: true,  daysLeft };
  if (daysLeft <= 30) return { tier: 'critical',  isExpired: false, daysLeft };
  if (daysLeft <= 60) return { tier: 'warning',   isExpired: false, daysLeft };
  if (daysLeft <= 90) return { tier: 'caution',   isExpired: false, daysLeft };
  return               { tier: null, isExpired: false, daysLeft };
}
```

### UI Badge ต่อ tier
```js
const EXPIRY_TIERS = {
  expired:  { label: 'หมดอายุแล้ว', color: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' },
  critical: { label: 'หมดอายุใน X วัน', color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' }, // ≤30
  warning:  { label: 'หมดอายุใน X วัน', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' }, // ≤60
  caution:  { label: 'หมดอายุใน X วัน', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' }, // ≤90
};
```

### Expiry Alert Page Section
แสดงใน `renderInventoryExtras()` จัดเป็น 3 กลุ่มตาม tier:
```
⏰ การแจ้งเตือนวันหมดอายุ
├── 🔴 หมดอายุแล้ว (X รายการ)
├── 🟠 หมดภายใน 30 วัน (X รายการ)
├── 🟡 หมดภายใน 31–60 วัน (X รายการ)
└── 🔵 หมดภายใน 61–90 วัน (X รายการ)
```
แต่ละรายการแสดง: ชื่อสินค้า, Lot number, จำนวนที่เหลือ, วันหมดอายุ, ปุ่ม "ตัดสต็อก"

---

## Re-order Point — Manual Rule-Based

### หลักการ
เมื่อ `SUM(active_batches.quantity)` ของ product <= `product.reorder_point` → แสดง alert ให้สั่งซื้อ

**ไม่มี AI forecasting** — user ตั้ง `reorder_point` และ `reorder_qty` เองต่อ product

### UI
```
📦 สินค้าที่ต้องสั่งซื้อ
┌─────────────────────────────────────────────────┐
│ วัคซีน DHPPL 5 โรค                              │
│ Stock: 3 เข็ม  |  Re-order point: 10 เข็ม       │
│ แนะนำสั่ง: 50 เข็ม  |  Supplier: Zoetis Thailand │
│                            [สร้าง PO]            │
└─────────────────────────────────────────────────┘
```

### Flow เมื่อกด "สร้าง PO"
1. เปิด modal: ยืนยัน supplier, จำนวน (pre-fill ด้วย `reorder_qty`)
2. บันทึก PO reference (text เท่านั้น ยังไม่มี PO module)
3. เมื่อสินค้ามาถึง → กด "รับสินค้า" → เรียก `POST /api/inventory/receive`

### การตั้ง Re-order Point
เพิ่ม field ใน product edit form:
```
จุดสั่งซื้อ (เตือนเมื่อเหลือต่ำกว่า): [__] หน่วย
จำนวนที่แนะนำสั่ง: [__] หน่วย
```
บันทึกลง `products.reorder_point` และ `products.reorder_qty`

---

## Interface กับ Module อื่น

### ← Clinic / OPD (opd-card.js)
**เมื่อ Vet สั่งยาใน Prescription:**
```js
// opd-card.js เรียก:
import { dispenseForPrescription } from './inventory.js';

await dispenseForPrescription({
  store_id,
  items: [
    { product_id: 'uuid', quantity: 2, reference_id: medical_record_id }
  ],
  performed_by: vetName,
  reference_type: 'medical_record',
});
// → POST /api/inventory/dispense (FEFO)
// → INSERT stock_movements (type: 'OUT', reference_type: 'medical_record')
```

ใน OPD prescription UI ต้องแสดง:
- Stock ที่เหลือต่อ product
- Lot ที่จะถูกตัด (FEFO — batch ที่ expiry เร็วสุด)
- Badge เตือนถ้า batch จะหมดหลังจ่าย

### ← POS / Finance (finance.js)
**เมื่อ Checkout:**
```js
// finance.js เรียก:
await dispenseForSale({
  store_id,
  items: lineItems.map(i => ({
    product_id: i.product_id,
    quantity: i.qty,
    reference_id: transaction_id,
  })),
  performed_by: staffName,
  reference_type: 'transaction',
});
```

### → Finance (ข้อมูลต้นทุน)
Finance ใช้ `cost_price` จาก batch ที่ถูกตัดใน movement log เพื่อคำนวณ gross margin จริง (ต่างจาก `products.cost_price` ที่เป็นค่า default)

### → Audit Trail (audit.js)
**ทุก** stock movement ต้องผ่าน `logAudit()`:
```js
import { logAudit } from './audit.js';

// หลังจาก dispense สำเร็จ:
logAudit('STOCK_OUT', 'inventory_batch', batchId, { quantity: oldQty }, { quantity: newQty }, reason);

// หลังรับสินค้าเข้า:
logAudit('STOCK_IN', 'inventory_batch', batchId, null, { lot_number, quantity, expiry_date }, 'receive');

// หลัง adjust:
logAudit('STOCK_ADJUST', 'inventory_batch', batchId, { quantity: oldQty }, { quantity: newQty }, reason);
```

---

## Feature Flags ที่เกี่ยวข้อง

```js
// js/utils/config.js
FEATURE_FLAGS.ENABLE_INVENTORY_ALERTS  // true  → แสดง alert section
FEATURE_FLAGS.ENABLE_BATCH_TRACKING   // true  → แสดง batch tab และ FEFO flow
FEATURE_FLAGS.ENABLE_BARGAIN_DASHBOARD // true  → ยังไม่ implement, ไม่ต้องสร้าง
```

gate ทุก batch-related UI ด้วย:
```js
if (!FEATURE_FLAGS.ENABLE_BATCH_TRACKING) {
  // แสดง stock level แบบเดิม (รวม ไม่แยก batch)
  return;
}
```

---

## Conventions

- `quantity` ใน batch และ movement เป็น integer เสมอ (ไม่มีทศนิยม)
- Movement `quantity`: บวก = เพิ่มเข้า, ลบ = ตัดออก
- ห้าม delete batch หรือ movement — ใช้ `is_active = false` หรือ ADJUST เท่านั้น
- `expiry_date = NULL` หมายถึงไม่มีวันหมดอายุ (เช่น อุปกรณ์, ถุงมือ) — ไม่ใช่ error
- stock level รวม = `SUM(batches.quantity) WHERE is_active = true`
- ตอน render alert ใช้ expiry จาก **batch ที่ใกล้สุด** ไม่ใช่ค่า default ของ product
- formatBaht และ formatThaiDate import จาก `js/utils/formatters.js` เสมอ
- showToast import จาก `js/utils/notifications.js` เสมอ
