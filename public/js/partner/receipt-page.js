// Receipt / tax invoice document — /receipt.html?id=<invoice id>&format=slip|a4
//
// Document type follows the Thai Revenue Code:
//   • Seller not VAT-registered (no tax ID, or no VAT on the bill) → ใบเสร็จรับเงิน
//   • VAT bill, slip                        → ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน (s.86/6)
//   • VAT bill, A4 with buyer details       → ใบเสร็จรับเงิน / ใบกำกับภาษี (full tax invoice, s.86/4)
// Each print is counted on the server: the first is the ORIGINAL (ต้นฉบับ), later ones are COPY (สำเนา).
// "Save PDF" uses the browser's print-to-PDF, which keeps Thai text sharp and selectable.
import { apiFetch } from '../utils/api-client.js';
import { thaiBahtText } from '../utils/thai-baht.js';

const params = new URLSearchParams(location.search);
const invoiceId = params.get('id') || '';
let format = params.get('format') === 'a4' ? 'a4' : 'slip';
let fullTax = false;
let data = null;        // { invoice, payments, store }
let printNo = null;     // number assigned to the copy being printed

const METHOD = { cash: 'เงินสด', transfer: 'โอนเงิน', qr: 'QR พร้อมเพย์', card: 'บัตร', promptpay: 'พร้อมเพย์', split: 'แบ่งจ่าย' };
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
const num = v => Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $ = s => document.querySelector(s);

function msg(text, bad = false) {
  const el = $('#rc-msg');
  el.hidden = !text;
  el.textContent = text || '';
  el.classList.toggle('is-bad', bad);
}

const isVatBill = () => Boolean(data?.store?.tax_id) && Number(data?.invoice?.vat_rate) > 0;

