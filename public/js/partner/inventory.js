import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { icon } from '../utils/icons.js';

const CATEGORIES = {
  medicine:  { label: 'ยา',        icon: 'pills',        emoji: '' },
  vaccine:   { label: 'วัคซีน',    icon: 'syringe',      emoji: '' },
  food:      { label: 'อาหาร',     icon: 'bone',         emoji: '' },
  accessory: { label: 'อุปกรณ์',   icon: 'stethoscope',  emoji: '' },
  service:   { label: 'บริการ',    icon: 'hospital',     emoji: '' },
  grooming:  { label: 'Grooming',  icon: 'cut',          emoji: '' },
};

const ADJUST_REASONS = [
  'นับสต็อกจริง (พบน้อยกว่าระบบ)',
  'นับสต็อกจริง (พบมากกว่าระบบ)',
  'สินค้าเสียหาย / แตกหัก',
  'ใช้ภายในคลินิก (ไม่ได้ขาย)',
  'ตรวจสอบสต็อกประจำเดือน',
  'อื่นๆ',
];

let _storeId   = '';
let _products  = [];
let _suppliers = [];
let _tab       = 'products';

// ─── Entry ────────────────────────────────────────────────────────────────────

export async function renderInventory(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  container.innerHTML = _shellHTML();
  _bindTabEvents(container);
  // Pre-load suppliers for receive modal dropdown
  apiFetch(`/api/inventory/suppliers?store_id=${_storeId}`)
    .then(r => { _suppliers = r?.data || []; });
  await _switchTab('products', container);
}

function _shellHTML() {
  return `
    <div class="space-y-4 w-full">
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        ${[
          { id: 'products',  label: 'สินค้า' },
          { id: 'alerts',    label: 'แจ้งเตือน' },
          { id: 'movements', label: 'ความเคลื่อนไหว' },
          { id: 'suppliers', label: 'ซัพพลายเออร์' },
        ].map(t => `
          <button data-tab="${t.id}"
            class="tab-btn px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                   ${t.id === 'products' ? 'bg-white text-navy shadow-card' : 'text-slate-500 hover:text-navy'}">
            ${t.label}
          </button>`).join('')}
      </div>
      <div id="inv-content"></div>
    </div>`;
}

function _bindTabEvents(container) {
  container.querySelector('.flex').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    container.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('bg-white',       b === btn);
      b.classList.toggle('text-navy',      b === btn);
      b.classList.toggle('shadow-card',    b === btn);
      b.classList.toggle('text-slate-500', b !== btn);
    });
    await _switchTab(btn.dataset.tab, container);
  });
}

