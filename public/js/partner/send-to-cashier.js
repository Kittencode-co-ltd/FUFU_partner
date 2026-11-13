// "ส่งชำระเงิน" — confirm what to charge, then hand the bill to the cashier.
// Used from the queue board and the OPD room. The queue moves to cashier_waiting on the server.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { icon } from '../utils/icons.js';
import { openSheet } from './sheet.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
const baht = value => `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

let _catalog = null; // { services: [], products: [] }

async function _loadCatalog(storeId) {
  if (_catalog) return _catalog;
  const [services, products] = await Promise.allSettled([
    apiFetch(`/api/service-items?store_id=${encodeURIComponent(storeId)}`),
    apiFetch(`/api/inventory?store_id=${encodeURIComponent(storeId)}`),
  ]);
  const rows = r => (r.status === 'fulfilled' && Array.isArray(r.value?.data) ? r.value.data : []);
  _catalog = {
    services: rows(services).filter(s => s.is_active !== false).map(s => ({ kind: 'service', id: s.id, name: s.name, price: Number(s.price) || 0 })),
    products: rows(products).filter(p => p.is_active !== false).map(p => ({ kind: 'product', id: p.id, name: p.name, price: Number(p.sell_price ?? p.price) || 0, stock: p.stock_qty })),
  };
  return _catalog;
}

/**
 * @param {object} opts
 * @param {object} opts.queueItem   queue entry ({ id, notes "pet - owner", pet_name, owner_name })
 * @param {Array}  [opts.lines]     prefilled lines [{ name, qty, unit_price, product_id? }]
 * @param {string} [opts.medicalRecordId]
 * @param {Function} [opts.onDone]  called after the bill reaches the cashier
 */
export async function openSendToCashier({ queueItem, lines = [], medicalRecordId = null, onDone } = {}) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const [notePet, noteOwner] = String(queueItem?.notes || '').includes(' - ')
    ? String(queueItem.notes).split(' - ').map(s => s.trim()) : [queueItem?.notes || '', ''];
  const petName = queueItem?.pet_name || notePet || 'สัตว์เลี้ยง';
  const ownerName = queueItem?.owner_name || noteOwner || '';
  let items = lines.map(l => ({ name: l.name, qty: Number(l.qty) || 1, unit_price: Number(l.unit_price) || 0, product_id: l.product_id || null, service_item_id: l.service_item_id || null }));
  let query = '';

  const sheet = openSheet({ title: 'ส่งชำระเงิน', subtitle: `${petName}${ownerName ? ` · ${ownerName}` : ''}` });
  const catalog = await _loadCatalog(storeId);

  const total = () => items.reduce((sum, l) => sum + l.qty * l.unit_price, 0);
  const matches = () => {
    const q = query.trim().toLocaleLowerCase('th');
    const all = [...catalog.services, ...catalog.products];
    return (q ? all.filter(c => c.name.toLocaleLowerCase('th').includes(q)) : catalog.services).slice(0, 8);
  };

  function render() {
    sheet.body.innerHTML = `
      <div class="cx-lines">
        ${items.length ? items.map((l, i) => `
          <div class="cx-line">
            <div class="cx-line__main">
              <div class="cx-line__name">${esc(l.name)}</div>
              <div class="cx-line__meta">${l.product_id ? 'สินค้า · ตัดสต็อกตอนรับชำระ' : 'ค่าบริการ'}</div>
            </div>
            <label class="cx-num"><span class="sr-only">จำนวน</span><input type="number" min="1" step="${l.product_id ? 1 : 'any'}" value="${l.qty}" data-qty="${i}" inputmode="decimal"></label>
            <label class="cx-num cx-num--price"><span class="sr-only">ราคา</span><input type="number" min="0" step="any" value="${l.unit_price}" data-price="${i}" inputmode="decimal"></label>
            <button type="button" class="icon-btn" data-remove="${i}" aria-label="ลบ ${esc(l.name)}">${icon('times', 'w-4 h-4')}</button>
          </div>`).join('') : '<div class="cx-empty">ยังไม่มีรายการ · ค้นหาค่าบริการหรือสินค้าด้านล่าง</div>'}
      </div>
      <div class="cx-add">
        <input type="search" class="cx-search" placeholder="ค้นหาค่าบริการ / ยา / สินค้า" value="${esc(query)}" data-search>
        <div class="cx-suggest">
          ${matches().map(c => `<button type="button" class="cx-chip" data-add="${c.kind}:${c.id}">${esc(c.name)} <b>${baht(c.price)}</b></button>`).join('')}
          ${query.trim() ? `<button type="button" class="cx-chip is-custom" data-add-custom>+ เพิ่ม “${esc(query.trim())}”</button>` : ''}
        </div>
      </div>`;
    sheet.foot.innerHTML = `
      <div class="cx-total"><span>ยอดรวม</span><b>${baht(total())}</b></div>
      <button type="button" class="ph-btn is-primary cx-go" data-submit ${items.length ? '' : 'disabled'}>ส่งไปแคชเชียร์</button>`;
  }

  sheet.root.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-search]')) {
      query = t.value;
      const pos = t.selectionStart;
      render();
      const s = sheet.body.querySelector('[data-search]'); s.focus(); s.setSelectionRange(pos, pos);
      return;
    }
    if (t.dataset.qty) items[t.dataset.qty].qty = Math.max(0, Number(t.value) || 0);
    if (t.dataset.price) items[t.dataset.price].unit_price = Math.max(0, Number(t.value) || 0);
    sheet.foot.querySelector('.cx-total b').textContent = baht(total());
  });

  sheet.root.addEventListener('click', async e => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const [kind, id] = add.dataset.add.split(':');
      const item = [...catalog.services, ...catalog.products].find(c => c.kind === kind && c.id === id);
      const existing = items.find(l => (kind === 'product' ? l.product_id : l.service_item_id) === id);
      if (existing) existing.qty += 1;
      else items.push({ name: item.name, qty: 1, unit_price: item.price, product_id: kind === 'product' ? id : null, service_item_id: kind === 'service' ? id : null });
      query = '';
      return render();
    }
    if (e.target.closest('[data-add-custom]')) {
      items.push({ name: query.trim(), qty: 1, unit_price: 0, product_id: null, service_item_id: null });
      query = '';
      render();
      sheet.body.querySelector(`[data-price="${items.length - 1}"]`)?.focus();
      return;
    }
    const remove = e.target.closest('[data-remove]');
    if (remove) { items.splice(Number(remove.dataset.remove), 1); return render(); }

    const submit = e.target.closest('[data-submit]');
    if (!submit) return;
    const bad = items.find(l => !(l.qty > 0) || (l.product_id && !Number.isInteger(l.qty)));
    if (bad) return showToast(`ตรวจจำนวนของ “${bad.name}” · สินค้านับเป็นจำนวนเต็ม`, 'error');
    submit.disabled = true;
    submit.textContent = 'กำลังส่ง…';
    const res = await apiFetch('/api/cashier/invoices', {
      method: 'POST',
      body: JSON.stringify({
        store_id: storeId,
        queue_entry_id: queueItem?.id || null,
        medical_record_id: medicalRecordId,
        pet_name: petName,
        owner_name: ownerName,
        line_items: items.map(l => ({ name: l.name, qty: l.qty, unit_price: l.unit_price, ...(l.product_id ? { product_id: l.product_id } : {}), ...(l.service_item_id ? { service_item_id: l.service_item_id } : {}) })),
      }),
    });
    if (res?.success) {
      sheet.close();
      showToast('ส่งไปแคชเชียร์แล้ว · คิวนี้รอชำระเงิน');
      onDone?.(res.data);
    } else {
      submit.disabled = false;
      submit.textContent = 'ส่งไปแคชเชียร์';
      showToast(res?.error || 'ส่งไม่สำเร็จ', 'error');
    }
  });

  render();
}