function docTitle() {
  if (!isVatBill()) return { th: 'ใบเสร็จรับเงิน', en: 'RECEIPT' };
  if (format === 'a4' && fullTax) return { th: 'ใบเสร็จรับเงิน / ใบกำกับภาษี', en: 'RECEIPT / TAX INVOICE' };
  return { th: 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน', en: 'ABBREVIATED TAX INVOICE / RECEIPT' };
}

function copyLabel() {
  const count = printNo ?? Number(data.invoice.print_count || 0) + 1; // preview shows what the next print will be
  return count <= 1 ? 'ต้นฉบับ' : `สำเนา${count > 2 ? ` (พิมพ์ครั้งที่ ${count})` : ''}`;
}

function totals(inv) {
  const subtotal = Number(inv.subtotal ?? (inv.line_items || []).reduce((s, l) => s + l.qty * l.unit_price, 0));
  const discount = Number(inv.discount || 0);
  const beforeVat = subtotal - discount;
  const vat = Number(inv.vat_amount || 0);
  return { subtotal, discount, beforeVat, vat, total: Number(inv.total ?? beforeVat + vat) };
}

function render() {
  const { invoice: inv, payments, store } = data;
  const t = totals(inv);
  const title = docTitle();
  const when = new Date(inv.paid_at || inv.created_at);
  const date = when.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = when.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
  const items = Array.isArray(inv.line_items) ? inv.line_items : [];
  const vatBill = isVatBill();
  const showBuyer = format === 'a4' && fullTax;
  const pays = payments.length ? payments : [{ method: inv.payment_method, amount: t.total }];
  const voided = inv.status === 'void';

  document.body.dataset.format = format;
  document.title = `${inv.invoice_number || 'ใบเสร็จ'}${(printNo ?? Number(inv.print_count || 0) + 1) > 1 ? ' (สำเนา)' : ''}`;
  $('#page-size')?.remove();
  document.head.insertAdjacentHTML('beforeend', `<style id="page-size">@page { size: ${format === 'a4' ? 'A4' : '80mm auto'}; margin: ${format === 'a4' ? '14mm' : '3mm'}; }</style>`);

  $('#rc-doc').innerHTML = `
    <article class="rc-paper ${voided ? 'is-void' : ''}">
      <div class="rc-copy">${esc(copyLabel())}</div>
      <header class="rc-head">
        ${store?.logo_url && format === 'a4' ? `<img class="rc-logo" src="${esc(store.logo_url)}" alt="">` : ''}
        <div class="rc-seller">
          <h1>${esc(store?.name || 'ร้านค้า')}</h1>
          ${store?.address ? `<p>${esc(store.address)}</p>` : ''}
          ${store?.phone ? `<p>โทร ${esc(store.phone)}</p>` : ''}
          ${store?.tax_id ? `<p>เลขประจำตัวผู้เสียภาษี ${esc(store.tax_id)}${vatBill ? ` · ${esc(store.branch_name || 'สำนักงานใหญ่')}` : ''}</p>` : ''}
        </div>
        <div class="rc-title">
          <h2>${esc(title.th)}</h2>
          <p>${esc(title.en)}</p>
        </div>
      </header>

      <dl class="rc-meta">
        <div><dt>เลขที่</dt><dd>${esc(inv.invoice_number || '—')}</dd></div>
        <div><dt>วันที่</dt><dd>${esc(date)} ${esc(time)} น.</dd></div>
        ${showBuyer ? '' : `<div><dt>ลูกค้า</dt><dd>${esc([inv.owner_name, inv.pet_name].filter(Boolean).join(' · ') || 'ลูกค้าทั่วไป')}</dd></div>`}
      </dl>

      ${showBuyer ? `
        <section class="rc-buyer-box">
          <b>ผู้ซื้อ</b>
          <p>${esc(inv.buyer_name || '—')}</p>
          ${inv.buyer_address ? `<p>${esc(inv.buyer_address)}</p>` : ''}
          <p>เลขประจำตัวผู้เสียภาษี ${esc(inv.buyer_tax_id || '—')} · ${esc(inv.buyer_branch || 'สำนักงานใหญ่')}</p>
          ${inv.pet_name ? `<p class="rc-muted">สัตว์เลี้ยง: ${esc(inv.pet_name)}</p>` : ''}
        </section>` : ''}

      <table class="rc-items">
        <thead><tr>${format === 'a4' ? '<th class="n">#</th>' : ''}<th>รายการ</th><th class="r">จำนวน</th>${format === 'a4' ? '<th class="r">ราคา/หน่วย</th>' : ''}<th class="r">จำนวนเงิน</th></tr></thead>
        <tbody>
          ${items.map((l, i) => `<tr>${format === 'a4' ? `<td class="n">${i + 1}</td>` : ''}<td>${esc(l.name)}${format === 'slip' && Number(l.qty) !== 1 ? `<small>@ ${num(l.unit_price)}</small>` : ''}</td><td class="r">${esc(l.qty)}</td>${format === 'a4' ? `<td class="r">${num(l.unit_price)}</td>` : ''}<td class="r">${num(Number(l.qty) * Number(l.unit_price))}</td></tr>`).join('')}
        </tbody>
      </table>

      <dl class="rc-sum">
        <div><dt>รวมเป็นเงิน</dt><dd>${num(t.subtotal)}</dd></div>
        ${t.discount ? `<div><dt>ส่วนลด</dt><dd>−${num(t.discount)}</dd></div>` : ''}
        ${vatBill ? `<div><dt>มูลค่าสินค้า/บริการก่อนภาษี</dt><dd>${num(t.beforeVat)}</dd></div><div><dt>ภาษีมูลค่าเพิ่ม ${esc(inv.vat_rate)}%</dt><dd>${num(t.vat)}</dd></div>` : ''}
        <div class="is-total"><dt>รวมทั้งสิ้น</dt><dd>${num(t.total)}</dd></div>
      </dl>
      <p class="rc-words">(${esc(thaiBahtText(t.total))})</p>
      ${vatBill && !showBuyer ? '<p class="rc-muted rc-center">ราคารวมภาษีมูลค่าเพิ่มแล้ว</p>' : ''}

      <section class="rc-pay">
        <b>การชำระเงิน</b>
        ${pays.map(p => `<div><span>${esc(METHOD[p.method] || p.method || '')}${p.reference ? ` · อ้างอิง ${esc(p.reference)}` : ''}</span><span>${num(p.amount)}</span></div>`).join('')}
      </section>

      ${format === 'a4' ? `
        <div class="rc-sign">
          <div><span></span>ผู้รับเงิน</div>
          <div><span></span>ผู้ชำระเงิน</div>
        </div>` : ''}

      <footer class="rc-foot">
        ${store?.receipt_header_note ? `<p>${esc(store.receipt_header_note)}</p>` : '<p>ขอบคุณที่ใช้บริการ</p>'}
        <p class="rc-muted">ออกโดยระบบ FUFU Partner</p>
      </footer>
      ${voided ? '<div class="rc-void" aria-hidden="true">ยกเลิก</div>' : ''}
    </article>`;

  // Toolbar state
  document.querySelectorAll('button[data-format]').forEach(b => {
    b.classList.toggle('is-on', b.dataset.format === format);
    b.setAttribute('aria-pressed', String(b.dataset.format === format));
  });
  $('#rc-full-wrap').hidden = !(vatBill && format === 'a4');
  $('#rc-full').checked = fullTax;
  $('#rc-full').disabled = Boolean(inv.full_tax_invoice_at); // already issued → stays a full tax invoice
  const buyerForm = $('#rc-buyer');
  buyerForm.hidden = !(showBuyer && !inv.full_tax_invoice_at);
  if (!buyerForm.hidden && !buyerForm.dataset.filled) {
    buyerForm.dataset.filled = '1';
    buyerForm.name.value = inv.buyer_name || inv.owner_name || '';
    buyerForm.address.value = inv.buyer_address || '';
    buyerForm.tax_id.value = inv.buyer_tax_id || '';
    buyerForm.branch.value = inv.buyer_branch || '';
  }
}

async function load() {
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) { $('#rc-doc').innerHTML = '<p class="rc-loading">ไม่พบเอกสาร</p>'; return; }
  const res = await apiFetch(`/api/cashier/invoices/${invoiceId}`);
  if (!res?.success) { $('#rc-doc').innerHTML = `<p class="rc-loading">${esc(res?.error || 'โหลดเอกสารไม่สำเร็จ')}</p>`; return; }
  data = res.data;
  if (data.invoice.status !== 'paid' && data.invoice.status !== 'void') {
    $('#rc-doc').innerHTML = '<p class="rc-loading">บิลนี้ยังไม่ได้รับชำระ จึงยังออกใบเสร็จไม่ได้</p>';
    $('#rc-bar').hidden = true;
    return;
  }
  fullTax = Boolean(data.invoice.full_tax_invoice_at);
  if (fullTax) format = 'a4';
  render();
}

