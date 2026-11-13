// แคชเชียร์ — bills waiting for payment, the cash drawer, and settlement.
// Settlement is all-or-nothing on the server (fufu_settle_invoice): payments, receipt number,
// FEFO stock deduction and the queue status commit together, or nothing is recorded.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { icon } from '../utils/icons.js';
import { openSheet } from './sheet.js';

const METHODS = [['cash', 'เงินสด'], ['transfer', 'โอนเงิน'], ['qr', 'QR พร้อมเพย์'], ['card', 'บัตร']];
const METHOD_LABEL = Object.fromEntries([...METHODS, ['split', 'แบ่งจ่าย']]);

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
const round2 = n => Math.round(Number(n || 0) * 100) / 100;
const baht = n => `฿${round2(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const timeOf = iso => (iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
const lineTotal = items => (Array.isArray(items) ? items : []).reduce((s, l) => s + Number(l.qty) * Number(l.unit_price), 0);

let _container = null;
let _storeId = '';
let _tab = 'pending';
let _session = null;

export async function renderCashier(container) {
  _container = container;
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  container.innerHTML = `
    <div class="space-y-4 sm:space-y-5">
      <div class="ph-head">
        <div><h1 class="ph-title">แคชเชียร์</h1><p class="ph-sub">รับชำระค่าบริการจากห้องตรวจ ผู้ป่วยใน และบริการอื่นๆ</p></div>
        <div id="cx-drawer-action"></div>
      </div>
      <div id="cx-drawer"><div class="skeleton ph-skel" style="height:64px"></div></div>
      <div class="cx-tabs" role="tablist">
        <button type="button" role="tab" data-tab="pending">รอชำระ <span id="cx-count-pending"></span></button>
        <button type="button" role="tab" data-tab="paid">ชำระแล้ว 24 ชม.</button>
      </div>
      <section class="ph-section" id="cx-list"><div class="ph-empty">กำลังโหลด…</div></section>
    </div>`;
  container.onclick = _onClick;
  await _load();
}

async function _load() {
  const [sessionRes, listRes] = await Promise.all([
    apiFetch(`/api/cashier/session?store_id=${encodeURIComponent(_storeId)}`),
    apiFetch(`/api/cashier/invoices?store_id=${encodeURIComponent(_storeId)}&status=${_tab}`),
  ]);
  if (sessionRes?.code === 'cashier_not_ready' || listRes?.code === 'cashier_not_ready') return _renderNotReady();
  _session = sessionRes?.success ? sessionRes.data : null;
  _renderDrawer();
  _renderList(listRes?.success ? listRes.data : null);
}

function _renderNotReady() {
  _container.querySelector('#cx-drawer-action').innerHTML = '';
  _container.querySelector('#cx-drawer').innerHTML = '';
  _container.querySelector('.cx-tabs').hidden = true;
  _container.querySelector('#cx-list').innerHTML = `
    <div class="ph-empty" style="border-top:0">
      <b class="ph-section__title" style="display:block;margin-bottom:6px">ระบบแคชเชียร์ยังไม่เปิดใช้งาน</b>
      ฐานข้อมูลนี้ยังไม่ได้ติดตั้งส่วนรับชำระเงิน กรุณาติดต่อผู้ดูแลระบบ FUFU
    </div>`;
}

function _renderDrawer() {
  const action = _container.querySelector('#cx-drawer-action');
  const box = _container.querySelector('#cx-drawer');
  if (!_session) {
    action.innerHTML = `<button type="button" class="ph-btn is-primary" data-open-drawer>${icon('coins', 'w-4 h-4')}เปิดกะเงินสด</button>`;
    box.innerHTML = `<div class="cx-drawer is-closed"><span class="ph-dot"></span><div><b>ลิ้นชักเงินสดยังปิดอยู่</b><small>เปิดกะก่อนจึงจะรับชำระได้ · ใส่เงินทอนตั้งต้นในลิ้นชัก</small></div></div>`;
    return;
  }
  const t = _session.totals || {};
  action.innerHTML = `<button type="button" class="ph-btn" data-close-drawer>ปิดกะ</button>`;
  box.innerHTML = `
    <div class="cx-drawer">
      <span class="ph-dot"></span>
      <div class="min-w-0"><b>ลิ้นชักเปิดอยู่ · ตั้งแต่ ${esc(timeOf(_session.opened_at))} น.</b><small>เงินทอนตั้งต้น ${baht(_session.opening_float)} · เงินสดในลิ้นชักควรมี ${baht(_session.expected_cash)}</small></div>
      <dl class="cx-drawer__sums">
        ${METHODS.map(([k, label]) => `<div><dt>${label}</dt><dd>${baht(t[k] || 0)}</dd></div>`).join('')}
      </dl>
    </div>`;
}

function _renderList(rows) {
  _container.querySelectorAll('[data-tab]').forEach(b => {
    b.classList.toggle('is-on', b.dataset.tab === _tab);
    b.setAttribute('aria-selected', String(b.dataset.tab === _tab));
  });
  const list = _container.querySelector('#cx-list');
  if (!rows) { list.innerHTML = '<div class="ph-empty" style="border-top:0">โหลดรายการไม่สำเร็จ ลองรีเฟรชอีกครั้ง</div>'; return; }
  if (_tab === 'pending') _container.querySelector('#cx-count-pending').textContent = rows.length ? `· ${rows.length}` : '';
  if (!rows.length) {
    list.innerHTML = `<div class="ph-empty" style="border-top:0">${_tab === 'pending' ? 'ไม่มีบิลรอชำระ' : 'ยังไม่มีรายการชำระใน 24 ชม.'}</div>`;
    return;
  }
  list.innerHTML = rows.map((inv, i) => {
    const items = Array.isArray(inv.line_items) ? inv.line_items : [];
    const summary = items.slice(0, 3).map(l => l.name).join(', ') + (items.length > 3 ? ` +${items.length - 3}` : '');
    const total = _tab === 'pending' ? lineTotal(items) : inv.total;
    return `
      <div class="ph-row cx-bill" style="${i === 0 ? 'border-top:0' : ''}">
        <div class="ph-row__main">
          <div class="ph-row__title">${esc(inv.pet_name || 'ลูกค้า')}${inv.owner_name ? ` · ${esc(inv.owner_name)}` : ''}</div>
          <div class="ph-row__meta">${_tab === 'paid' ? `${esc(inv.invoice_number || '')} · ${esc(METHOD_LABEL[inv.payment_method] || inv.payment_method || '')} · ` : `ส่งมา ${esc(timeOf(inv.created_at))} น. · `}${esc(summary)}</div>
        </div>
        <b class="cx-bill__total">${baht(total)}</b>
        <div class="cx-bill__actions">
          ${_tab === 'pending'
            ? `<button type="button" class="ph-btn" data-return="${inv.id}">แก้การรักษา</button><button type="button" class="ph-btn is-primary" data-pay="${inv.id}">รับชำระ</button>`
            : `<button type="button" class="ph-btn" data-print="${inv.id}">${icon('printer', 'w-4 h-4')}ใบเสร็จ</button><button type="button" class="ph-btn" data-print-a4="${inv.id}">A4 / PDF</button>`}
        </div>
      </div>`;
  }).join('');
  list._rows = rows;
}

function _row(id) { return (_container.querySelector('#cx-list')._rows || []).find(r => r.id === id); }

async function _onClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) { _tab = tab.dataset.tab; return _load(); }
  if (e.target.closest('[data-open-drawer]')) return _openDrawerSheet();
  if (e.target.closest('[data-close-drawer]')) return _closeDrawerSheet();
  const pay = e.target.closest('[data-pay]');
  if (pay) return _openSettle(_row(pay.dataset.pay));
  const print = e.target.closest('[data-print]');
  if (print) return printReceipt(_row(print.dataset.print), 'slip');
  const printA4 = e.target.closest('[data-print-a4]');
  if (printA4) return printReceipt(_row(printA4.dataset.printA4), 'a4');
  const ret = e.target.closest('[data-return]');
  if (ret) {
    const inv = _row(ret.dataset.return);
    if (!confirm(`ส่ง “${inv?.pet_name || 'บิลนี้'}” กลับไปแก้การรักษา?\nบิลนี้จะถูกยกเลิก และคิวกลับไปสถานะกำลังตรวจ`)) return;
    ret.disabled = true;
    const res = await apiFetch(`/api/cashier/invoices/${ret.dataset.return}/return`, { method: 'POST', body: '{}' });
    showToast(res?.success ? 'ส่งกลับไปห้องตรวจแล้ว' : (res?.error || 'ทำรายการไม่สำเร็จ'), res?.success ? 'success' : 'error');
    _load();
  }
}

function _openDrawerSheet() {
  const sheet = openSheet({ title: 'เปิดกะเงินสด', subtitle: 'นับเงินทอนที่ใส่ไว้ในลิ้นชักก่อนเริ่มรับชำระ' });
  sheet.body.innerHTML = `
    <label class="cx-field"><span>เงินทอนตั้งต้น (บาท)</span><input type="number" min="0" step="any" inputmode="decimal" value="0" data-float></label>`;
  sheet.foot.innerHTML = `<button type="button" class="ph-btn is-primary cx-go" data-go>เปิดกะ</button>`;
  sheet.foot.querySelector('[data-go]').onclick = async ev => {
    ev.currentTarget.disabled = true;
    const res = await apiFetch('/api/cashier/session/open', { method: 'POST', body: JSON.stringify({ store_id: _storeId, opening_float: Number(sheet.body.querySelector('[data-float]').value) || 0 }) });
    if (res?.success) { sheet.close(); showToast('เปิดกะแล้ว'); _load(); }
    else { ev.currentTarget.disabled = false; showToast(res?.error || 'เปิดกะไม่สำเร็จ', 'error'); }
  };
}

function _closeDrawerSheet() {
  const s = _session;
  const sheet = openSheet({ title: 'ปิดกะ', subtitle: `เปิดตั้งแต่ ${timeOf(s.opened_at)} น.` });
  sheet.body.innerHTML = `
    <dl class="cx-sum">
      <div><dt>เงินทอนตั้งต้น</dt><dd>${baht(s.opening_float)}</dd></div>
      <div><dt>รับเป็นเงินสด</dt><dd>${baht(s.totals?.cash || 0)}</dd></div>
      <div class="is-total"><dt>เงินสดในลิ้นชักควรมี</dt><dd>${baht(s.expected_cash)}</dd></div>
    </dl>
    <label class="cx-field"><span>เงินสดที่นับได้จริง (บาท)</span><input type="number" min="0" step="any" inputmode="decimal" data-counted></label>
    <p class="cx-diff" data-diff></p>
    <label class="cx-field"><span>หมายเหตุ (ถ้ามี)</span><input type="text" maxlength="300" data-note></label>`;
  sheet.foot.innerHTML = `<button type="button" class="ph-btn is-primary cx-go" data-go disabled>ปิดกะ</button>`;
  const counted = sheet.body.querySelector('[data-counted]');
  const go = sheet.foot.querySelector('[data-go]');
  counted.oninput = () => {
    const has = counted.value !== '';
    go.disabled = !has;
    const diff = round2(Number(counted.value) - Number(s.expected_cash));
    sheet.body.querySelector('[data-diff]').textContent = !has ? '' : diff === 0 ? 'ยอดตรง' : diff > 0 ? `เกิน ${baht(diff)}` : `ขาด ${baht(-diff)}`;
  };
  go.onclick = async () => {
    go.disabled = true;
    const res = await apiFetch(`/api/cashier/session/${s.id}/close`, { method: 'POST', body: JSON.stringify({ counted_cash: Number(counted.value), note: sheet.body.querySelector('[data-note]').value }) });
    if (res?.success) { sheet.close(); showToast('ปิดกะแล้ว'); _load(); }
    else { go.disabled = false; showToast(res?.error || 'ปิดกะไม่สำเร็จ', 'error'); }
  };
}

function _openSettle(inv) {
  if (!inv) return;
  if (!_session) { showToast('เปิดกะเงินสดก่อนรับชำระ', 'error'); return _openDrawerSheet(); }
  const items = Array.isArray(inv.line_items) ? inv.line_items : [];
  const subtotal = round2(lineTotal(items));
  let discount = 0;
  let vat = 0;
  let payments = [{ method: 'cash', amount: subtotal, reference: '' }];
  let received = '';

  const sheet = openSheet({ title: 'รับชำระ', subtitle: `${inv.pet_name || ''}${inv.owner_name ? ` · ${inv.owner_name}` : ''}` });
  const totals = () => {
    const d = Math.min(Math.max(round2(discount), 0), subtotal);
    const after = subtotal - d;
    const v = round2(after * vat / 100);
    return { d, v, total: round2(after + v) };
  };
  const paid = () => round2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));

  function render() {
    const { d, v, total } = totals();
    const remaining = round2(total - paid());
    const single = payments.length === 1;
    const change = single && payments[0].method === 'cash' && received !== '' ? round2(Number(received) - total) : null;
    sheet.body.innerHTML = `
      <div class="cx-items">${items.map(l => `<div><span>${esc(l.name)} <i>× ${esc(l.qty)}</i></span><b>${baht(Number(l.qty) * Number(l.unit_price))}</b></div>`).join('')}</div>
      <div class="cx-grid2">
        <label class="cx-field"><span>ส่วนลด (บาท)</span><input type="number" min="0" step="any" inputmode="decimal" value="${discount || ''}" placeholder="0" data-discount></label>
        <div class="cx-field"><span>VAT</span><div class="pm-seg" style="margin:0"><button type="button" class="${vat === 0 ? 'is-on' : ''}" data-vat="0">ไม่มี</button><button type="button" class="${vat === 7 ? 'is-on' : ''}" data-vat="7">7%</button></div></div>
      </div>
      <dl class="cx-sum">
        <div><dt>รวม</dt><dd>${baht(subtotal)}</dd></div>
        ${d ? `<div><dt>ส่วนลด</dt><dd>−${baht(d)}</dd></div>` : ''}
        ${vat ? `<div><dt>VAT 7%</dt><dd>${baht(v)}</dd></div>` : ''}
        <div class="is-total"><dt>ยอดสุทธิ</dt><dd>${baht(total)}</dd></div>
      </dl>
      <div class="cx-label">การชำระ</div>
      ${payments.map((p, i) => `
        <div class="cx-pay">
          <select data-method="${i}" aria-label="ช่องทางชำระ">${METHODS.map(([k, label]) => `<option value="${k}" ${p.method === k ? 'selected' : ''}>${label}</option>`).join('')}</select>
          <input type="number" min="0" step="any" inputmode="decimal" value="${p.amount}" data-amount="${i}" aria-label="จำนวนเงิน">
          ${p.method !== 'cash' ? `<input type="text" maxlength="120" value="${esc(p.reference)}" placeholder="เลขอ้างอิง" data-ref="${i}">` : ''}
          ${payments.length > 1 ? `<button type="button" class="icon-btn" data-drop="${i}" aria-label="ลบช่องทางนี้">${icon('times', 'w-4 h-4')}</button>` : ''}
        </div>`).join('')}
      <button type="button" class="ph-link cx-split" data-split>+ แบ่งจ่ายหลายช่องทาง</button>
      ${single && payments[0].method === 'cash' ? `
        <div class="cx-grid2">
          <label class="cx-field"><span>รับเงินมา</span><input type="number" min="0" step="any" inputmode="decimal" value="${esc(received)}" data-received></label>
          <div class="cx-field"><span>เงินทอน</span><b class="cx-change ${change !== null && change < 0 ? 'is-bad' : ''}">${change === null ? '—' : change < 0 ? `ขาด ${baht(-change)}` : baht(change)}</b></div>
        </div>` : ''}
      ${remaining !== 0 ? `<p class="cx-diff is-bad">${remaining > 0 ? `ยังขาด ${baht(remaining)}` : `เกิน ${baht(-remaining)}`}</p>` : ''}`;
    sheet.foot.innerHTML = `
      <div class="cx-total"><span>ยอดสุทธิ</span><b>${baht(total)}</b></div>
      <button type="button" class="ph-btn is-primary cx-go" data-confirm ${remaining === 0 && total >= 0 ? '' : 'disabled'}>ยืนยันรับชำระ</button>`;
  }

  // Keep focus/caret while re-rendering on input
  function rerenderKeepingFocus(target) {
    const key = [...target.attributes].find(a => a.name.startsWith('data-'))?.name;
    const val = key ? target.getAttribute(key) : null;
    const pos = target.selectionStart;
    render();
    const el = key ? sheet.body.querySelector(`[${key}="${val}"]`) || sheet.body.querySelector(`[${key}]`) : null;
    if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* number inputs */ } }
  }

  sheet.root.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-discount]')) {
      discount = Number(t.value) || 0;
      if (payments.length === 1) payments[0].amount = totals().total;
    } else if (t.dataset.amount) payments[t.dataset.amount].amount = t.value;
    else if (t.dataset.ref) { payments[t.dataset.ref].reference = t.value; return; }
    else if (t.matches('[data-received]')) received = t.value;
    else return;
    rerenderKeepingFocus(t);
  });
  sheet.root.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.method) { payments[t.dataset.method].method = t.value; render(); }
  });
  sheet.root.addEventListener('click', async e => {
    const vatBtn = e.target.closest('[data-vat]');
    if (vatBtn) { vat = Number(vatBtn.dataset.vat); if (payments.length === 1) payments[0].amount = totals().total; return render(); }
    if (e.target.closest('[data-split]')) {
      const rest = round2(totals().total - paid());
      payments.push({ method: 'transfer', amount: rest > 0 ? rest : 0, reference: '' });
      return render();
    }
    const drop = e.target.closest('[data-drop]');
    if (drop) { payments.splice(Number(drop.dataset.drop), 1); if (payments.length === 1) payments[0].amount = totals().total; return render(); }

    const go = e.target.closest('[data-confirm]');
    if (!go) return;
    go.disabled = true;
    go.textContent = 'กำลังบันทึก…';
    const res = await apiFetch(`/api/cashier/invoices/${inv.id}/settle`, {
      method: 'POST',
      body: JSON.stringify({
        discount: totals().d,
        vat_rate: vat,
        payments: payments.filter(p => Number(p.amount) > 0).map(p => ({ method: p.method, amount: round2(p.amount), reference: p.reference || null })),
      }),
    });
    if (res?.success) {
      _showSuccess(sheet, res.data, change());
      _load();
    } else {
      // Server rolled everything back: no payment, receipt number or stock change was saved
      go.disabled = false;
      go.textContent = 'ยืนยันรับชำระ';
      sheet.body.insertAdjacentHTML('afterbegin', `<div class="cx-fail" role="alert"><b>รับชำระไม่สำเร็จ</b>${esc(res?.error || 'ลองใหม่อีกครั้ง')}<small>ไม่มีการบันทึกเงิน เลขใบเสร็จ หรือการตัดสต็อก</small></div>`);
    }
  });

  function change() {
    if (payments.length !== 1 || payments[0].method !== 'cash' || received === '') return null;
    return round2(Number(received) - totals().total);
  }

  render();
}

function _showSuccess(sheet, inv, change) {
  sheet.body.innerHTML = `
    <div class="cx-done">
      <span class="cx-done__icon">${icon('check-circle', 'w-7 h-7')}</span>
      <b>รับชำระเรียบร้อย</b>
      <span>${esc(inv.invoice_number)} · ${baht(inv.total)}</span>
      ${change !== null && change > 0 ? `<span class="cx-done__change">ทอนเงิน ${baht(change)}</span>` : ''}
    </div>`;
  sheet.foot.innerHTML = `
    <button type="button" class="ph-btn" data-sh-close>เสร็จ</button>
    <button type="button" class="ph-btn" data-doc-a4>A4 / PDF</button>
    <button type="button" class="ph-btn is-primary cx-go" data-print-now>${icon('printer', 'w-4 h-4')}ใบเสร็จ</button>`;
  sheet.foot.querySelector('[data-print-now]').onclick = () => printReceipt(inv, 'slip');
  sheet.foot.querySelector('[data-doc-a4]').onclick = () => printReceipt(inv, 'a4');
}

/** Open the receipt / tax invoice document (print or save as PDF) in a new tab. */
export function printReceipt(inv, format = 'slip') {
  if (!inv?.id) return;
  const w = window.open(`/receipt.html?id=${encodeURIComponent(inv.id)}&format=${format === 'a4' ? 'a4' : 'slip'}`, '_blank');
  if (!w) showToast('กรุณาอนุญาต Pop-up เพื่อเปิดเอกสาร', 'error');
}