async function _switchTab(tab, container) {
  _tab = tab;
  const el = container.querySelector('#inv-content');
  if (tab === 'products')  await _renderProducts(el);
  if (tab === 'alerts')    await _renderAlerts(el);
  if (tab === 'movements') await _renderMovements(el);
  if (tab === 'suppliers') await _renderSuppliers(el);
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

async function _renderProducts(el) {
  el.innerHTML = `<div class="text-center py-12 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`;
  const res = await apiFetch(`/api/inventory?store_id=${_storeId}`);
  _products = res?.data || [];

  if (_products.length === 0) {
    el.innerHTML = `
      <div class="card p-10 text-center space-y-4">
        <div class="text-4xl"><svg class="w-10 h-10 text-slate-300 mx-auto flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg></div>
        <div class="font-semibold text-navy">ยังไม่มีสินค้า</div>
        <button id="add-product-btn" class="btn-primary">+ เพิ่มสินค้าแรก</button>
      </div>`;
    el.querySelector('#add-product-btn')?.addEventListener('click', () => _openProductModal(el));
    return;
  }

  el.innerHTML = `
    <div class="flex flex-wrap gap-3 items-center mb-4">
      <input id="product-search" class="input-field flex-1 min-w-48 max-w-xs text-sm"
        placeholder="ค้นหาชื่อสินค้า...">
      <select id="category-filter" class="input-field text-sm w-40">
        <option value="">ทุกหมวด</option>
        ${Object.entries(CATEGORIES).map(([k, v]) =>
          `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
      </select>
      <span class="text-sm text-slate-400 font-body ml-auto">${_products.length} รายการ</span>
      <button id="add-product-btn" class="btn-primary text-sm px-4 py-2">+ เพิ่มสินค้า</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" id="product-grid">
      ${_products.map(_productCard).join('')}
    </div>`;

  // Search + filter
  const search = el.querySelector('#product-search');
  const catFilter = el.querySelector('#category-filter');
  const filterCards = () => {
    const q   = search.value.toLowerCase();
    const cat = catFilter.value;
    el.querySelectorAll('[data-product-id]').forEach(card => {
      const pid  = card.dataset.productId;
      const prod = _products.find(p => p.id === pid);
      const match = (!q || prod.name.toLowerCase().includes(q))
                 && (!cat || prod.category === cat);
      card.style.display = match ? '' : 'none';
    });
  };
  search.addEventListener('input', filterCards);
  catFilter.addEventListener('change', filterCards);

  el.querySelector('#add-product-btn')?.addEventListener('click', () => _openProductModal(el));

  el.querySelector('#product-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const pid     = btn.closest('[data-product-id]')?.dataset.productId;
    const product = _products.find(p => p.id === pid);
    if (!product) return;
    if (btn.dataset.action === 'receive') _openReceiveModal(product, el);
    if (btn.dataset.action === 'edit')    _openProductModal(el, product);
    if (btn.dataset.action === 'batches') _openBatchModal(product);
    if (btn.dataset.action === 'adjust')  _openAdjustModal(product, el);
  });
}

function _productCard(p) {
  const stock  = p.stock || 0;
  const { badge, label } = _stockBadge(stock, p.reorder_point);
  const exp    = _expiryBadge(p.nearest_expiry);
  const cat    = CATEGORIES[p.category] || CATEGORIES.medicine;
  const margin = p.cost_price && p.sell_price
    ? Math.round(((p.sell_price - p.cost_price) / p.sell_price) * 100) : null;

  return `
    <div class="card p-4 hover:shadow-card-hover transition-shadow" data-product-id="${p.id}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-lg bg-primary-subtle flex items-center justify-center flex-shrink-0 text-primary">
            ${icon(cat.icon,'w-4 h-4')}
          </div>
          <div>
            <div class="font-semibold text-navy text-sm leading-tight">${p.name}</div>
            <div class="text-xs text-slate-400 font-body">${cat.label}</div>
          </div>
        </div>
        <span class="badge ${badge} text-xs">${label}</span>
      </div>

      <div class="flex items-end justify-between mb-3">
        <div>
          <div class="text-2xl font-bold ${stock <= (p.reorder_point || 0) ? 'text-red-500' : 'text-navy'}">${stock}</div>
          <div class="text-xs text-slate-400 font-body">${p.unit || 'ชิ้น'}</div>
        </div>
        <div class="text-right">
          ${p.sell_price ? `<div class="text-sm font-semibold text-primary">฿${p.sell_price.toLocaleString()}</div>` : ''}
          ${margin !== null ? `<div class="text-xs text-slate-400 font-body">margin ${margin}%</div>` : ''}
        </div>
      </div>

      ${exp ? `<div class="mb-3">${exp}</div>` : ''}

      <div class="grid grid-cols-2 gap-1.5">
        <button data-action="receive"
          class="col-span-2 text-xs border border-primary text-primary px-2 py-1.5 rounded-lg hover:bg-primary-subtle transition-colors font-semibold">
          + รับสินค้าเข้า
        </button>
        <button data-action="batches"
          class="text-xs border border-slate-200 text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          title="ดู Lot / Batch">
         ดู Batch
        </button>
        <button data-action="adjust"
          class="text-xs border border-slate-200 text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          title="ปรับยอดสต็อก">
         ปรับยอด
        </button>
        <button data-action="edit"
          class="col-span-2 text-xs border border-slate-200 text-slate-400 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
          แก้ไขข้อมูลสินค้า
        </button>
      </div>
    </div>`;
}

function _stockBadge(stock, rp) {
  const r = rp || 0;
  if (stock === 0)  return { badge: 'bg-red-100 text-red-700',    label: 'หมด' };
  if (stock <= 3)   return { badge: 'bg-red-100 text-red-600',    label: 'วิกฤต' };
  if (stock <= r)   return { badge: 'bg-amber-100 text-amber-700', label: 'ใกล้หมด' };
  return                   { badge: 'badge-teal',                  label: 'ปกติ' };
}

function _expiryBadge(d) {
  if (!d) return null;
  const days = Math.ceil((new Date(d) - new Date()) / 86400000);
  if (days <= 0)  return `<span class="badge bg-red-100 text-red-700 text-xs">หมดอายุแล้ว</span>`;
  if (days <= 30) return `<span class="badge bg-red-50 text-red-600 text-xs">หมดใน ${days} วัน</span>`;
  if (days <= 60) return `<span class="badge bg-orange-50 text-orange-600 text-xs">หมดใน ${days} วัน</span>`;
  if (days <= 90) return `<span class="badge bg-blue-50 text-blue-600 text-xs">หมดใน ${days} วัน</span>`;
  return null;
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

async function _renderAlerts(el) {
  el.innerHTML = `<div class="text-center py-12 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`;

  const [expiryRes, reorderRes] = await Promise.all([
    apiFetch(`/api/inventory/expiry-alerts?store_id=${_storeId}`),
    apiFetch(`/api/inventory/reorder-needed?store_id=${_storeId}`),
  ]);

  const expiry  = expiryRes?.data  || [];
  const reorder = reorderRes?.data || [];

  if (expiry.length === 0 && reorder.length === 0) {
    el.innerHTML = `<div class="card p-10 text-center text-slate-400 font-body">ไม่มีการแจ้งเตือน</div>`;
    return;
  }

  const grouped = { expired: [], critical: [], warning: [], caution: [] };
  expiry.forEach(b => {
    const days = Math.ceil((new Date(b.expiry_date) - new Date()) / 86400000);
    if (days <= 0)        grouped.expired.push({ ...b, days });
    else if (days <= 30)  grouped.critical.push({ ...b, days });
    else if (days <= 60)  grouped.warning.push({ ...b, days });
    else                  grouped.caution.push({ ...b, days });
  });

  el.innerHTML = `<div class="space-y-5">
    ${_alertSection('หมดอายุแล้ว',       grouped.expired,  'bg-red-50 border-red-200 text-red-700',       true)}
    ${_alertSection('หมดใน 30 วัน',       grouped.critical, 'bg-orange-50 border-orange-200 text-orange-700', false)}
    ${_alertSection('หมดใน 31–60 วัน',    grouped.warning,  'bg-amber-50 border-amber-200 text-amber-700',  false)}
    ${_alertSection('หมดใน 61–90 วัน',    grouped.caution,  'bg-blue-50 border-blue-200 text-blue-600',    false)}
    ${reorder.length > 0 ? _reorderSection(reorder) : ''}
  </div>`;

  // Expire batch buttons
  el.querySelectorAll('[data-expire-batch]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const batchId = btn.dataset.expireBatch;
      const lotNum  = btn.dataset.lotNum;
      if (!confirm(`ยืนยันตัดสต็อก Lot: ${lotNum} ออกจากระบบ?`)) return;
      btn.disabled = true; btn.textContent = 'กำลังตัด...';
      const res = await apiFetch('/api/inventory/expire-batch', {
        method: 'POST',
        body: JSON.stringify({ store_id: _storeId, batch_id: batchId }),
      });
      if (res?.success) {
        showToast(`ตัดสต็อก Lot ${lotNum} แล้ว (${res.expired_qty} ชิ้น)`);
        await _renderAlerts(el);
      } else {
        showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
        btn.disabled = false; btn.textContent = 'ตัดสต็อก';
      }
    });
  });
}