async function printDoc(asPdf) {
  if (!data) return;
  if (format === 'a4' && fullTax && !data.invoice.buyer_name) { msg('กรอกและบันทึกข้อมูลผู้ซื้อก่อนออกใบกำกับภาษีเต็มรูป', true); return; }
  const buttons = document.querySelectorAll('[data-action]');
  buttons.forEach(b => { b.disabled = true; });
  // Count the print first, so the paper says ORIGINAL or COPY correctly. No count → no print.
  const res = await apiFetch(`/api/cashier/invoices/${invoiceId}/print`, {
    method: 'POST', body: JSON.stringify({ full_tax_invoice: format === 'a4' && fullTax }),
  });
  buttons.forEach(b => { b.disabled = false; });
  if (!res?.success) { msg(res?.error || 'บันทึกการพิมพ์ไม่สำเร็จ จึงยังไม่พิมพ์เอกสาร', true); return; }
  printNo = res.data.print_no;
  data.invoice.print_count = printNo;
  if (format === 'a4' && fullTax) data.invoice.full_tax_invoice_at ||= new Date().toISOString();
  render();
  msg(asPdf ? 'ในหน้าต่างพิมพ์ เลือกปลายทาง “บันทึกเป็น PDF” (Save as PDF) · ชื่อไฟล์คือเลขที่เอกสาร' : '');
  setTimeout(() => {
    window.print();
    printNo = null; // the on-screen preview goes back to showing the next print's label
    render();
  }, 60);
}

document.addEventListener('click', e => {
  const f = e.target.closest('button[data-format]'); // body also carries data-format (print styles)
  if (f) { format = f.dataset.format; msg(''); render(); return; }
  const a = e.target.closest('[data-action]');
  if (a) printDoc(a.dataset.action === 'pdf');
});

$('#rc-full').addEventListener('change', e => { fullTax = e.target.checked; msg(''); render(); });

$('#rc-buyer').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const body = Object.fromEntries(new FormData(form));
  if (body.tax_id && !/^\d{13}$/.test(body.tax_id)) { msg('เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก', true); return; }
  const res = await apiFetch(`/api/cashier/invoices/${invoiceId}/buyer`, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res?.success) { msg(res?.error || 'บันทึกข้อมูลผู้ซื้อไม่สำเร็จ', true); return; }
  Object.assign(data.invoice, res.data);
  msg('บันทึกข้อมูลผู้ซื้อแล้ว');
  render();
});

load();
