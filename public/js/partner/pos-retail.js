// ขายหน้าร้าน · POS — iPad-first: products on the left, the cart pinned on the right.
// Phones get a floating cart bar that opens the cart as a sheet.
// Checkout prefers the cashier flow (one transaction: payment + receipt number + FEFO stock deduction);
// if that isn't installed on this database yet it falls back to /api/pos/checkout.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { icon } from '../utils/icons.js';

const CATEGORY_LABEL = { food: 'อาหาร', accessory: 'ของใช้', medicine: 'ยา', vaccine: 'วัคซีน', grooming: 'กรูมมิ่ง', service: 'บริการ', other: 'อื่นๆ' };
const METHODS = [['cash', 'เงินสด', 'money-bill-wave'], ['transfer', 'โอนเงิน', 'exchange-alt'], ['qr', 'QR', 'qrcode'], ['card', 'บัตร', 'credit-card']];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const r2 = n => Math.round(Number(n || 0) * 100) / 100;
const baht = n => `฿${r2(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

let S = null; // page state

export async function renderRetailPOS(container) {
  S = {
    container, storeId: storage.get(STORAGE_KEYS.STORE_ID),
    catalog: [], cat: 'all', query: '', cart: [], discount: 0, vat: 0, method: 'cash', received: '', busy: false, sheet: false,
  };
  container.innerHTML = `
    <div class="pr">
      <section class="pr-products" aria-label="สินค้าและบริการ">
        <div class="pr-toolbar">
          <label class="pr-search">${icon('search', 'w-4 h-4')}
            <input type="search" placeholder="ค้นหา หรือสแกนบาร์โค้ด" data-pr-search autocomplete="off" enterkeyhint="search">
          </label>
        </div>
        <div class="pr-cats" data-pr-cats></div>
        <div class="pr-grid" data-pr-grid><div class="pr-empty">กำลังโหลดสินค้า…</div></div>
      </section>
      <aside class="pr-cart" data-pr-cart aria-label="ตะกร้า"></aside>
      <button type="button" class="pr-cartbar" data-pr-open hidden></button>
      <div class="pr-scrim" data-pr-close hidden></div>
    </div>`;
  container.oninput = onInput;
  container.onclick = onClick;
  container.onkeydown = onKey;
  await loadCatalog();
  renderCart();
  setTimeout(() => container.querySelector('[data-pr-search]')?.focus({ preventScroll: true }), 50);
}

async function loadCatalog() {
  const [inv, svc] = await Promise.allSettled([
    apiFetch(`/api/inventory?store_id=${encodeURIComponent(S.storeId)}`),
    apiFetch(`/api/service-items?store_id=${encodeURIComponent(S.storeId)}`),
  ]);
  const rows = r => (r.status === 'fulfilled' && Array.isArray(r.value?.data) ? r.value.data : []);
  S.catalog = [
    ...rows(inv).map(p => ({ kind: 'product', id: p.id, name: p.name, price: Number(p.sell_price ?? p.price) || 0, stock: Number(p.stock ?? p.stock_qty ?? 0), cat: p.category || 'other', code: [p.sku, p.barcode].filter(Boolean).map(String), photo: p.photo_url || '' })),
    ...rows(svc).filter(s => s.is_active !== false).map(s => ({ kind: 'service', id: s.id, name: s.name, price: Number(s.price) || 0, stock: Infinity, cat: 'service', code: [], photo: '' })),
  ];
  renderCats(); renderGrid();
}

function visible() {
  const q = S.query.trim().toLocaleLowerCase('th');
  return S.catalog.filter(c => (S.cat === 'all' || c.cat === S.cat) && (!q || c.name.toLocaleLowerCase('th').includes(q) || c.code.some(x => x.toLowerCase() === q)));
}

function renderCats() {
  const cats = ['all', ...new Set(S.catalog.map(c => c.cat))];
  S.container.querySelector('[data-pr-cats]').innerHTML = cats.length > 2 ? cats.map(c =>
    `<button type="button" data-pr-cat="${esc(c)}" class="${S.cat === c ? 'is-on' : ''}">${c === 'all' ? 'ทั้งหมด' : esc(CATEGORY_LABEL[c] || c)}</button>`).join('') : '';
}

function renderGrid() {
  const list = visible();
  const inCart = id => S.cart.find(l => l.id === id)?.qty || 0;
  S.container.querySelector('[data-pr-grid]').innerHTML = list.length ? list.map(c => {
    const out = c.kind === 'product' && c.stock <= 0;
    const low = c.kind === 'product' && c.stock > 0 && c.stock <= 5;
    const qty = inCart(c.id);
    return `
      <button type="button" class="pr-item ${qty ? 'is-in' : ''}" data-pr-add="${c.kind}:${c.id}" ${out ? 'disabled' : ''}>
        <span class="pr-item__art">${c.photo ? `<img src="${esc(c.photo)}" alt="" loading="lazy">` : icon(c.kind === 'service' ? 'cut' : 'box', 'w-6 h-6')}</span>
        <span class="pr-item__name">${esc(c.name)}</span>
        <span class="pr-item__foot"><b>${baht(c.price)}</b>${c.kind === 'service' ? '<i>บริการ</i>' : out ? '<i class="is-out">หมด</i>' : `<i class="${low ? 'is-low' : ''}">เหลือ ${c.stock}</i>`}</span>
        ${qty ? `<span class="pr-item__qty">${qty}</span>` : ''}
      </button>`;
  }).join('') : `<div class="pr-empty">${S.catalog.length ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้า · เพิ่มได้ที่หน้าคลังสินค้า'}</div>`;
}

