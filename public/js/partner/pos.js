import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const PAYMENT_METHODS = {
  cash:      { label: 'เงินสด',    icon: '💵' },
  transfer:  { label: 'โอนเงิน',   icon: '🏦' },
  card:      { label: 'บัตรเครดิต', icon: '💳' },
  promptpay: { label: 'พร้อมเพย์',  icon: '📱' },
};

// ─── Entry ────────────────────────────────────────────────────────────────────

export function renderPOS(container, context = {}) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const { queueItem, medicalRecord } = context;

  // Pre-fill from medical record prescriptions
  const lineItems = _buildLineItems(medicalRecord);

  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4">

      <!-- Header -->
      <div class="flex items-center gap-3">
        <button id="pos-back" class="btn-outline text-sm px-3 py-2">← กลับ</button>
        <div>
          <h2 class="font-bold text-navy text-lg">ชำระเงิน</h2>
          ${queueItem ? `<p class="text-sm text-slate-400 font-body">คิว A${String(queueItem.queue_number||0).padStart(3,'0')} · ${queueItem.notes || ''}</p>` : ''}
        </div>
      </div>

      <!-- Line items -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-navy">รายการ</h3>
          <button id="pos-add-item" class="text-sm text-primary border border-primary px-3 py-1 rounded-lg hover:bg-primary-subtle transition-colors">+ เพิ่มรายการ</button>
        </div>
        <div id="pos-items" class="space-y-2">
          ${lineItems.map((item, i) => _itemRow(item, i)).join('')}
          ${!lineItems.length ? `<p class="text-slate-400 font-body text-sm text-center py-4">ยังไม่มีรายการ</p>` : ''}
        </div>
      </div>

      <!-- Summary -->
      <div class="card p-5 space-y-3">
        <div class="flex justify-between text-sm">
          <span class="text-slate-500 font-body">ราคารวม</span>
          <span id="pos-subtotal" class="font-semibold text-navy">฿0</span>
        </div>
        <div class="flex justify-between items-center text-sm">
          <span class="text-slate-500 font-body">ส่วนลด</span>
          <div class="flex items-center gap-2">
            <span class="text-slate-400 font-body">฿</span>
            <input id="pos-discount" type="number" value="0" min="0"
              class="w-24 px-2 py-1 border border-slate-200 rounded-lg text-right text-sm outline-none focus:border-primary">
          </div>
        </div>
        <div class="flex justify-between text-sm border-t border-slate-100 pt-3">
          <span class="font-semibold text-navy">ยอดสุทธิ</span>
          <span id="pos-total" class="font-bold text-primary text-xl">฿0</span>
        </div>
        <div class="flex justify-between text-xs text-slate-400 font-body">
          <span>ค่าคอม FUFU 5%</span>
          <span id="pos-commission">฿0</span>
        </div>
      </div>

      <!-- Payment method -->
      <div class="card p-5">
        <h3 class="font-semibold text-navy mb-3">วิธีชำระเงิน</h3>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          ${Object.entries(PAYMENT_METHODS).map(([k, v]) => `
            <button data-method="${k}"
              class="method-btn flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all
                     ${k === 'cash' ? 'border-primary bg-primary-subtle' : 'border-slate-100 hover:border-primary hover:bg-primary-subtle'}">
              <span class="text-2xl">${v.icon}</span>
              <span class="text-xs font-semibold">${v.label}</span>
            </button>`).join('')}
        </div>
        <div id="pos-ref-wrap" class="hidden mt-3">
          <label class="input-label">เลข Reference / ธนาคาร</label>
          <input id="pos-ref" class="input-field" placeholder="xxx-xxx-xxxx">
        </div>
        <div id="pos-qr-wrap" class="hidden mt-4 flex flex-col items-center gap-3">
          <div class="text-sm font-semibold text-navy">สแกน QR พร้อมเพย์</div>
          <div id="pos-qr-img" class="w-48 h-48 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-200">
            <span class="text-slate-400 text-xs font-body text-center px-4">กำลังสร้าง QR...</span>
          </div>
          <div id="pos-qr-amount" class="text-lg font-bold text-primary"></div>
          <p class="text-xs text-slate-400 font-body text-center">ยืนยันหลังลูกค้าชำระเงินแล้วกด <strong>ยืนยัน</strong></p>
        </div>
      </div>

      <!-- Confirm -->
      <button id="pos-confirm" class="btn-primary w-full py-4 text-base">
        ยืนยันการชำระเงิน
      </button>
    </div>`;

  // State
  let items    = [...lineItems];
  let method   = 'cash';

  // Back
  container.querySelector('#pos-back')?.addEventListener('click', () => {
    import('../partner/dashboard.js').then(({ navigate }) => navigate('queue'));
  });

  // Add item
  container.querySelector('#pos-add-item')?.addEventListener('click', () => _openAddItemModal(storeId, items, container));

  // Remove item
  container.querySelector('#pos-items')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    items.splice(parseInt(btn.dataset.remove), 1);
    _refreshItems(container, items);
    _calcTotal(container, items);
  });

  // Price/qty edit
  container.querySelector('#pos-items')?.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-field]');
    if (!inp) return;
    const idx = parseInt(inp.dataset.idx);
    if (inp.dataset.field === 'qty')   items[idx].qty        = parseInt(inp.value) || 1;
    if (inp.dataset.field === 'price') items[idx].unit_price = parseInt(inp.value) || 0;
    _calcTotal(container, items);
  });

  // Discount
  container.querySelector('#pos-discount')?.addEventListener('input', () => _calcTotal(container, items));

  // Payment method
  container.querySelectorAll('.method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.method-btn').forEach(b => b.classList.remove('border-primary','bg-primary-subtle'));
      btn.classList.add('border-primary','bg-primary-subtle');
      method = btn.dataset.method;
      const refWrap = container.querySelector('#pos-ref-wrap');
      refWrap.classList.toggle('hidden', method === 'cash' || method === 'promptpay');
      _updateQR(container, method, items);
    });
  });

  // Confirm
  container.querySelector('#pos-confirm')?.addEventListener('click', async () => {
    if (!items.length) { showToast('กรุณาเพิ่มรายการก่อน', 'error'); return; }
    const discount = parseInt(container.querySelector('#pos-discount').value) || 0;
    const ref      = container.querySelector('#pos-ref')?.value.trim() || null;
    const notes    = queueItem?.notes || '';
    const [petName, ownerName] = notes.includes(' - ') ? notes.split(' - ').map(s=>s.trim()) : [notes, ''];

    const btn = container.querySelector('#pos-confirm');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const res = await apiFetch('/api/pos/checkout', {
      method: 'POST',
      body: JSON.stringify({
        store_id:          storeId,
        queue_entry_id:    queueItem?.id || null,
        medical_record_id: medicalRecord?.id || null,
        pet_name:          petName,
        owner_name:        ownerName,
        line_items:        items.map(i => ({ name: i.name, qty: i.qty, unit_price: i.unit_price, total: i.qty * i.unit_price })),
        discount,
        payment_method:    method,
        payment_reference: ref,
      }),
    });

    btn.disabled = false; btn.textContent = 'ยืนยันการชำระเงิน';

    if (res?.success) {
      _showReceipt(container, res.data, items, discount, method);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });

  _calcTotal(container, items);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _buildLineItems(record) {
  if (!record) return [{ name: 'ค่าตรวจ', qty: 1, unit_price: 0 }];
  const items = [{ name: 'ค่าตรวจ', qty: 1, unit_price: 0 }];
  const rxs = record.prescriptions || record.prescribed_meds || [];
  if (Array.isArray(rxs)) {
    rxs.forEach(rx => items.push({ name: rx.drug || rx.name, qty: rx.qty || 1, unit_price: 0 }));
  }
  return items;
}

function _itemRow(item, i) {
  return `
    <div class="flex items-center gap-2 py-1">
      <span class="flex-1 text-sm text-navy font-semibold truncate">${item.name}</span>
      <input data-field="qty" data-idx="${i}" type="number" value="${item.qty}" min="1"
        class="w-14 px-2 py-1 border border-slate-200 rounded-lg text-center text-sm outline-none focus:border-primary">
      <span class="text-slate-400 text-xs font-body">×</span>
      <input data-field="price" data-idx="${i}" type="number" value="${item.unit_price}" min="0"
        class="w-24 px-2 py-1 border border-slate-200 rounded-lg text-right text-sm outline-none focus:border-primary">
      <span class="text-slate-400 text-xs font-body">฿</span>
      <button data-remove="${i}" class="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none px-1">×</button>
    </div>`;
}

function _refreshItems(container, items) {
  const el = container.querySelector('#pos-items');
  if (!el) return;
  el.innerHTML = items.length
    ? items.map((item, i) => _itemRow(item, i)).join('')
    : `<p class="text-slate-400 font-body text-sm text-center py-4">ยังไม่มีรายการ</p>`;
}

function _calcTotal(container, items) {
  const subtotal = items.reduce((s, i) => s + (i.qty * i.unit_price), 0);
  const discount = parseInt(container.querySelector('#pos-discount')?.value) || 0;
  const total    = Math.max(0, subtotal - discount);
  const comm     = Math.round(total * 0.05);
  container.querySelector('#pos-subtotal').textContent   = `฿${subtotal.toLocaleString('th-TH')}`;
  container.querySelector('#pos-total').textContent      = `฿${total.toLocaleString('th-TH')}`;
  container.querySelector('#pos-commission').textContent = `฿${comm.toLocaleString('th-TH')}`;

  const activeMethod = container.querySelector('.method-btn.border-primary')?.dataset.method;
  if (activeMethod === 'promptpay') _updateQR(container, 'promptpay', items);
}

// ─── PromptPay QR ─────────────────────────────────────────────────────────────

function _crc16(str) {
  let crc = 0xFFFF;
  for (const ch of str) {
    crc ^= ch.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function _buildPromptPayPayload(promptPayId, amount) {
  const isPhone = /^0\d{9}$/.test(promptPayId);
  const id      = isPhone ? '0066' + promptPayId.slice(1) : promptPayId.replace(/-/g, '');
  const idTag   = isPhone ? '01' : '02';
  const idField = `${idTag}${String(id.length).padStart(2, '0')}${id}`;
  const inner   = `0016A000000677010111${idField}`;
  const tag29   = `29${String(inner.length).padStart(2, '0')}${inner}`;
  let payload   = `000201010212${tag29}5303764`;
  if (amount > 0) {
    const amtStr = amount.toFixed(2);
    payload += `54${String(amtStr.length).padStart(2, '0')}${amtStr}`;
  }
  payload += `5802TH6304`;
  return payload + _crc16(payload);
}

function _updateQR(container, method, items) {
  const qrWrap = container.querySelector('#pos-qr-wrap');
  const qrImg  = container.querySelector('#pos-qr-img');
  const qrAmt  = container.querySelector('#pos-qr-amount');
  if (!qrWrap) return;

  if (method !== 'promptpay') { qrWrap.classList.add('hidden'); return; }
  qrWrap.classList.remove('hidden');

  const discount  = parseInt(container.querySelector('#pos-discount')?.value) || 0;
  const subtotal  = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const total     = Math.max(0, subtotal - discount);
  const ppId      = localStorage.getItem('fufu_promptpay_id') || '';

  if (!ppId) {
    qrImg.innerHTML = `<span class="text-xs text-slate-400 font-body text-center px-4">ตั้งค่า PromptPay ID<br>ในหน้าตั้งค่าก่อน</span>`;
    if (qrAmt) qrAmt.textContent = '';
    return;
  }

  const payload = _buildPromptPayPayload(ppId, total);
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(payload)}`;
  qrImg.innerHTML = `<img src="${qrUrl}" alt="PromptPay QR" class="w-44 h-44 rounded-xl object-contain">`;
  if (qrAmt) qrAmt.textContent = `฿${total.toLocaleString('th-TH')}`;
}

