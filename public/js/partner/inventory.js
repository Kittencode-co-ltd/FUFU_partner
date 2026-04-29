import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

// Values must match products_category_check constraint in DB
const CATEGORIES = {
  medicine:  { label: 'ยา',          icon: '💊' },
  vaccine:   { label: 'วัคซีน',      icon: '💉' },
  food:      { label: 'อาหาร',       icon: '🍖' },
  accessory: { label: 'อุปกรณ์',     icon: '🩺' },
  service:   { label: 'บริการ',      icon: '🏥' },
  grooming:  { label: 'Grooming',    icon: '✂️' },
};

let _storeId  = '';
let _products = [];
let _tab      = 'products'; // 'products' | 'alerts' | 'movements' | 'suppliers'

// ─── Entry ────────────────────────────────────────────────────────────────────

export async function renderInventory(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  container.innerHTML = _shellHTML();
  _bindTabEvents(container);
  await _switchTab('products', container);
}

function _shellHTML() {
  return `
    <div class="space-y-4 max-w-5xl">
      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        ${[
          { id: 'products',  label: '📦 สินค้า' },
          { id: 'alerts',    label: '⚠️ แจ้งเตือน' },
          { id: 'movements', label: '📋 ความเคลื่อนไหว' },
          { id: 'suppliers', label: '🏭 ซัพพลายเออร์' },
        ].map(t => `
          <button data-tab="${t.id}"
            class="tab-btn px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                   ${t.id === 'products' ? 'bg-white text-navy shadow-card' : 'text-slate-500 hover:text-navy'}">
            ${t.label}
          </button>`).join('')}
      </div>

      <!-- Tab content -->
      <div id="inv-content"></div>
    </div>`;
}

function _bindTabEvents(container) {
  container.querySelector('.flex').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    container.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('bg-white',    b === btn);
      b.classList.toggle('text-navy',   b === btn);
      b.classList.toggle('shadow-card', b === btn);
      b.classList.toggle('text-slate-500', b !== btn);
    });
    await _switchTab(btn.dataset.tab, container);
  });
}