const totals = () => {
  const sub = r2(S.cart.reduce((s, l) => s + l.qty * l.price, 0));
  const disc = Math.min(Math.max(r2(S.discount), 0), sub);
  const vat = r2((sub - disc) * S.vat / 100);
  return { sub, disc, vat, total: r2(sub - disc + vat), count: S.cart.reduce((s, l) => s + l.qty, 0) };
};

function renderCart() {
  const t = totals();
  const change = S.method === 'cash' && S.received !== '' ? r2(Number(S.received) - t.total) : null;
  const quick = [...new Set([t.total, Math.ceil(t.total / 100) * 100, Math.ceil(t.total / 500) * 500, Math.ceil(t.total / 1000) * 1000])].filter(v => v > 0).slice(0, 4);
  const cart = S.container.querySelector('[data-pr-cart]');
  cart.classList.toggle('is-open', S.sheet);
  cart.innerHTML = `
    <div class="pr-cart__head">
      <b>ตะกร้า</b><span>${t.count} ชิ้น</span>
      ${S.cart.length ? '<button type="button" class="pr-link" data-pr-clear>ล้าง</button>' : ''}
      <button type="button" class="icon-btn pr-cart__x" data-pr-close aria-label="ปิดตะกร้า">${icon('times', 'w-5 h-5')}</button>
    </div>
    <div class="pr-lines">
      ${S.cart.length ? S.cart.map((l, i) => `
        <div class="pr-line">
          <div class="pr-line__main"><span>${esc(l.name)}</span><small>${baht(l.price)}</small></div>
          <div class="pr-step" role="group" aria-label="จำนวน ${esc(l.name)}">
            <button type="button" data-pr-dec="${i}" aria-label="ลด">−</button><b>${l.qty}</b><button type="button" data-pr-inc="${i}" aria-label="เพิ่ม">+</button>
          </div>
          <b class="pr-line__sum">${baht(l.qty * l.price)}</b>
        </div>`).join('') : '<div class="pr-empty is-cart">แตะสินค้าเพื่อเพิ่มลงตะกร้า</div>'}
    </div>
    <div class="pr-cart__foot">
      <div class="pr-adjust">
        <label>ส่วนลด<input type="number" min="0" step="any" inputmode="decimal" value="${S.discount || ''}" placeholder="0" data-pr-discount></label>
        <div class="pr-seg"><button type="button" data-pr-vat="0" class="${S.vat === 0 ? 'is-on' : ''}">ไม่มี VAT</button><button type="button" data-pr-vat="7" class="${S.vat === 7 ? 'is-on' : ''}">VAT 7%</button></div>
      </div>
      <dl class="pr-sum">
        <div><dt>รวม</dt><dd>${baht(t.sub)}</dd></div>
        ${t.disc ? `<div><dt>ส่วนลด</dt><dd>−${baht(t.disc)}</dd></div>` : ''}
        ${S.vat ? `<div><dt>VAT 7%</dt><dd>${baht(t.vat)}</dd></div>` : ''}
        <div class="is-total"><dt>ยอดชำระ</dt><dd>${baht(t.total)}</dd></div>
      </dl>
      <div class="pr-methods">${METHODS.map(([k, label, ic]) => `<button type="button" data-pr-method="${k}" class="${S.method === k ? 'is-on' : ''}">${icon(ic, 'w-4 h-4')}${label}</button>`).join('')}</div>
      ${S.method === 'cash' && t.total > 0 ? `
        <div class="pr-cash">
          <div class="pr-quick">${quick.map(v => `<button type="button" data-pr-received="${v}">${v === t.total ? 'พอดี' : baht(v)}</button>`).join('')}</div>
          <label>รับเงิน<input type="number" min="0" step="any" inputmode="decimal" value="${S.received}" data-pr-cash placeholder="0"></label>
          <p class="pr-change ${change !== null && change < 0 ? 'is-bad' : ''}">${change === null ? '' : change < 0 ? `ขาด ${baht(-change)}` : `เงินทอน ${baht(change)}`}</p>
        </div>` : ''}
      <button type="button" class="pr-pay" data-pr-pay ${!S.cart.length || S.busy || (change !== null && change < 0) ? 'disabled' : ''}>${S.busy ? 'กำลังบันทึก…' : `ชำระเงิน ${baht(t.total)}`}</button>
    </div>`;
  const bar = S.container.querySelector('[data-pr-open]');
  bar.hidden = !S.cart.length;
  bar.innerHTML = `${icon('receipt', 'w-5 h-5')}<span>${t.count} ชิ้น</span><b>${baht(t.total)}</b>${icon('chevron-right', 'w-4 h-4')}`;
  S.container.querySelector('[data-pr-close].pr-scrim').hidden = !S.sheet;
}