async function _openAddItemModal(storeId, items, container) {
  const invRes  = await apiFetch(`/api/inventory?store_id=${storeId}`);
  const products = invRes?.data || [];

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 p-6 w-full max-w-md space-y-4 shadow-card-hover">
      <h3 class="font-bold text-navy text-lg">เพิ่มรายการ</h3>
      <div>
        <label class="input-label">เลือกจากสต็อก</label>
        <select id="mi-product" class="input-field">
          <option value="">— รายการพิเศษ —</option>
          ${products.map(p => `<option value="${p.id}" data-name="${p.name}" data-price="${p.sell_price||0}">${p.icon||'📦'} ${p.name} (฿${p.sell_price||0})</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="input-label">ชื่อรายการ *</label>
        <input id="mi-name" class="input-field" placeholder="ค่าตรวจ / ค่ายา / ค่าบริการ">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">จำนวน</label>
          <input id="mi-qty" class="input-field" type="number" value="1" min="1">
        </div>
        <div>
          <label class="input-label">ราคาต่อหน่วย (฿)</label>
          <input id="mi-price" class="input-field" type="number" value="0" min="0">
        </div>
      </div>
      <div class="flex gap-3">
        <button id="mi-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="mi-add" class="btn-primary flex-1">+ เพิ่ม</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#mi-product').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt.value) {
      modal.querySelector('#mi-name').value  = opt.dataset.name;
      modal.querySelector('#mi-price').value = opt.dataset.price;
    }
  });
  modal.querySelector('#mi-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#mi-add').addEventListener('click', () => {
    const name = modal.querySelector('#mi-name').value.trim();
    if (!name) { showToast('กรุณากรอกชื่อรายการ', 'error'); return; }
    items.push({ name, qty: parseInt(modal.querySelector('#mi-qty').value)||1, unit_price: parseInt(modal.querySelector('#mi-price').value)||0 });
    _refreshItems(container, items);
    _calcTotal(container, items);
    modal.remove();
  });
}

function _showReceipt(container, result, items, discount, method) {
  const subtotal   = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const total      = Math.max(0, subtotal - discount);
  const pm         = PAYMENT_METHODS[method];
  const petName    = result.invoice?.pet_name   || '';
  const ownerName  = result.invoice?.owner_name || '';
  const storeName  = storage.get(STORAGE_KEYS.STORE_NAME) || 'คลินิก';
  const paidAt     = result.invoice?.created_at || new Date().toISOString();

  container.innerHTML = `
    <div class="max-w-md mx-auto space-y-4">
      <div class="card p-6 text-center space-y-3">
        <div class="text-5xl">✅</div>
        <h2 class="font-bold text-navy text-xl">ชำระเงินสำเร็จ</h2>
        <p class="text-slate-400 font-body text-sm">${result.invoice_number}</p>
        ${petName ? `<p class="text-sm font-semibold text-navy font-body">🐾 ${petName}${ownerName ? ' · ' + ownerName : ''}</p>` : ''}
        <div class="text-3xl font-bold text-primary">฿${total.toLocaleString('th-TH')}</div>
        <p class="text-sm text-slate-500 font-body">${pm.icon} ${pm.label}</p>
      </div>

      <div class="card p-5 space-y-2">
        ${items.map(i => `
          <div class="flex justify-between text-sm">
            <span class="text-slate-600 font-body">${i.name} × ${i.qty}</span>
            <span class="font-semibold text-navy">฿${(i.qty * i.unit_price).toLocaleString()}</span>
          </div>`).join('')}
        ${discount ? `<div class="flex justify-between text-sm text-red-500 border-t border-slate-50 pt-2"><span class="font-body">ส่วนลด</span><span>-฿${discount.toLocaleString()}</span></div>` : ''}
        <div class="flex justify-between font-bold border-t border-slate-100 pt-2">
          <span class="text-navy">รวม</span>
          <span class="text-primary">฿${total.toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-xs text-slate-400 font-body">
          <span>ค่าคอม FUFU 5%</span>
          <span>฿${(result.commission || 0).toLocaleString()}</span>
        </div>
      </div>

      <div class="flex gap-3">
        <button id="receipt-print" class="btn-outline flex-1 py-3">🖨 พิมพ์ / PDF</button>
        <button id="receipt-done"  class="btn-primary flex-1 py-3">กลับหน้าคิว</button>
      </div>
    </div>`;

  container.querySelector('#receipt-done')?.addEventListener('click', () => {
    import('../partner/dashboard.js').then(({ navigate }) => navigate('queue'));
  });

  container.querySelector('#receipt-print')?.addEventListener('click', () => {
    _printReceipt({
      invoiceNumber: result.invoice_number,
      storeName,
      petName,
      ownerName,
      items,
      subtotal,
      discount,
      total,
      commission: result.commission || 0,
      method:     pm.label,
      paidAt,
    });
  });

  showToast(`ชำระเงินสำเร็จ ฿${total.toLocaleString()}`);
}

function _printReceipt({ invoiceNumber, storeName, petName, ownerName, items, subtotal, discount, total, commission, method, paidAt }) {
  const dateStr = new Date(paidAt).toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const lineRows = items.map(i =>
    `<tr>
      <td>${_esc(i.name)}</td>
      <td class="num">${i.qty}</td>
      <td class="num">฿${(i.unit_price).toLocaleString('th-TH')}</td>
      <td class="num">฿${(i.qty * i.unit_price).toLocaleString('th-TH')}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ใบเสร็จ ${_esc(invoiceNumber)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Sarabun', 'Tahoma', sans-serif; font-size:13px; color:#111;
         padding:24px; max-width:340px; margin:auto; }
  h1   { font-size:18px; text-align:center; margin-bottom:2px; }
  .sub { text-align:center; color:#555; font-size:11px; line-height:1.6; }
  .dashed { border:none; border-top:1px dashed #bbb; margin:10px 0; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th    { text-align:left; padding:3px 0; color:#555; font-weight:normal; border-bottom:1px solid #ddd; }
  td    { padding:3px 0; vertical-align:top; }
  .num  { text-align:right; }
  .total-row td { font-weight:bold; font-size:14px; padding-top:6px; }
  .commission   { color:#888; font-size:11px; }
  .method  { text-align:center; margin-top:8px; font-size:12px; color:#333; }
  .footer  { text-align:center; color:#aaa; font-size:10px; margin-top:16px; line-height:1.8; }
  .print-btn { display:block; width:100%; margin-top:20px; padding:10px;
               background:#0D9488; color:#fff; border:none; border-radius:8px;
               font-size:14px; cursor:pointer; font-family:inherit; }
  @media print {
    .print-btn { display:none !important; }
    body { padding:0; }
  }
</style>
</head>
<body>
  <h1>${_esc(storeName)}</h1>
  <div class="sub">
    ${dateStr}<br>
    เลขที่: ${_esc(invoiceNumber)}
    ${petName ? `<br>🐾 ${_esc(petName)}${ownerName ? ' · ' + _esc(ownerName) : ''}` : ''}
  </div>

  <hr class="dashed">

  <table>
    <thead>
      <tr>
        <th>รายการ</th>
        <th class="num">จำนวน</th>
        <th class="num">ราคา</th>
        <th class="num">รวม</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <hr class="dashed">

  <table>
    <tbody>
      ${discount ? `<tr><td>ส่วนลด</td><td class="num" style="color:#c53030">-฿${discount.toLocaleString('th-TH')}</td></tr>` : ''}
      <tr class="total-row">
        <td>รวมทั้งสิ้น</td>
        <td class="num" style="color:#0D9488">฿${total.toLocaleString('th-TH')}</td>
      </tr>
      <tr class="commission">
        <td>ค่าคอม FUFU 5%</td>
        <td class="num">฿${commission.toLocaleString('th-TH')}</td>
      </tr>
    </tbody>
  </table>

  <div class="method">ชำระโดย: ${_esc(method)}</div>

  <hr class="dashed">
  <div class="footer">
    ขอบคุณที่ใช้บริการ<br>
    Powered by FUFU Partner
  </div>

  <button class="print-btn" onclick="window.print()">🖨 พิมพ์ / บันทึก PDF</button>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const tab  = window.open(url, '_blank');
  // Revoke blob URL after tab loads (60 s is more than enough)
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (!tab) showToast('กรุณาอนุญาต Pop-up เพื่อพิมพ์ใบเสร็จ', 'error');
}

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