async function _switchTab(tab, container) {
  _tab = tab;
  const content = container.querySelector('#inv-content');
  if (tab === 'products')  await _renderProducts(content);
  if (tab === 'alerts')    await _renderAlerts(content);
  if (tab === 'movements') await _renderMovements(content);
  if (tab === 'suppliers') await _renderSuppliers(content);
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

async function _renderProducts(el) {
  el.innerHTML = `<div class="text-center py-12 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`;

  const res = await apiFetch(`/api/inventory?store_id=${_storeId}`);
  _products = res?.data || [];

  if (_products.length === 0) {
    el.innerHTML = `
      <div class="card p-10 text-center space-y-4">
        <div class="text-4xl">📦</div>
        <div class="font-semibold text-navy">ยังไม่มีสินค้า</div>
        <button id="add-product-btn" class="btn-primary">+ เพิ่มสินค้าแรก</button>
      </div>`;
    el.querySelector('#add-product-btn')?.addEventListener('click', () => _openProductModal(el));
    return;
  }

  el.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <span class="text-sm text-slate-400 font-body">${_products.length} รายการ</span>
      <button id="add-product-btn" class="btn-primary text-sm px-4 py-2">+ เพิ่มสินค้า</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" id="product-grid">
      ${_products.map(_productCard).join('')}
    </div>`;

  el.querySelector('#add-product-btn')?.addEventListener('click', () => _openProductModal(el));
  el.querySelector('#product-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const pid = btn.closest('[data-product-id]')?.dataset.productId;
    const product = _products.find(p => p.id === pid);
    if (!product) return;
    if (btn.dataset.action === 'receive') _openReceiveModal(product, el);
    if (btn.dataset.action === 'edit')    _openProductModal(el, product);
  });
}

function _productCard(p) {
  const stock = p.stock || 0;
  const { badge, label } = _stockBadge(stock, p.reorder_point);
  const exp   = _expiryBadge(p.nearest_expiry);
  const cat   = CATEGORIES[p.category] || CATEGORIES.other;
  const margin = p.cost_price && p.sell_price
    ? Math.round(((p.sell_price - p.cost_price) / p.sell_price) * 100)
    : null;

  return `
    <div class="card p-4 hover:shadow-card-hover transition-shadow" data-product-id="${p.id}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-2xl">${p.icon || cat.icon}</span>
          <div>
            <div class="font-semibold text-navy text-sm leading-tight">${p.name}</div>
            <div class="text-xs text-slate-400 font-body">${cat.label}</div>
          </div>
        </div>
        <span class="badge ${badge} text-xs">${label}</span>
      </div>

      <div class="flex items-end justify-between mb-3">
        <div>
          <div class="text-2xl font-bold ${stock <= (p.reorder_point||0) ? 'text-red-500' : 'text-navy'}">${stock}</div>
          <div class="text-xs text-slate-400 font-body">${p.unit || 'ชิ้น'}</div>
        </div>
        <div class="text-right">
          ${p.sell_price ? `<div class="text-sm font-semibold text-primary">฿${p.sell_price.toLocaleString()}</div>` : ''}
          ${margin !== null ? `<div class="text-xs text-slate-400 font-body">margin ${margin}%</div>` : ''}
        </div>
      </div>

      ${exp ? `<div class="mb-3">${exp}</div>` : ''}

      <div class="flex gap-2">
        <button data-action="receive" class="flex-1 text-xs border border-primary text-primary px-2 py-1.5 rounded-lg hover:bg-primary-subtle transition-colors">
          + รับสินค้า
        </button>
        <button data-action="edit" class="text-xs border border-slate-200 text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
          แก้ไข
        </button>
      </div>
    </div>`;
}

function _stockBadge(stock, reorderPoint) {
  const rp = reorderPoint || 0;
  if (stock === 0)       return { badge: 'bg-red-100 text-red-700',    label: '🔴 หมด' };
  if (stock <= 3)        return { badge: 'bg-red-100 text-red-600',    label: '🔴 วิกฤต' };
  if (stock <= rp)       return { badge: 'bg-amber-100 text-amber-700', label: '🟡 ใกล้หมด' };
  return                        { badge: 'badge-teal',                  label: '🟢 ปกติ' };
}

function _expiryBadge(expiryDate) {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
  if (days <= 0)  return `<span class="badge bg-red-100 text-red-700 text-xs">หมดอายุแล้ว</span>`;
  if (days <= 30) return `<span class="badge bg-red-50 text-red-600 text-xs">⏰ หมดใน ${days} วัน</span>`;
  if (days <= 60) return `<span class="badge bg-orange-50 text-orange-600 text-xs">⏰ หมดใน ${days} วัน</span>`;
  if (days <= 90) return `<span class="badge bg-blue-50 text-blue-600 text-xs">⏰ หมดใน ${days} วัน</span>`;
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
    el.innerHTML = `<div class="card p-10 text-center text-slate-400 font-body">✅ ไม่มีการแจ้งเตือน</div>`;
    return;
  }

  const grouped = { expired: [], critical: [], warning: [], caution: [] };
  expiry.forEach(b => {
    const days = Math.ceil((new Date(b.expiry_date) - new Date()) / 86400000);
    if (days <= 0)  grouped.expired.push({ ...b, days });
    else if (days <= 30) grouped.critical.push({ ...b, days });
    else if (days <= 60) grouped.warning.push({ ...b, days });
    else grouped.caution.push({ ...b, days });
  });

  el.innerHTML = `<div class="space-y-5">
    ${_alertSection('🔴 หมดอายุแล้ว',         grouped.expired,  'bg-red-50 border-red-200 text-red-700')}
    ${_alertSection('🟠 หมดภายใน 30 วัน',      grouped.critical, 'bg-orange-50 border-orange-200 text-orange-700')}
    ${_alertSection('🟡 หมดภายใน 31–60 วัน',   grouped.warning,  'bg-amber-50 border-amber-200 text-amber-700')}
    ${_alertSection('🔵 หมดภายใน 61–90 วัน',   grouped.caution,  'bg-blue-50 border-blue-200 text-blue-600')}
    ${reorder.length > 0 ? _reorderSection(reorder) : ''}
  </div>`;
}

function _alertSection(title, items, cls) {
  if (!items.length) return '';
  return `
    <div>
      <h3 class="font-semibold text-navy mb-2">${title} (${items.length})</h3>
      <div class="space-y-2">
        ${items.map(b => `
          <div class="border ${cls} rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <span class="font-semibold text-sm">${b.products?.name || 'Unknown'}</span>
              <span class="text-xs ml-2 font-body">Lot: ${b.lot_number}</span>
            </div>
            <div class="text-right text-xs font-body">
              <div>เหลือ ${b.quantity} ${b.products?.unit || 'ชิ้น'}</div>
              <div>${b.days <= 0 ? 'หมดอายุแล้ว' : `หมด ${b.days} วัน`}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function _reorderSection(items) {
  return `
    <div>
      <h3 class="font-semibold text-navy mb-2">📦 ต้องสั่งซื้อ (${items.length})</h3>
      <div class="space-y-2">
        ${items.map(p => `
          <div class="card px-4 py-3 flex items-center justify-between">
            <div>
              <span class="font-semibold text-sm text-navy">${p.name}</span>
              <div class="text-xs text-slate-400 font-body">
                คงเหลือ ${p.current_stock} · จุดสั่ง ${p.reorder_point} ${p.unit || 'ชิ้น'}
              </div>
            </div>
            <span class="badge badge-gold text-xs">สั่งซื้อ ${p.reorder_qty || '?'} ${p.unit || 'ชิ้น'}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── Movements Tab ────────────────────────────────────────────────────────────

async function _renderMovements(el) {
  el.innerHTML = `<div class="text-center py-12 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`;

  const res = await apiFetch(`/api/inventory/movements?store_id=${_storeId}&limit=100`);
  const movements = res?.data || [];

  if (movements.length === 0) {
    el.innerHTML = `<div class="card p-10 text-center text-slate-400 font-body">ยังไม่มีประวัติการเคลื่อนไหว</div>`;
    return;
  }

  const TYPE_CFG = {
    IN:     { label: 'รับเข้า',  cls: 'badge-teal',                    sign: '+' },
    OUT:    { label: 'จ่ายออก', cls: 'bg-red-50 text-red-600',         sign: '-' },
    ADJUST: { label: 'ปรับ',     cls: 'bg-amber-50 text-amber-700',     sign: '±' },
    EXPIRED:{ label: 'หมดอายุ', cls: 'bg-slate-100 text-slate-500',    sign: '-' },
  };

  el.innerHTML = `
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="border-b border-slate-100">
          <tr>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400">วันที่</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400">สินค้า</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400">ประเภท</th>
            <th class="text-right py-3 px-4 text-xs font-semibold text-slate-400">จำนวน</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          ${movements.map(m => {
            const cfg  = TYPE_CFG[m.movement_type] || TYPE_CFG.ADJUST;
            const d    = new Date(m.created_at);
            const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            return `
              <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td class="py-2.5 px-4">
                  <div class="text-xs font-semibold text-navy">${date}</div>
                  <div class="text-xs text-slate-400 font-body">${time}</div>
                </td>
                <td class="py-2.5 px-4">
                  <span class="font-semibold text-navy text-xs">${m.products?.icon || '📦'} ${m.products?.name || '—'}</span>
                </td>
                <td class="py-2.5 px-4">
                  <span class="badge ${cfg.cls} text-xs">${cfg.label}</span>
                </td>
                <td class="py-2.5 px-4 text-right font-bold ${m.quantity > 0 ? 'text-primary' : 'text-red-500'}">
                  ${m.quantity > 0 ? '+' : ''}${m.quantity} ${m.products?.unit || ''}
                </td>
                <td class="py-2.5 px-4 text-xs text-slate-400 font-body max-w-40 truncate">${m.reason || '—'}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── Suppliers Tab ────────────────────────────────────────────────────────────

async function _renderSuppliers(el) {
  el.innerHTML = `<div class="text-center py-12 text-slate-400 font-body animate-pulse">กำลังโหลด...</div>`;

  const res = await apiFetch(`/api/inventory/suppliers?store_id=${_storeId}`);
  const suppliers = res?.data || [];

  el.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-end">
        <button id="add-supplier-btn" class="btn-primary text-sm px-4 py-2">+ เพิ่มซัพพลายเออร์</button>
      </div>
      ${suppliers.length === 0
        ? `<div class="card p-10 text-center text-slate-400 font-body">ยังไม่มีซัพพลายเออร์</div>`
        : suppliers.map(s => `
            <div class="card p-4 flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">🏭</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-navy">${s.name}</div>
                <div class="text-sm text-slate-500 font-body">
                  ${s.contact ? `${s.contact} · ` : ''}${s.phone || ''}${s.email ? ` · ${s.email}` : ''}
                </div>
              </div>
            </div>`).join('')}
    </div>`;

  el.querySelector('#add-supplier-btn')?.addEventListener('click', () => _openSupplierModal(el));
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
              `<option value="${k}" ${existing?.category === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="input-label">หน่วย</label>
          <input id="pm-unit" class="input-field" value="${existing?.unit || ''}" placeholder="เข็ม / เม็ด / ขวด">
        </div>
        <div>
          <label class="input-label">ราคาทุน (฿)</label>
          <input id="pm-cost" class="input-field" type="number" value="${existing?.cost_price || ''}" placeholder="0">
        </div>
        <div>
          <label class="input-label">ราคาขาย (฿)</label>
          <input id="pm-sell" class="input-field" type="number" value="${existing?.sell_price || ''}" placeholder="0">
        </div>
        <div>
          <label class="input-label">จุดสั่งซื้อ (เตือนเมื่อ ≤)</label>
          <input id="pm-reorder" class="input-field" type="number" value="${existing?.reorder_point || 10}">
        </div>
        <div>
          <label class="input-label">จำนวนแนะนำสั่ง</label>
          <input id="pm-reorder-qty" class="input-field" type="number" value="${existing?.reorder_qty || 50}">
        </div>
      </div>
    </div>`);

  // ── ปุ่มลบ (เฉพาะ edit mode) ──────────────────────────────────────────────
  if (isEdit) {
    const footer = modal.querySelector('.flex.gap-3.pt-2');
    const delBtn = document.createElement('button');
    delBtn.className = 'text-sm border border-red-200 text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 font-semibold';
    delBtn.textContent = '🗑 ลบ';
    footer.prepend(delBtn);

    delBtn.addEventListener('click', async () => {
      if (delBtn.dataset.confirm !== 'true') {
        // ครั้งแรก — ขอยืนยัน
        delBtn.textContent = 'ยืนยันลบ?';
        delBtn.style.cssText = 'background:#EF4444;color:#fff;border-color:#EF4444;';
        delBtn.dataset.confirm = 'true';
        // reset กลับถ้าไม่กด 3 วินาที
        setTimeout(() => {
          if (delBtn.dataset.confirm === 'true') {
            delBtn.textContent = '🗑 ลบ';
            delBtn.style.cssText = '';
            delBtn.dataset.confirm = 'false';
          }
        }, 3000);
        return;
      }
      // ครั้งสอง — ลบจริง
      delBtn.disabled = true; delBtn.textContent = 'กำลังลบ...';
      const res = await apiFetch(`/api/inventory/products/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      });
      if (res?.success) {
        showToast(`ลบ "${existing.name}" แล้ว`, 'info');
        modal.remove();
        await _renderProducts(tabEl);
      } else {
        showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
        delBtn.disabled = false; delBtn.textContent = '🗑 ลบ';
      }
    });
  }

  // ── บันทึก ──────────────────────────────────────────────────────────────────
  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name = modal.querySelector('#pm-name').value.trim();
    if (!name) { showToast('กรุณากรอกชื่อสินค้า', 'error'); return; }

    const payload = {
      store_id:      _storeId,
      name,
      category:      modal.querySelector('#pm-category').value,
      unit:          modal.querySelector('#pm-unit').value.trim(),
      cost_price:    parseInt(modal.querySelector('#pm-cost').value) || 0,
      sell_price:    parseInt(modal.querySelector('#pm-sell').value) || 0,
      reorder_point: parseInt(modal.querySelector('#pm-reorder').value) || 10,
      reorder_qty:   parseInt(modal.querySelector('#pm-reorder-qty').value) || 50,
    };

    const url    = isEdit ? `/api/inventory/products/${existing.id}` : '/api/inventory/products';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    if (res?.success) {
      showToast(isEdit ? 'แก้ไขสินค้าแล้ว' : `เพิ่ม ${name} แล้ว`);
      modal.remove();
      await _renderProducts(tabEl);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

function _openReceiveModal(product, tabEl) {
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
          <input id="rv-cost" class="input-field" type="number" value="${product.cost_price || ''}">
        </div>
      </div>
      <div>
        <label class="input-label">หมายเหตุ</label>
        <input id="rv-notes" class="input-field" placeholder="PO#123 / ซัพพลายเออร์...">
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
        cost_price:  parseInt(modal.querySelector('#rv-cost').value) || null,
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

function _openSupplierModal(tabEl) {
  const modal = _createModal('เพิ่มซัพพลายเออร์', `
    <div class="space-y-3">
      <div>
        <label class="input-label">ชื่อบริษัท *</label>
        <input id="sp-name" class="input-field" placeholder="Zoetis Thailand">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ผู้ติดต่อ</label>
          <input id="sp-contact" class="input-field" placeholder="คุณมนัส">
        </div>
        <div>
          <label class="input-label">เบอร์โทร</label>
          <input id="sp-phone" class="input-field" placeholder="02-111-1111">
        </div>
      </div>
      <div>
        <label class="input-label">Email</label>
        <input id="sp-email" class="input-field" type="email" placeholder="sales@zoetis.co.th">
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name = modal.querySelector('#sp-name').value.trim();
    if (!name) { showToast('กรุณากรอกชื่อบริษัท', 'error'); return; }

    const res = await apiFetch('/api/inventory/suppliers', {
      method: 'POST',
      body: JSON.stringify({
        store_id: _storeId,
        name,
        contact:  modal.querySelector('#sp-contact').value.trim(),
        phone:    modal.querySelector('#sp-phone').value.trim(),
        email:    modal.querySelector('#sp-email').value.trim(),
      }),
    });

    if (res?.success) {
      showToast(`เพิ่ม ${name} แล้ว`);
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
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-lg space-y-4">
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