function _alertSection(title, items, cls, showExpireBtn) {
  if (!items.length) return '';
  return `
    <div>
      <h3 class="font-semibold text-navy mb-2">${title} (${items.length})</h3>
      <div class="space-y-2">
        ${items.map(b => `
          <div class="border ${cls} rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0">
              <span class="font-semibold text-sm">${b.products?.name || '—'}</span>
              <span class="text-xs ml-2 font-body opacity-70">Lot: ${b.lot_number}</span>
              <div class="text-xs font-body mt-0.5 opacity-80">
                เหลือ <b>${b.quantity}</b> ${b.products?.unit || 'ชิ้น'}
                · ${b.days <= 0 ? 'หมดอายุแล้ว' : `หมดใน ${b.days} วัน`}
              </div>
            </div>
            ${showExpireBtn ? `
              <button data-expire-batch="${b.id}" data-lot-num="${b.lot_number}"
                class="flex-shrink-0 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg
                       hover:bg-red-700 transition-colors font-semibold whitespace-nowrap">
                ตัดสต็อก
              </button>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

function _reorderSection(items) {
  return `
    <div>
      <h3 class="font-semibold text-navy mb-2">ต้องสั่งซื้อ (${items.length})</h3>
      <div class="space-y-2">
        ${items.map(p => `
          <div class="card px-4 py-3 flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0">
              <span class="font-semibold text-sm text-navy">${p.icon || ''} ${p.name}</span>
              <div class="text-xs text-slate-400 font-body mt-0.5">
                คงเหลือ <b class="text-red-500">${p.current_stock}</b>
                · จุดสั่ง ${p.reorder_point} · แนะนำสั่ง ${p.reorder_qty || '?'} ${p.unit || 'ชิ้น'}
              </div>
            </div>
            <span class="badge badge-gold text-xs flex-shrink-0">สั่งซื้อ ${p.reorder_qty || '?'} ${p.unit || 'ชิ้น'}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── Movements Tab ────────────────────────────────────────────────────────────

async function _renderMovements(el, params = {}) {
  el.innerHTML = `
    <!-- Filter bar -->
    <div class="card p-4 mb-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div>
          <label class="input-label text-xs">จากวันที่</label>
          <input id="mv-from" type="date" class="input-field text-sm"
            value="${params.from || _defaultDate(-30)}">
        </div>
        <div>
          <label class="input-label text-xs">ถึงวันที่</label>
          <input id="mv-to" type="date" class="input-field text-sm"
            value="${params.to || _defaultDate(0)}">
        </div>
        <div>
          <label class="input-label text-xs">สินค้า</label>
          <select id="mv-product" class="input-field text-sm w-48">
            <option value="">ทุกสินค้า</option>
            ${_products.map(p => `<option value="${p.id}" ${params.product_id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="input-label text-xs">ประเภท</label>
          <select id="mv-type" class="input-field text-sm w-36">
            <option value="">ทุกประเภท</option>
            <option value="IN" ${params.type === 'IN' ? 'selected' : ''}>รับเข้า</option>
            <option value="OUT" ${params.type === 'OUT' ? 'selected' : ''}>จ่ายออก</option>
            <option value="ADJUST" ${params.type === 'ADJUST' ? 'selected' : ''}>ปรับยอด</option>
            <option value="EXPIRED" ${params.type === 'EXPIRED' ? 'selected' : ''}>หมดอายุ</option>
          </select>
        </div>
        <button id="mv-search" class="btn-primary text-sm px-4 py-2">ค้นหา</button>
      </div>
    </div>
    <div id="mv-table" class="text-center py-12 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`;

  const doSearch = async () => {
    const from      = el.querySelector('#mv-from').value;
    const to        = el.querySelector('#mv-to').value;
    const productId = el.querySelector('#mv-product').value;
    const mvType    = el.querySelector('#mv-type').value;

    let url = `/api/inventory/movements?store_id=${_storeId}&limit=200`;
    if (from) url += `&from=${from}`;
    if (to)   url += `&to=${to}`;
    if (productId) url += `&product_id=${productId}`;

    const tableEl = el.querySelector('#mv-table');
    tableEl.innerHTML = `<div class="text-center py-8 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`;

    const res = await apiFetch(url);
    let movements = res?.data || [];
    if (mvType) movements = movements.filter(m => m.movement_type === mvType);

    if (movements.length === 0) {
      tableEl.innerHTML = `<div class="card p-10 text-center text-slate-400 font-body">ไม่พบรายการ</div>`;
      return;
    }

    const TYPE_CFG = {
      IN:      { label: 'รับเข้า',  cls: 'badge-teal' },
      OUT:     { label: 'จ่ายออก', cls: 'bg-red-50 text-red-600' },
      ADJUST:  { label: 'ปรับ',     cls: 'bg-amber-50 text-amber-700' },
      EXPIRED: { label: 'หมดอายุ', cls: 'bg-slate-100 text-slate-500' },
      RETURN:  { label: 'คืนสินค้า', cls: 'bg-purple-50 text-purple-600' },
    };

    tableEl.innerHTML = `
      <div class="card overflow-x-auto">
        <div class="px-4 py-2 border-b border-slate-100 text-xs text-slate-400 font-body">
          พบ ${movements.length} รายการ
        </div>
        <table class="w-full text-sm min-w-[500px]">
          <thead class="border-b border-slate-100">
            <tr>
              <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400">วันที่</th>
              <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400">สินค้า</th>
              <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400">ประเภท</th>
              <th class="text-right py-3 px-4 text-xs font-semibold text-slate-400">จำนวน</th>
              <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400">ผู้ดำเนินการ</th>
              <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${movements.map(m => {
              const cfg  = TYPE_CFG[m.movement_type] || TYPE_CFG.ADJUST;
              const d    = new Date(m.created_at);
              const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
              const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
              return `
                <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td class="py-2.5 px-4">
                    <div class="text-xs font-semibold text-navy">${date}</div>
                    <div class="text-xs text-slate-400 font-body">${time}</div>
                  </td>
                  <td class="py-2.5 px-4">
                    <span class="font-semibold text-navy text-xs">${m.products?.icon || ''} ${m.products?.name || '—'}</span>
                  </td>
                  <td class="py-2.5 px-4"><span class="badge ${cfg.cls} text-xs">${cfg.label}</span></td>
                  <td class="py-2.5 px-4 text-right font-bold ${m.quantity > 0 ? 'text-primary' : 'text-red-500'}">
                    ${m.quantity > 0 ? '+' : ''}${m.quantity} ${m.products?.unit || ''}
                  </td>
                  <td class="py-2.5 px-4 text-xs text-slate-400 font-body max-w-28 truncate">${m.performed_by || '—'}</td>
                  <td class="py-2.5 px-4 text-xs text-slate-400 font-body max-w-40 truncate">${m.reason || '—'}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };

  el.querySelector('#mv-search').addEventListener('click', doSearch);
  await doSearch();
}

function _defaultDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// ─── Suppliers Tab ────────────────────────────────────────────────────────────

async function _renderSuppliers(el) {
  el.innerHTML = `<div class="text-center py-12 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`;
  const res = await apiFetch(`/api/inventory/suppliers?store_id=${_storeId}`);
  _suppliers = res?.data || [];

  el.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-end">
        <button id="add-supplier-btn" class="btn-primary text-sm px-4 py-2">+ เพิ่มซัพพลายเออร์</button>
      </div>
      ${_suppliers.length === 0
        ? `<div class="card p-10 text-center text-slate-400 font-body">ยังไม่มีซัพพลายเออร์</div>`
        : _suppliers.map(s => `
            <div class="card p-4 flex items-center gap-4" data-supplier-id="${s.id}">
              <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0"><svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"/></svg></div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-navy">${s.name}</div>
                <div class="text-sm text-slate-500 font-body">
                  ${[s.contact, s.phone, s.email].filter(Boolean).join(' · ') || '—'}
                </div>
                ${s.notes ? `<div class="text-xs text-slate-400 font-body mt-0.5">${s.notes}</div>` : ''}
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <button data-sp-action="edit" data-sp-id="${s.id}"
                  class="text-xs border border-slate-200 text-slate-500 px-2.5 py-1.5 rounded-lg hover:border-primary hover:text-primary transition-colors">
                  แก้ไข
                </button>
                <button data-sp-action="delete" data-sp-id="${s.id}"
                  class="text-xs border border-red-200 text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  ลบ
                </button>
              </div>
            </div>`).join('')}
    </div>`;

  el.querySelector('#add-supplier-btn')?.addEventListener('click', () => _openSupplierModal(el));

  el.querySelectorAll('[data-sp-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.spAction;
      const sid    = btn.dataset.spId;
      const supplier = _suppliers.find(s => s.id === sid);
      if (!supplier) return;

      if (action === 'edit') {
        _openSupplierModal(el, supplier);
      } else if (action === 'delete') {
        if (!confirm(`ลบ "${supplier.name}" ออกจากระบบ?`)) return;
        btn.disabled = true;
        const res = await apiFetch(`/api/inventory/suppliers/${sid}`, { method: 'DELETE' });
        if (res?.success) {
          showToast(`ลบ ${supplier.name} แล้ว`, 'info');
          await _renderSuppliers(el);
        } else {
          showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
          btn.disabled = false;
        }
      }
    });
  });
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function _openProductModal(tabEl, existing = null) {
  const isEdit = !!existing;
  const modal = _createModal(`${isEdit ? 'แก้ไข' : 'เพิ่ม'}สินค้า`, `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <label class="input-label">ชื่อสินค้า *</label>
          <input id="pm-name" class="input-field" value="${existing?.name || ''}" placeholder="วัคซีน DHPPL">
        </div>
        <div>
          <label class="input-label">หมวดหมู่</label>
          <select id="pm-category" class="input-field">
            ${Object.entries(CATEGORIES).map(([k, v]) =>
              `<option value="${k}" ${existing?.category === k ? 'selected' : ''}>${v.emoji} ${v.label}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="input-label">หน่วย</label>
          <input id="pm-unit" class="input-field" value="${existing?.unit || ''}" placeholder="เข็ม / เม็ด / ขวด">
        </div>
        <div>
          <label class="input-label">ราคาทุน (฿)</label>
          <input id="pm-cost" class="input-field" type="number" step="0.01" value="${existing?.cost_price || ''}" placeholder="0">
        </div>
        <div>
          <label class="input-label">ราคาขาย (฿)</label>
          <input id="pm-sell" class="input-field" type="number" step="0.01" value="${existing?.sell_price || ''}" placeholder="0">
        </div>
        <div>
          <label class="input-label">จุดสั่งซื้อ (เตือนเมื่อ ≤)</label>
          <input id="pm-reorder" class="input-field" type="number" value="${existing?.reorder_point ?? 10}">
        </div>
        <div>
          <label class="input-label">จำนวนแนะนำสั่ง</label>
          <input id="pm-reorder-qty" class="input-field" type="number" value="${existing?.reorder_qty ?? 50}">
        </div>
      </div>
    </div>`);

  if (isEdit) {
    const footer = modal.querySelector('.flex.gap-3.pt-2');
    const delBtn = document.createElement('button');
    delBtn.className = 'text-sm border border-red-200 text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 font-semibold';
    delBtn.textContent = 'ลบ';
    footer.prepend(delBtn);
    delBtn.addEventListener('click', async () => {
      if (delBtn.dataset.confirm !== 'true') {
        delBtn.textContent = 'ยืนยันลบ?';
        delBtn.style.cssText = 'background:var(--color-danger,#EF4444);color:var(--color-fg-inverse,#fff);border-color:var(--color-danger,#EF4444);';
        delBtn.dataset.confirm = 'true';
        setTimeout(() => {
          if (delBtn.dataset.confirm === 'true') { delBtn.textContent = 'ลบ'; delBtn.style.cssText = ''; delBtn.dataset.confirm = ''; }
        }, 3000);
        return;
      }
      delBtn.disabled = true; delBtn.textContent = 'กำลังลบ...';
      const res = await apiFetch(`/api/inventory/products/${existing.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: false }) });
      if (res?.success) { showToast(`ลบ "${existing.name}" แล้ว`, 'info'); modal.remove(); await _renderProducts(tabEl); }
      else { showToast(res?.error || 'เกิดข้อผิดพลาด', 'error'); delBtn.disabled = false; delBtn.textContent = 'ลบ'; }
    });
  }

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name = modal.querySelector('#pm-name').value.trim();
    if (!name) { showToast('กรุณากรอกชื่อสินค้า', 'error'); return; }
    const payload = {
      store_id: _storeId, name,
      category:      modal.querySelector('#pm-category').value,
      unit:          modal.querySelector('#pm-unit').value.trim(),
      cost_price:    parseFloat(modal.querySelector('#pm-cost').value) || 0,
      sell_price:    parseFloat(modal.querySelector('#pm-sell').value) || 0,
      reorder_point: parseInt(modal.querySelector('#pm-reorder').value) || 10,
      reorder_qty:   parseInt(modal.querySelector('#pm-reorder-qty').value) || 50,
    };
    const url    = isEdit ? `/api/inventory/products/${existing.id}` : '/api/inventory/products';
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (res?.success) { showToast(isEdit ? 'แก้ไขสินค้าแล้ว' : `เพิ่ม ${name} แล้ว`); modal.remove(); await _renderProducts(tabEl); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

function _openReceiveModal(product, tabEl) {
  const supplierOptions = _suppliers.map(s =>
    `<option value="${s.id}">${s.name}</option>`).join('');

  const modal = _createModal(`รับสินค้าเข้า — ${product.name}`, `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">จำนวนที่รับ *</label>
          <input id="rv-qty" class="input-field" type="number" min="1" placeholder="50">
        </div>
        <div>
          <label class="input-label">Lot Number</label>
          <input id="rv-lot" class="input-field" placeholder="LOT-2026-001">
        </div>
        <div>
          <label class="input-label">วันหมดอายุ</label>
          <input id="rv-expiry" class="input-field" type="date">
        </div>
        <div>
          <label class="input-label">ราคาทุน/หน่วย (฿)</label>
          <input id="rv-cost" class="input-field" type="number" step="0.01" value="${product.cost_price || ''}">
        </div>
      </div>
      <div>
        <label class="input-label">ซัพพลายเออร์</label>
        <select id="rv-supplier" class="input-field">
          <option value="">— ไม่ระบุ —</option>
          ${supplierOptions}
        </select>
      </div>
      <div>
        <label class="input-label">หมายเหตุ (PO#, รายละเอียด)</label>
        <input id="rv-notes" class="input-field" placeholder="PO#123">
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const qty = parseInt(modal.querySelector('#rv-qty').value);
    if (!qty || qty < 1) { showToast('กรุณาระบุจำนวน', 'error'); return; }
    const res = await apiFetch('/api/inventory/receive', {
      method: 'POST',
      body: JSON.stringify({
        store_id:    _storeId,
        product_id:  product.id,
        lot_number:  modal.querySelector('#rv-lot').value.trim() || `LOT-${Date.now()}`,
        quantity:    qty,
        expiry_date: modal.querySelector('#rv-expiry').value || null,
        cost_price:  parseFloat(modal.querySelector('#rv-cost').value) || null,
        supplier_id: modal.querySelector('#rv-supplier').value || null,
        notes:       modal.querySelector('#rv-notes').value.trim() || null,
      }),
    });
    if (res?.success) {
      showToast(`รับสินค้าเข้า ${qty} ${product.unit || 'ชิ้น'} แล้ว`);
      modal.remove();
      await _renderProducts(tabEl);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

async function _openBatchModal(product) {
  const modal = _createModal(`Batch — ${product.name}`, `
    <div class="text-center py-6 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`);

  const res = await apiFetch(`/api/inventory/batches?store_id=${_storeId}&product_id=${product.id}`);
  const batches = res?.data || [];

  const body = modal.querySelector('div > div');
  if (batches.length === 0) {
    body.innerHTML = `<div class="text-center py-6 text-slate-400 font-body">ยังไม่มี batch ในระบบ</div>`;
    return;
  }

  body.innerHTML = `
    <div class="space-y-2 max-h-80 overflow-y-auto">
      ${batches.map(b => {
        const days = b.expiry_date
          ? Math.ceil((new Date(b.expiry_date) - new Date()) / 86400000)
          : null;
        const expiryLabel = days === null ? '—'
          : days <= 0 ? `<span class="text-red-600 font-semibold">หมดอายุแล้ว</span>`
          : days <= 30 ? `<span class="text-orange-600">${days} วัน</span>`
          : `${days} วัน`;
        const statusBadge = !b.is_active
          ? '<span class="badge bg-slate-100 text-slate-400 text-xs">ไม่ใช้งาน</span>'
          : b.quantity === 0
            ? '<span class="badge bg-red-100 text-red-600 text-xs">หมด</span>'
            : '<span class="badge badge-teal text-xs">มีสต็อก</span>';
        return `
          <div class="border border-slate-100 rounded-xl p-3 ${!b.is_active ? 'opacity-50' : ''}">
            <div class="flex justify-between items-start mb-1">
              <span class="font-semibold text-navy text-sm">Lot: ${b.lot_number}</span>
              ${statusBadge}
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs font-body text-slate-500">
              <div>คงเหลือ: <b class="text-navy">${b.quantity} ${product.unit || 'ชิ้น'}</b></div>
              <div>รับเข้า: ${b.initial_qty}</div>
              <div>หมดอายุใน: ${expiryLabel}</div>
              <div>ราคาทุน: ${b.cost_price ? `฿${parseFloat(b.cost_price).toFixed(2)}` : '—'}</div>
              <div>รับวันที่: ${b.received_date || '—'}</div>
              <div>วันหมดอายุ: ${b.expiry_date || '—'}</div>
            </div>
          </div>`;
      }).join('')}
    </div>
    <div class="text-xs text-slate-400 font-body text-right mt-2">${batches.length} batch ทั้งหมด</div>`;
}

function _openAdjustModal(product, tabEl) {
  const modal = _createModal(`ปรับยอดสต็อก — ${product.name}`, `
    <div class="space-y-3">
      <div class="bg-slate-50 rounded-xl p-3 text-sm font-body">
        สต็อกปัจจุบัน: <b class="text-navy text-lg">${product.stock || 0}</b> ${product.unit || 'ชิ้น'}
      </div>
      <div>
        <label class="input-label">จำนวนที่ปรับ * <span class="text-slate-400 font-body font-normal">(ใส่ - เพื่อลด เช่น -5)</span></label>
        <input id="adj-delta" class="input-field" type="number" placeholder="+10 หรือ -5">
      </div>
      <div>
        <label class="input-label">เหตุผล *</label>
        <select id="adj-reason-select" class="input-field">
          ${ADJUST_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <div id="adj-reason-other-wrap" class="hidden">
        <label class="input-label">ระบุเหตุผล</label>
        <input id="adj-reason-other" class="input-field" placeholder="ระบุเหตุผล...">
      </div>
    </div>`);

  // Toggle other reason input
  modal.querySelector('#adj-reason-select').addEventListener('change', (e) => {
    const wrap = modal.querySelector('#adj-reason-other-wrap');
    wrap.classList.toggle('hidden', e.target.value !== 'อื่นๆ');
  });

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const delta = parseInt(modal.querySelector('#adj-delta').value);
    if (isNaN(delta) || delta === 0) { showToast('กรุณาระบุจำนวนที่ปรับ', 'error'); return; }

    const select = modal.querySelector('#adj-reason-select').value;
    const reason = select === 'อื่นๆ'
      ? (modal.querySelector('#adj-reason-other').value.trim() || 'อื่นๆ')
      : select;

    const newStock = (product.stock || 0) + delta;
    if (newStock < 0) { showToast(`ยอดสต็อกจะติดลบ (${newStock}) ไม่สามารถปรับได้`, 'error'); return; }

    const res = await apiFetch('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({
        store_id:       _storeId,
        product_id:     product.id,
        quantity_delta: delta,
        reason,
      }),
    });
    if (res?.success) {
      showToast(`ปรับยอดสต็อก ${delta > 0 ? '+' : ''}${delta} แล้ว → คงเหลือ ${newStock} ${product.unit || 'ชิ้น'}`);
      modal.remove();
      await _renderProducts(tabEl);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

function _openSupplierModal(tabEl, existing = null) {
  const isEdit = !!existing;
  const modal = _createModal(`${isEdit ? 'แก้ไข' : 'เพิ่ม'}ซัพพลายเออร์`, `
    <div class="space-y-3">
      <div>
        <label class="input-label">ชื่อบริษัท *</label>
        <input id="sp-name" class="input-field" value="${existing?.name || ''}" placeholder="Zoetis Thailand">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ผู้ติดต่อ</label>
          <input id="sp-contact" class="input-field" value="${existing?.contact || ''}" placeholder="คุณมนัส">
        </div>
        <div>
          <label class="input-label">เบอร์โทร</label>
          <input id="sp-phone" class="input-field" value="${existing?.phone || ''}" placeholder="02-111-1111">
        </div>
      </div>
      <div>
        <label class="input-label">Email</label>
        <input id="sp-email" class="input-field" type="email" value="${existing?.email || ''}" placeholder="sales@zoetis.co.th">
      </div>
      <div>
        <label class="input-label">หมายเหตุ</label>
        <input id="sp-notes" class="input-field" value="${existing?.notes || ''}" placeholder="เงื่อนไขการสั่งขั้นต่ำ...">
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name = modal.querySelector('#sp-name').value.trim();
    if (!name) { showToast('กรุณากรอกชื่อบริษัท', 'error'); return; }
    const payload = {
      store_id: _storeId,
      name,
      contact: modal.querySelector('#sp-contact').value.trim(),
      phone:   modal.querySelector('#sp-phone').value.trim(),
      email:   modal.querySelector('#sp-email').value.trim(),
      notes:   modal.querySelector('#sp-notes').value.trim(),
    };
    const url    = isEdit ? `/api/inventory/suppliers/${existing.id}` : '/api/inventory/suppliers';
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (res?.success) {
      showToast(isEdit ? 'แก้ไขซัพพลายเออร์แล้ว' : `เพิ่ม ${name} แล้ว`);
      modal.remove();
      await _renderSuppliers(tabEl);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

// ─── Modal helper ─────────────────────────────────────────────────────────────

function _createModal(title, bodyHTML) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-lg space-y-4 my-4">
      <h3 class="font-bold text-navy text-lg">${title}</h3>
      <div>${bodyHTML}</div>
      <div class="flex gap-3 pt-2">
        <button id="modal-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="modal-confirm" class="btn-primary flex-1">บันทึก</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#modal-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  return modal;
}
