// "รายงานธุรกิจ" page (owner / accountant): sales, visits, top services and returning customers for a date range,
// compared with the period just before. API: server/routes/reports.js. Styles: .rp-* in src/css/input.css.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { icon } from '../utils/icons.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const baht = n => `฿${Math.round(Number(n) || 0).toLocaleString('th-TH')}`;
const int = n => Math.round(Number(n) || 0).toLocaleString('th-TH');
const short = k => new Date(`${k}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
const PM = { cash: 'เงินสด', promptpay: 'PromptPay', qr: 'QR', card: 'บัตร', transfer: 'โอน', voucher: 'Voucher', online: 'ออเดอร์ออนไลน์', other: 'อื่นๆ' };
const PRESETS = [['7d', '7 วัน'], ['30d', '30 วัน'], ['month', 'เดือนนี้'], ['last_month', 'เดือนก่อน'], ['year', 'ปีนี้']];
const CARE_WORD = { vet: ['การรักษา', 'เคสตรวจ'], hotel: ['การเข้าพัก', 'การเข้าพัก'], grooming: ['งานบริการ', 'งานบริการ'], shop: ['การขาย', 'บิล'] };

function rangeOf(preset) {
  const now = new Date();
  const today = key(now);
  const back = n => { const d = new Date(now); d.setDate(d.getDate() - n); return key(d); };
  switch (preset) {
    case '7d': return { from: back(6), to: today };
    case 'month': return { from: key(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'last_month': return { from: key(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: key(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: today };
    default: return { from: back(29), to: today };
  }
}

export async function renderReports(container, { category = 'vet' } = {}) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  let preset = '30d';
  let custom = null;
  const words = CARE_WORD[category] || CARE_WORD.vet;

  const shell = () => {
    const r = custom || rangeOf(preset);
    container.innerHTML = `
      <div class="rp">
        <header class="rp-head">
          <div class="min-w-0">
            <h2 class="rp-title">รายงานธุรกิจ</h2>
            <p class="rp-sub">ยอดขาย ${esc(words[0])} และลูกค้า เทียบกับช่วงก่อนหน้า</p>
          </div>
          <div class="rp-tools">
            <div class="rp-seg" role="radiogroup" aria-label="ช่วงเวลา">
              ${PRESETS.map(([id, label]) => `<button type="button" role="radio" data-preset="${id}" aria-checked="${!custom && preset === id}">${label}</button>`).join('')}
            </div>
            <div class="rp-dates">
              <input type="date" id="rp-from" value="${r.from}" max="${r.to}" aria-label="ตั้งแต่วันที่">
              <span aria-hidden="true">–</span>
              <input type="date" id="rp-to" value="${r.to}" min="${r.from}" aria-label="ถึงวันที่">
            </div>
            <button type="button" class="ph-btn" id="rp-print">${icon('printer', 'w-4 h-4')}<span>พิมพ์</span></button>
          </div>
        </header>
        <div id="rp-body"><div class="rp-grid"><div class="card cl-skel" style="height:110px"></div><div class="card cl-skel" style="height:110px"></div><div class="card cl-skel" style="height:110px"></div><div class="card cl-skel" style="height:110px"></div></div></div>
      </div>`;
    container.querySelectorAll('[data-preset]').forEach(b => { b.onclick = () => { preset = b.dataset.preset; custom = null; shell(); }; });
    const onDate = () => {
      const from = container.querySelector('#rp-from').value;
      const to = container.querySelector('#rp-to').value;
      if (from && to && from <= to) { custom = { from, to }; shell(); }
    };
    container.querySelector('#rp-from').onchange = onDate;
    container.querySelector('#rp-to').onchange = onDate;
    container.querySelector('#rp-print').onclick = () => window.print();
    load(r);
  };

  const load = async r => {
    const body = container.querySelector('#rp-body');
    const res = await apiFetch(`/api/reports/summary?store_id=${storeId}&from=${r.from}&to=${r.to}`).catch(() => null);
    if (!res?.success) {
      body.innerHTML = `<div class="card p-6 text-center"><p class="cl-empty">${res?.error === 'range too long' ? 'เลือกช่วงไม่เกิน 1 ปี' : 'โหลดรายงานไม่สำเร็จ ลองอีกครั้ง'}</p></div>`;
      return;
    }
    body.innerHTML = view(res.data, words, category);
  };

  shell();
}

function delta(now, before) {
  if (!before) return now ? '<span class="rp-delta is-up">ใหม่</span>' : '<span class="rp-delta">—</span>';
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return '<span class="rp-delta">เท่าเดิม</span>';
  return `<span class="rp-delta ${pct > 0 ? 'is-up' : 'is-down'}">${icon(pct > 0 ? 'arrow-trend-up' : 'arrow-trend-down', 'w-3.5 h-3.5')}${pct > 0 ? '+' : ''}${pct}%</span>`;
}

function kpi(label, value, extra = '', ic = 'chart-bar') {
  return `<div class="card rp-kpi"><span class="rp-kpi__ic">${icon(ic, 'w-4 h-4')}</span><small>${label}</small><b>${value}</b><div class="rp-kpi__foot">${extra}</div></div>`;
}

function chart(byDay) {
  const max = Math.max(1, ...byDay.map(d => d.total));
  const step = Math.ceil(byDay.length / 8);
  return `<div class="rp-bars" role="img" aria-label="ยอดขายรายวัน">
    ${byDay.map((d, i) => `<div class="rp-bar" title="${short(d.date)} · ${baht(d.total)}"><span style="height:${Math.max(d.total ? 3 : 0, (d.total / max) * 100)}%"></span>${i % step === 0 ? `<em>${short(d.date)}</em>` : ''}</div>`).join('')}
  </div>`;
}

function list(rows, valueOf, labelOf, emptyText) {
  if (!rows.length) return `<p class="cl-empty">${emptyText}</p>`;
  const max = Math.max(1, ...rows.map(valueOf));
  return `<ul class="rp-list">${rows.map(r => `<li><div class="rp-list__row"><span class="truncate">${esc(r.name)}</span><b>${labelOf(r)}</b></div><i><span style="width:${(valueOf(r) / max) * 100}%"></span></i></li>`).join('')}</ul>`;
}

function view(d, words, category) {
  const s = d.sales, v = d.visits, c = d.customers, a = d.appointments;
  const methods = Object.entries(s.by_method).map(([k, amount]) => ({ name: PM[k] || k, amount })).sort((x, y) => y.amount - x.amount);
  const returnRate = c.pets ? Math.round((c.returning / c.pets) * 100) : 0;
  const isShop = category === 'shop';
  return `
    <div class="rp-grid">
      ${kpi('ยอดขาย', baht(s.revenue), `${delta(s.revenue, s.prev_revenue)}<span>ช่วงก่อน ${baht(s.prev_revenue)}</span>`, 'coins')}
      ${kpi('จำนวนบิล', int(s.bills), `<span>เฉลี่ย ${baht(s.avg_bill)} / บิล</span>`, 'receipt')}
      ${isShop
        ? kpi('ออเดอร์ออนไลน์', int(s.online_orders), `<span>เฉลี่ยวันละ ${baht(s.avg_per_day)}</span>`, 'store')
        : kpi(words[1], int(v.total), `<span>เสร็จ ${int(v.completed)}${v.avg_wait_min != null ? ` · รอเฉลี่ย ${v.avg_wait_min} นาที` : ''}</span>`, 'clipboard-list')}
      ${isShop
        ? kpi('ยอดเฉลี่ยต่อวัน', baht(s.avg_per_day), `<span>${d.range.days} วัน</span>`, 'chart-line')
        : kpi('ลูกค้ากลับมาซ้ำ', `${returnRate}%`, `<span>${int(c.returning)} จาก ${int(c.pets)} ตัว · ใหม่ ${int(c.new)}</span>`, 'users')}
    </div>

    <section class="card rp-card">
      <header><h3>ยอดขายรายวัน</h3><small>${short(d.range.from)} – ${short(d.range.to)} · เฉลี่ยวันละ ${baht(s.avg_per_day)}</small></header>
      ${s.revenue ? chart(s.by_day) : '<p class="cl-empty">ยังไม่มียอดขายในช่วงนี้</p>'}
    </section>

    <div class="rp-two">
      <section class="card rp-card">
        <header><h3>${isShop ? 'สินค้าขายดี' : 'รายการขายดี'}</h3><small>ตามยอดเงิน</small></header>
        ${list(s.top_items, r => r.amount, r => `${baht(r.amount)} <small>× ${int(r.qty)}</small>`, 'ยังไม่มีรายการขาย')}
      </section>
      <section class="card rp-card">
        <header><h3>ช่องทางชำระเงิน</h3><small>สัดส่วนยอดรับ</small></header>
        ${list(methods, r => r.amount, r => baht(r.amount), 'ยังไม่มีการชำระเงิน')}
      </section>
      ${isShop ? '' : `
      <section class="card rp-card">
        <header><h3>${esc(words[0])}ยอดนิยม</h3><small>จำนวนครั้งจากคิว</small></header>
        ${list(v.services, r => r.count, r => `${int(r.count)} ครั้ง`, 'ยังไม่มีคิวในช่วงนี้')}
      </section>
      <section class="card rp-card">
        <header><h3>นัดหมาย</h3><small>${int(a.total)} นัด · จากแอป FUFU ${int(a.from_app)}</small></header>
        <div class="rp-stats">
          <div><b>${int(a.done)}</b><small>ยืนยัน / มาตามนัด</small></div>
          <div><b>${int(a.cancelled)}</b><small>ยกเลิก / ปฏิเสธ</small></div>
          <div class="${a.no_show ? 'is-warn' : ''}"><b>${int(a.no_show + v.no_show)}</b><small>ไม่มาตามนัด</small></div>
        </div>
        <p class="cl-note">${icon('bell', 'w-4 h-4')}เปิดเตือนนัดอัตโนมัติในหน้าร้านเพื่อลดการไม่มาตามนัด</p>
      </section>`}
    </div>`;
}
