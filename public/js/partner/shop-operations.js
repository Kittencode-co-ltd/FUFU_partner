import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { icon } from '../utils/icons.js';
import { showToast } from '../utils/toast.js';
import { openSheet } from './sheet.js';

// Online orders and the delivery desk. Styles: .so-* in src/css/input.css (theme tokens, so dark mode follows).

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const baht = n => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

const STATUS = {
  pending_store_confirmation: { label: 'รอยืนยัน', tone: 'new' },
  preparing: { label: 'กำลังจัดเตรียม', tone: 'work' },
  ready_for_pickup: { label: 'พร้อมให้รับ · รอลูกค้ามารับ', tone: 'work' },
  handed_to_courier: { label: 'กำลังจัดส่ง', tone: 'work' },
  delivered: { label: 'ส่งถึงแล้ว · รอลูกค้ายืนยัน', tone: 'work' },
  delivery_failed: { label: 'จัดส่งไม่สำเร็จ', tone: 'bad' },
  return_requested: { label: 'ลูกค้าขอคืนสินค้า', tone: 'bad' },
  completed: { label: 'สำเร็จ', tone: 'done' },
  rejected: { label: 'ปฏิเสธแล้ว', tone: 'off' },
  cancelled: { label: 'ลูกค้ายกเลิก', tone: 'off' },
  returned: { label: 'รับสินค้าคืนแล้ว', tone: 'off' },
  refunded: { label: 'คืนเงินแล้ว', tone: 'off' },
};

const TABS = [
  { id: 'new', label: 'ใหม่', test: o => o.status === 'pending_store_confirmation' },
  { id: 'active', label: 'กำลังดำเนินการ', test: o => ['preparing', 'ready_for_pickup', 'handed_to_courier', 'delivered', 'delivery_failed', 'return_requested'].includes(o.status) },
  { id: 'done', label: 'เสร็จสิ้น', test: o => ['completed', 'rejected', 'cancelled', 'returned', 'refunded'].includes(o.status) },
  { id: 'all', label: 'ทั้งหมด', test: () => true },
];

// Progress steps shown on each card
const STEPS = {
  pickup: [['pending_store_confirmation', 'รับคำสั่ง'], ['preparing', 'จัดเตรียม'], ['ready_for_pickup', 'พร้อมให้รับ'], ['completed', 'ลูกค้ารับแล้ว']],
  delivery: [['pending_store_confirmation', 'รับคำสั่ง'], ['preparing', 'จัดเตรียม'], ['handed_to_courier', 'ส่งให้ขนส่ง'], ['delivered', 'ส่งถึง'], ['completed', 'สำเร็จ']],
};

// What the store can do next (mirrors transition_commerce_order). [status, label, kind]
function actionsFor(order) {
  return ({
    pending_store_confirmation: [['preparing', 'ยืนยันและเริ่มเตรียม', 'primary'], ['rejected', 'ปฏิเสธ', 'danger']],
    preparing: order.fulfillment_method === 'pickup' ? [['ready_for_pickup', 'พร้อมให้ลูกค้ารับ', 'primary']] : [['handed_to_courier', 'ส่งให้ขนส่ง', 'primary']],
    handed_to_courier: [['delivered', 'ยืนยันส่งถึงลูกค้า', 'primary'], ['delivery_failed', 'แจ้งจัดส่งไม่สำเร็จ', 'danger']],
    delivery_failed: [['handed_to_courier', 'จัดส่งอีกครั้ง', 'primary']],
    return_requested: [['returned', 'ยืนยันรับสินค้าคืน', 'primary']],
  })[order.status] || [];
}

const hint = order => ({
  ready_for_pickup: 'ลูกค้าจะกดยืนยันในแอปเมื่อได้รับสินค้า',
  delivered: 'รอลูกค้ากดยืนยันว่าได้รับสินค้าในแอป',
})[order.status] || '';

let _tab = 'new';