function add(kind, id) {
  const item = S.catalog.find(c => c.kind === kind && c.id === id);
  if (!item) return;
  const line = S.cart.find(l => l.id === id);
  if (kind === 'product' && (line?.qty || 0) >= item.stock) { showToast(`${item.name} เหลือ ${item.stock} ชิ้น`, 'error'); return; }
  if (line) line.qty += 1; else S.cart.push({ kind, id, name: item.name, price: item.price, qty: 1 });
  navigator.vibrate?.(8);
  renderGrid(); renderCart();
}

function onKey(e) {
  // Barcode scanners type the code and press Enter
  if (e.key !== 'Enter' || !e.target.matches('[data-pr-search]')) return;
  const code = e.target.value.trim();
  if (!code) return;
  const hit = S.catalog.find(c => c.code.some(x => x.toLowerCase() === code.toLowerCase())) || (visible().length === 1 ? visible()[0] : null);
  if (hit) { add(hit.kind, hit.id); e.target.value = ''; S.query = ''; renderGrid(); }
  else showToast(`ไม่พบสินค้า “${code}”`, 'error');
}

function onInput(e) {
  const t = e.target;
  if (t.matches('[data-pr-search]')) { S.query = t.value; renderGrid(); return; }
  if (t.matches('[data-pr-discount]')) S.discount = Number(t.value) || 0;
  else if (t.matches('[data-pr-cash]')) S.received = t.value;
  else return;
  const key = t.matches('[data-pr-discount]') ? '[data-pr-discount]' : '[data-pr-cash]';
  const pos = t.selectionStart;
  renderCart();
  const el = S.container.querySelector(key);
  if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* number input */ } }
}

async function onClick(e) {
  const q = s => e.target.closest(s);
  let b;
  if ((b = q('[data-pr-add]'))) { const [k, id] = b.dataset.prAdd.split(':'); return add(k, id); }
  if ((b = q('[data-pr-cat]'))) { S.cat = b.dataset.prCat; renderCats(); return renderGrid(); }
  if ((b = q('[data-pr-inc]'))) { const l = S.cart[b.dataset.prInc]; return add(l.kind, l.id); }
  if ((b = q('[data-pr-dec]'))) { const i = Number(b.dataset.prDec); S.cart[i].qty -= 1; if (S.cart[i].qty <= 0) S.cart.splice(i, 1); renderGrid(); return renderCart(); }
  if (q('[data-pr-clear]')) { S.cart = []; S.discount = 0; S.received = ''; renderGrid(); return renderCart(); }
  if ((b = q('[data-pr-vat]'))) { S.vat = Number(b.dataset.prVat); return renderCart(); }
  if ((b = q('[data-pr-method]'))) { S.method = b.dataset.prMethod; S.received = ''; return renderCart(); }
  if ((b = q('[data-pr-received]'))) { S.received = b.dataset.prReceived; return renderCart(); }
  if (q('[data-pr-open]')) { S.sheet = true; return renderCart(); }
  if (q('[data-pr-close]')) { S.sheet = false; return renderCart(); }
  if (q('[data-pr-pay]')) return pay();
}

async function pay() {
  if (!S.cart.length || S.busy) return;
  const t = totals();
  S.busy = true; renderCart();
  const lines = S.cart.map(l => ({ name: l.name, qty: l.qty, unit_price: l.price, ...(l.kind === 'product' ? { product_id: l.id } : { service_item_id: l.id }) }));
  const method = S.method;
  let result = null;
  let error = null;

  // 1) Cashier flow: atomic payment + receipt number + FEFO stock deduction.
  //    Check the drawer first so a closed drawer never leaves a half-made bill behind.
  const drawer = await apiFetch(`/api/cashier/session?store_id=${encodeURIComponent(S.storeId)}`);
  if (drawer?.success && !drawer.data) {
    S.busy = false; renderCart();
    showToast('ยังไม่ได้เปิดกะเงินสด · เปิดกะที่หน้าแคชเชียร์ก่อนขาย', 'error');
    return;
  }
  const open = await apiFetch('/api/cashier/invoices', { method: 'POST', body: JSON.stringify({ store_id: S.storeId, line_items: lines, pet_name: null, owner_name: 'ลูกค้าหน้าร้าน' }) });
  if (open?.success) {
    const settle = await apiFetch(`/api/cashier/invoices/${open.data.id}/settle`, { method: 'POST', body: JSON.stringify({ discount: t.disc, vat_rate: S.vat, payments: [{ method, amount: t.total }] }) });
    if (settle?.success) result = settle.data;
    else {
      error = settle?.code === 'drawer_closed' ? 'ยังไม่ได้เปิดกะเงินสด · เปิดกะที่หน้าแคชเชียร์ก่อน' : (settle?.error || 'ชำระเงินไม่สำเร็จ');
      // Nothing was charged: cancel the bill we just opened so it doesn't wait at the cashier
      await apiFetch(`/api/cashier/invoices/${open.data.id}/return`, { method: 'POST', body: '{}' });
    }
  } else if (open?.code === 'cashier_not_ready') {
    // 2) Older databases: legacy POS checkout
    const res = await apiFetch('/api/pos/checkout', { method: 'POST', body: JSON.stringify({ store_id: S.storeId, line_items: lines, discount: t.disc, vat_rate: S.vat, payment_method: method === 'qr' ? 'promptpay' : method, owner_name: 'ลูกค้าหน้าร้าน' }) });
    if (res?.success) result = { ...res.data.invoice, invoice_number: res.data.invoice_number, total: res.data.total };
    else error = res?.error || 'ชำระเงินไม่สำเร็จ';
  } else {
    error = open?.error || 'ชำระเงินไม่สำเร็จ';
  }

  S.busy = false;
  if (!result) { renderCart(); showToast(`${error} · ยังไม่มีการบันทึก`, 'error'); return; }
  const change = method === 'cash' && S.received !== '' ? r2(Number(S.received) - t.total) : 0;
  S.cart = []; S.discount = 0; S.received = ''; S.sheet = false;
  renderGrid(); renderCart();
  showDone(result, change);
  loadCatalog(); // stock may have changed
}

function showDone(inv, change) {
  const wrap = document.createElement('div');
  wrap.className = 'pr-done';
  wrap.innerHTML = `
    <div class="pr-done__card" role="dialog" aria-modal="true">
      <span class="pr-done__ic">${icon('check-circle', 'w-8 h-8')}</span>
      <b>ชำระเงินเรียบร้อย</b>
      <span>${esc(inv.invoice_number || '')} · ${baht(inv.total)}</span>
      ${change > 0 ? `<strong>ทอนเงิน ${baht(change)}</strong>` : ''}
      <div class="pr-done__actions">
        ${inv.id ? `<button type="button" data-print="slip">${icon('printer', 'w-4 h-4')}ใบเสร็จ</button>` : ''}
        <button type="button" data-next class="is-primary">ขายรายการต่อไป</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); S.container.querySelector('[data-pr-search]')?.focus(); };
  wrap.onclick = e => {
    if (e.target === wrap || e.target.closest('[data-next]')) return close();
    if (e.target.closest('[data-print]')) window.open(`/receipt?id=${encodeURIComponent(inv.id)}&format=slip`, '_blank');
  };
  wrap.querySelector('[data-next]').focus();
}