export async function renderShopOperations(container, view = 'orders') {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  if (!storeId) { container.innerHTML = '<div class="so-empty card">ไม่พบร้านที่เลือก กรุณาเลือกร้านค้าแล้วลองอีกครั้ง</div>'; return; }
  if (!container.querySelector('.so')) container.innerHTML = '<div class="so"><div class="so-card card so-skel"></div><div class="so-card card so-skel"></div></div>';

  const response = await apiFetch(`/api/orders?store_id=${encodeURIComponent(storeId)}`);
  if (!response?.success) {
    container.innerHTML = `<div class="so-empty card"><p>${esc(response?.error || 'โหลดคำสั่งซื้อไม่สำเร็จ')}</p><button type="button" class="ph-btn" data-so-reload>ลองอีกครั้ง</button></div>`;
    container.onclick = e => { if (e.target.closest('[data-so-reload]')) renderShopOperations(container, view); };
    return;
  }
  const all = (response.data || []).filter(o => view !== 'delivery' || o.fulfillment_method === 'delivery');
  // Open on the tab that needs attention
  if (!all.some(TABS.find(t => t.id === _tab).test)) _tab = all.some(TABS[0].test) ? 'new' : all.some(TABS[1].test) ? 'active' : 'all';
  const shown = all.filter(TABS.find(t => t.id === _tab).test);
  const waiting = all.filter(TABS[0].test).length;

  container.innerHTML = `<div class="so">
    <header class="so-head">
      <div class="min-w-0"><h2 class="so-title">${view === 'delivery' ? 'จัดส่งสินค้า' : 'คำสั่งซื้อออนไลน์'}</h2>
        <p class="so-sub">${waiting ? `มี ${waiting} คำสั่งซื้อรอยืนยัน` : 'คำสั่งซื้อจากแอป FUFU'} · ชำระเงินเมื่อรับสินค้า</p></div>
      <button type="button" class="icon-btn" data-so-reload aria-label="โหลดใหม่" title="โหลดใหม่"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16 4h4v4M20 4l-4.5 4.5A7 7 0 1 0 19 13"/></svg></button>
    </header>
    <div class="so-tabs" role="group" aria-label="กรองคำสั่งซื้อ">${TABS.map(t => {
      const n = all.filter(t.test).length;
      return `<button type="button" class="so-tab" data-so-tab="${t.id}" aria-pressed="${_tab === t.id}">${t.label}<span>${n}</span></button>`;
    }).join('')}</div>
    ${shown.length ? `<div class="so-list">${shown.map(card).join('')}</div>`
      : `<section class="so-empty card"><span class="so-empty__icon">${icon('receipt', 'w-6 h-6')}</span><p>${all.length ? 'ไม่มีคำสั่งซื้อในหมวดนี้' : 'ยังไม่มีคำสั่งซื้อ คำสั่งซื้อจากแอป FUFU จะแสดงที่นี่'}</p></section>`}
  </div>`;

  container.onclick = async event => {
    if (event.target.closest('[data-so-reload]')) return renderShopOperations(container, view);
    const tab = event.target.closest('[data-so-tab]');
    if (tab) { _tab = tab.dataset.soTab; return renderShopOperations(container, view); }
    const button = event.target.closest('[data-status]');
    if (!button) return;
    const orderId = button.closest('[data-order]').dataset.order;
    const status = button.dataset.status;
    const extra = await askDetails(status);
    if (extra === null) return;
    button.disabled = true;
    const result = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/transition`, { method: 'POST', body: JSON.stringify({ store_id: storeId, status, ...extra }) });
    if (!result?.success) { showToast(result?.error || 'เปลี่ยนสถานะไม่สำเร็จ', 'error'); button.disabled = false; return; }
    showToast(`อัปเดตเป็น “${STATUS[status]?.label || status}” แล้ว ลูกค้าได้รับแจ้งเตือน`);
    await renderShopOperations(container, view);
  };
}

function card(order) {
  const s = STATUS[order.status] || { label: order.status, tone: 'off' };
  const steps = STEPS[order.fulfillment_method === 'pickup' ? 'pickup' : 'delivery'];
  const at = steps.findIndex(([id]) => id === order.status);
  const items = order.commerce_order_items || [];
  const addr = order.delivery_address;
  const delivery = order.order_deliveries?.[0];
  const actions = actionsFor(order);
  const lastReason = [...(order.order_status_history || [])].reverse().find(h => h.reason)?.reason;
  return `<article class="so-card card" data-order="${esc(order.id)}">
    <div class="so-card__top">
      <div class="min-w-0">
        <div class="so-no">#${esc(order.id.slice(0, 8).toUpperCase())}</div>
        <div class="so-meta">${new Date(order.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} · <span class="so-method">${order.fulfillment_method === 'pickup' ? 'รับที่ร้าน' : 'จัดส่ง'}</span></div>
      </div>
      <span class="so-chip is-${s.tone}">${esc(s.label)}</span>
    </div>
    ${at >= 0 ? `<ol class="so-steps" aria-label="ขั้นตอน">${steps.map(([, label], i) => `<li class="${i < at ? 'is-done' : i === at ? 'is-now' : ''}"><i></i><span>${label}</span></li>`).join('')}</ol>` : ''}
    <ul class="so-items">${items.map(i => `<li><span>${esc(i.product_name)} <b>× ${i.quantity}</b></span><span>${baht(i.line_total)}</span></li>`).join('')}</ul>
    <div class="so-total">
      ${Number(order.delivery_fee) ? `<div><span>ค่าจัดส่ง</span><span>${baht(order.delivery_fee)}</span></div>` : ''}
      <div class="is-grand"><span>ยอดรวม · ชำระเมื่อรับสินค้า</span><span>${baht(order.total_amount)}</span></div>
    </div>
    <div class="so-who">
      <a class="so-line" href="tel:${esc(String(order.customer_phone || '').replace(/[^\d+]/g, ''))}">${icon('phone', 'w-4 h-4')}<span>${esc(order.customer_phone)}</span></a>
      ${addr ? `<div class="so-line">${icon('store', 'w-4 h-4')}<span><b>${esc(addr.address)}</b><br>${esc(addr.details)}</span></div>
        ${hasPoint(addr) ? `<a class="so-map" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${Number(addr.latitude)},${Number(addr.longitude)}">เปิดหมุดในแผนที่</a>` : ''}` : ''}
      ${order.customer_note ? `<div class="so-line is-note">${icon('pen', 'w-4 h-4')}<span>${esc(order.customer_note)}</span></div>` : ''}
      ${delivery?.provider ? `<div class="so-line">${icon('exchange-alt', 'w-4 h-4')}<span>${esc(delivery.provider)}${delivery.tracking_number ? ` · เลขติดตาม ${esc(delivery.tracking_number)}` : ''}</span></div>` : ''}
      ${lastReason && ['rejected', 'cancelled', 'delivery_failed', 'return_requested'].includes(order.status) ? `<div class="so-line is-reason">${icon('exclamation-triangle', 'w-4 h-4')}<span>${esc(lastReason)}</span></div>` : ''}
    </div>
    ${actions.length ? `<div class="so-actions">${actions.map(([status, label, kind]) => `<button type="button" data-status="${status}" class="ph-btn ${kind === 'primary' ? 'is-primary' : 'is-danger'}">${label}</button>`).join('')}</div>`
      : hint(order) ? `<p class="so-hint">${hint(order)}</p>` : ''}
  </article>`;
}

/** Collects the reason / courier details a transition needs. Resolves {} when none needed, null when cancelled. */
function askDetails(status) {
  const forms = {
    rejected: { title: 'ปฏิเสธคำสั่งซื้อ', sub: 'ลูกค้าจะเห็นเหตุผลนี้ในแอป และสินค้าจะคืนเข้าสต็อก', fields: [['reason', 'เหตุผล', 'เช่น สินค้าหมด หรืออยู่นอกพื้นที่จัดส่ง', 3, true]], submit: 'ยืนยันปฏิเสธ', danger: true },
    delivery_failed: { title: 'จัดส่งไม่สำเร็จ', sub: 'แจ้งลูกค้าว่าเกิดอะไรขึ้น', fields: [['reason', 'เหตุผล', 'เช่น ติดต่อผู้รับไม่ได้', 3, true]], submit: 'บันทึก', danger: true },
    handed_to_courier: { title: 'ส่งให้ขนส่ง', sub: 'ลูกค้าจะเห็นผู้ให้บริการและเลขติดตาม', fields: [['provider', 'ผู้ให้บริการขนส่ง', 'เช่น Grab, Lineman, Flash, ร้านส่งเอง', 2, false], ['tracking_number', 'เลขติดตาม (ไม่บังคับ)', '', 0, false]], submit: 'ยืนยันส่งให้ขนส่ง' },
  };
  const f = forms[status];
  if (!f) return Promise.resolve({});
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    const sheet = openSheet({ title: f.title, subtitle: f.sub, onClose: () => finish(null) });
    sheet.body.innerHTML = f.fields.map(([name, label, ph, , multi]) => `<label class="cx-field"><span>${label}${f.fields.find(x => x[0] === name)[3] ? ' <b aria-hidden="true">*</b>' : ''}</span>${multi
      ? `<textarea rows="3" maxlength="1000" data-f="${name}" placeholder="${esc(ph)}"></textarea>`
      : `<input type="text" maxlength="200" data-f="${name}" placeholder="${esc(ph)}">`}</label>`).join('') + '<p class="mt-2 text-sm text-red-700" data-err role="alert" hidden></p>';
    sheet.foot.innerHTML = `<button type="button" class="ph-btn" data-x>ยกเลิก</button><button type="button" class="ph-btn ${f.danger ? 'is-danger' : 'is-primary'}" data-ok>${f.submit}</button>`;
    sheet.body.querySelector('[data-f]')?.focus();
    sheet.foot.querySelector('[data-x]').onclick = () => { finish(null); sheet.close(); };
    sheet.foot.querySelector('[data-ok]').onclick = () => {
      const out = {};
      for (const [name, label, , min] of f.fields) {
        const v = sheet.body.querySelector(`[data-f="${name}"]`).value.trim();
        if (v.length < min) {
          const err = sheet.body.querySelector('[data-err]');
          err.textContent = `กรุณากรอก${label}อย่างน้อย ${min} ตัวอักษร`; err.hidden = false;
          sheet.body.querySelector(`[data-f="${name}"]`).focus();
          return;
        }
        out[name] = v;
      }
      finish(out); sheet.close();
    };
  });
}

function hasPoint(address) {
  return address?.latitude != null && address?.longitude != null
    && Number.isFinite(Number(address.latitude)) && Number(address.latitude) >= -90 && Number(address.latitude) <= 90
    && Number.isFinite(Number(address.longitude)) && Number(address.longitude) >= -180 && Number(address.longitude) <= 180;
}
