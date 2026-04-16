/**
 * FUFU Partner – Finance & POS Module
 * Invoicing, multiple payment methods, PromptPay QR, thermal printing,
 * receipt layout, daily summary.
 * @module partner/finance
 * 
 * Acceptance Criteria:
 * - [x] Support multiple payment methods (Cash, Credit, PromptPay).
 * - [x] Generating invoices and rendering POS interface.
 * - [x] Thermal printing placeholder.
 * - [x] Respects FEATURE_FLAGS.ENABLE_PROMPTPAY and ENABLE_FINANCE_EXPORT.
 */

import { COMMISSION_RATE, FEATURE_FLAGS } from '../utils/config.js';
import { formatBaht } from '../utils/formatters.js';
import { showToast } from '../utils/notifications.js';
import { fetchFromSupabase } from '../utils/supabase-client.js';
import { printInvoice, getSampleInvoiceData } from './invoice.js';

// ===== MOCK TRANSACTION DATA =====
const mockTransactions = [
  { id: 't1', date: '2026-04-16', desc: 'ตรวจสุขภาพประจำปี — บัดดี้', amount: 500, method: 'promptpay', status: 'paid', pet: 'บัดดี้', owner: 'คุณสมชาย' },
  { id: 't2', date: '2026-04-16', desc: 'วัคซีน 5 โรค — มิลค์', amount: 800, method: 'cash', status: 'paid', pet: 'มิลค์', owner: 'คุณสุดา' },
  { id: 't3', date: '2026-04-15', desc: 'ยาถ่ายพยาธิ x2 — โกลเด้น', amount: 240, method: 'card', status: 'paid', pet: 'โกลเด้น', owner: 'คุณวิชัย' },
  { id: 't4', date: '2026-04-15', desc: 'ผ่าตัดทำหมัน (มัดจำ 50%)', amount: 1750, method: 'transfer', status: 'deposit', pet: 'ลูน่า', owner: 'คุณปวีณา', total: 3500 },
  { id: 't5', date: '2026-04-14', desc: 'Grooming Full Set', amount: 800, method: 'cash', status: 'paid', pet: 'มะม่วง', owner: 'คุณอรนุช' },
  { id: 't6', date: '2026-04-13', desc: 'ตรวจเลือดครบชุด', amount: 1200, method: 'promptpay', status: 'refunded', pet: 'ชิโระ', owner: 'คุณนภา', refundReason: 'ยกเลิกนัดหมาย' },
  { id: 't7', date: '2026-04-12', desc: 'ห้องพัก Suite 3 คืน', amount: 2700, method: 'card', status: 'paid', pet: 'แม็กซ์', owner: 'คุณธนา' },
];

const paymentMethods = {
  cash:      { icon: 'fa-money-bill-wave', label: 'เงินสด', color: '#10B981' },
  promptpay: { icon: 'fa-qrcode', label: 'พร้อมเพย์', color: '#3B82F6' },
  card:      { icon: 'fa-credit-card', label: 'บัตรเครดิต/เดบิต', color: '#8B5CF6' },
  transfer:  { icon: 'fa-building-columns', label: 'โอนเงิน', color: '#F59E0B' },
  voucher:   { icon: 'fa-ticket', label: 'บัตรกำนัล', color: '#EC4899' },
};

const statusLabels = {
  paid:      { label: 'ชำระแล้ว', class: 'badge-success' },
  deposit:   { label: 'มัดจำ', class: 'badge-warning' },
  pending:   { label: 'รอชำระ', class: 'badge-warning' },
  refunded:  { label: 'คืนเงิน', class: 'badge-neutral' },
  cancelled: { label: 'ยกเลิก', class: 'badge-neutral' },
};

// ===== RENDER =====

/**
 * Render the income/finance page with enhanced features.
 * @param {string} role - Current partner role
 */
export async function renderFinancePage(role) {
  let activeTransactions = mockTransactions;
  // Try fetching real data from Supabase
  const dbTransactions = await fetchFromSupabase('transactions');
  if (dbTransactions && dbTransactions.length > 0) {
    activeTransactions = dbTransactions;
  }
  const today = 12400 + (role === 'shop' ? 6200 : 0) + (role === 'service' ? -2600 : 0);

  // Income stat cards
  const incToday = document.getElementById('inc-today');
  const incWeek = document.getElementById('inc-week');
  const incMonth = document.getElementById('inc-month');
  const incCommission = document.getElementById('inc-commission');

  if (incToday) incToday.textContent = formatBaht(today, true);
  if (incWeek) incWeek.textContent = formatBaht(Math.round(today * 6.5), true);
  if (incMonth) incMonth.textContent = formatBaht(Math.round(today * 24), true);
  if (incCommission) incCommission.textContent = formatBaht(Math.round(today * 24 * COMMISSION_RATE), true);

  // Income summary (enhanced)
  const summary = document.getElementById('income-summary');
  if (summary) {
    const monthlyRevenue = today * 24;
    const commission = Math.round(monthlyRevenue * COMMISSION_RATE);
    const vat = Math.round(monthlyRevenue * 0.07);
    const net = Math.round(monthlyRevenue * (1 - COMMISSION_RATE));

    summary.innerHTML = `
      <div class="income-row">
        <div class="income-label">รายรับจากบริการ/สินค้า</div>
        <div class="income-value" style="color:var(--teal)">${formatBaht(monthlyRevenue)}</div>
      </div>
      <div class="income-row">
        <div class="income-label">ภาษีมูลค่าเพิ่ม (VAT 7%)</div>
        <div class="income-value" style="color:var(--text-muted)">${formatBaht(vat)}</div>
      </div>
      <div class="income-row">
        <div class="income-label">ค่าคอมมิชชัน FUFU (${COMMISSION_RATE * 100}%)</div>
        <div class="income-value" style="color:#f87171">-${formatBaht(commission)}</div>
      </div>
      <div class="income-row income-total">
        <div class="income-label">รายรับสุทธิ</div>
        <div class="income-value">${formatBaht(net)}</div>
      </div>

      <!-- Payment Method Breakdown -->
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-soft, rgba(203,213,225,0.5))">
        <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:var(--text-main, #1E293B)">💳 สรุปตามช่องทางการชำระ</div>
        ${Object.entries(paymentMethods).map(([key, pm]) => {
          const methodTotal = activeTransactions.filter(t => t.method === key && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
          const pct = monthlyRevenue > 0 ? Math.round((methodTotal / monthlyRevenue) * 100) : 0;
          return `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <i class="fas ${pm.icon}" style="color:${pm.color};width:16px;text-align:center;font-size:12px"></i>
              <span style="font-size:12px;min-width:100px">${pm.label}</span>
              <div style="flex:1;height:6px;background:#F1F5F9;border-radius:3px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${pm.color};border-radius:3px;transition:width 0.5s"></div>
              </div>
              <span style="font-size:11px;font-weight:600;color:${pm.color};min-width:40px;text-align:right">${pct}%</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Transaction history (enhanced)
  const tbody = document.getElementById('transaction-tbody');
  if (tbody) {
    tbody.innerHTML = activeTransactions.map(t => {
      const pm = paymentMethods[t.method] || paymentMethods.cash;
      const st = statusLabels[t.status] || statusLabels.paid;

      return `
        <tr>
          <td style="font-family:'Sarabun',sans-serif;font-size:13px">${t.date}</td>
          <td>
            <div style="font-size:13px">${t.desc}</div>
            <div style="font-size:11px;color:var(--text-muted)">${t.owner}</div>
          </td>
          <td style="font-weight:600;color:${t.status === 'refunded' ? '#EF4444' : 'var(--teal)'};font-family:'Sarabun',sans-serif">
            ${t.status === 'refunded' ? '-' : ''}${formatBaht(t.amount)}
            ${t.status === 'deposit' && t.total ? `<div style="font-size:10px;color:var(--text-muted);font-weight:400">จาก ${formatBaht(t.total)}</div>` : ''}
          </td>
          <td>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:${pm.color}">
              <i class="fas ${pm.icon}" style="font-size:10px"></i>${pm.label}
            </span>
          </td>
          <td><span class="badge ${st.class}">${st.label}</span></td>
          <td>
            <button class="btn-sm btn-outline" data-action="view-receipt" data-txn="${t.id}" style="font-size:10px" title="ดูใบเสร็จ">
              <i class="fas fa-receipt"></i>
            </button>
            ${t.status === 'deposit' ? `
              <button class="btn-sm btn-primary" data-action="pay-remaining" data-txn="${t.id}" style="font-size:10px;margin-left:4px" title="ชำระส่วนที่เหลือ">
                ชำระเพิ่ม
              </button>
            ` : ''}
            ${t.status === 'paid' ? `
              <button class="btn-sm btn-outline" data-action="refund" data-txn="${t.id}" style="font-size:10px;margin-left:4px;color:#EF4444;border-color:#EF4444" title="คืนเงิน">
                <i class="fas fa-undo"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    // Update the transaction table header if needed (add payment method & action columns)
    const thead = tbody.closest('table')?.querySelector('thead');
    if (thead && !thead.querySelector('[data-col="method"]')) {
      thead.innerHTML = `
        <tr>
          <th>วันที่</th>
          <th>รายการ</th>
          <th>จำนวน</th>
          <th data-col="method">วิธีชำระ</th>
          <th>สถานะ</th>
          <th data-col="actions">การดำเนินการ</th>
        </tr>
      `;
    }

    // Event delegation for transaction actions
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      switch (btn.dataset.action) {
        case 'view-receipt':
          printInvoice(getSampleInvoiceData());
          break;
        case 'pay-remaining':
          showToast('เปิดฟอร์มชำระเงินส่วนที่เหลือ (Demo)', 'info');
          break;
        case 'refund':
          showToast('เปิดฟอร์มคืนเงิน (Demo)', 'info');
          break;
      }
    });
  }

  // Render finance extras if on income page
  renderFinanceExtras();
}

/**
 * Render additional finance tools below the main income page.
 */
function renderFinanceExtras() {
  const page = document.getElementById('page-income');
  if (!page || page.querySelector('#finance-extras')) return;

  const extras = document.createElement('div');
  extras.id = 'finance-extras';
  extras.style.marginTop = '16px';
  extras.innerHTML = `
    <!-- Quick Actions -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">⚡ เครื่องมือการเงิน</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
        ${[
          { icon: 'fa-file-invoice', label: 'ออกใบกำกับภาษี', desc: 'Tax Invoice', action: 'create-invoice', color: '#0D9488' },
          { icon: 'fa-receipt', label: 'ออกใบเสร็จรับเงิน', desc: 'Receipt', action: 'create-receipt', color: '#3B82F6' },
          ...(FEATURE_FLAGS.ENABLE_PROMPTPAY ? [{ icon: 'fa-qrcode', label: 'สร้าง QR พร้อมเพย์', desc: 'PromptPay QR', action: 'promptpay-qr', color: '#8B5CF6' }] : []),
          ...(FEATURE_FLAGS.ENABLE_FINANCE_EXPORT ? [
            { icon: 'fa-file-csv', label: 'Export CSV', desc: 'ดาวน์โหลดรายงาน', action: 'export-csv', color: '#F59E0B' },
            { icon: 'fa-file-pdf', label: 'Export PDF', desc: 'รายงานสรุป', action: 'export-pdf', color: '#EF4444' }
          ] : []),
          { icon: 'fa-chart-line', label: 'วิเคราะห์รายรับ', desc: 'Analytics', action: 'analytics', color: '#10B981' },
        ].map(t => `
          <button class="finance-tool-btn" data-finance-action="${t.action}" style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid rgba(203,213,225,0.3);border-radius:12px;background:#fff;cursor:pointer;text-align:left;width:100%;transition:all 0.2s;font-family:'Prompt',sans-serif" onmouseover="this.style.borderColor='${t.color}'" onmouseout="this.style.borderColor='rgba(203,213,225,0.3)'">
            <div style="width:40px;height:40px;border-radius:10px;background:${t.color}12;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas ${t.icon}" style="color:${t.color};font-size:15px"></i>
            </div>
            <div>
              <div style="font-weight:500;font-size:13px;color:var(--text-main, #1E293B)">${t.label}</div>
              <div style="font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif">${t.desc}</div>
            </div>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- PromptPay QR Placeholder -->
    <div class="card" style="margin-top:16px;display:none" id="promptpay-section">
      <div class="card-header">
        <div class="card-title">📱 PromptPay QR — รับชำระเงิน</div>
        <button class="btn-sm btn-outline" id="close-promptpay"><i class="fas fa-times"></i></button>
      </div>
      <div style="text-align:center;padding:20px">
        <div style="width:200px;height:200px;background:#F1F5F9;border-radius:16px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
          <div>
            <i class="fas fa-qrcode" style="font-size:4rem;color:var(--text-muted);opacity:0.4"></i>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px">QR จะถูกสร้างจาก API</div>
          </div>
        </div>
        <div style="font-size:14px;font-weight:600;color:var(--text-main)">กรุณากรอกจำนวนเงิน</div>
        <input type="number" placeholder="฿0.00" style="width:200px;padding:12px;margin:12px auto;display:block;border:1.5px solid rgba(203,213,225,0.5);border-radius:10px;text-align:center;font-size:18px;font-weight:600;font-family:'Prompt',sans-serif" id="qr-amount">
        <button class="btn-sm btn-primary" style="padding:10px 30px" id="generate-qr-btn">สร้าง QR Code</button>
        <div style="font-size:11px;color:var(--text-muted);margin-top:12px;font-family:'Sarabun',sans-serif">
          <i class="fas fa-info-circle" style="margin-right:4px"></i>
          PromptPay QR จะถูกสร้างผ่าน API ของธนาคาร เมื่อเชื่อมต่อระบบจริง
        </div>
      </div>
    </div>
  `;

  page.appendChild(extras);

  // Event handlers
  extras.querySelectorAll('.finance-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.financeAction;
      switch (action) {
        case 'create-invoice':
          printInvoice({ ...getSampleInvoiceData(), type: 'invoice' });
          break;
        case 'create-receipt':
          printInvoice({ ...getSampleInvoiceData(), type: 'receipt' });
          break;
        case 'promptpay-qr': {
          const section = document.getElementById('promptpay-section');
          if (section) section.style.display = '';
          break;
        }
        case 'export-csv':
          if (!FEATURE_FLAGS.ENABLE_FINANCE_EXPORT) return showToast('ฟีเจอร์นี้ปิดใช้งานอยู่', 'error');
          showToast('กำลังสร้างไฟล์ CSV (Demo)', 'info');
          break;
        case 'export-pdf':
          if (!FEATURE_FLAGS.ENABLE_FINANCE_EXPORT) return showToast('ฟีเจอร์นี้ปิดใช้งานอยู่', 'error');
          showToast('กำลังสร้างไฟล์ PDF (Demo)', 'info');
          break;
        case 'analytics':
          showToast('กำลังเปิดหน้าวิเคราะห์ (Demo)', 'info');
          break;
      }
    });
  });

  extras.querySelector('#close-promptpay')?.addEventListener('click', () => {
    const section = document.getElementById('promptpay-section');
    if (section) section.style.display = 'none';
  });

  extras.querySelector('#generate-qr-btn')?.addEventListener('click', () => {
    const amount = document.getElementById('qr-amount')?.value;
    if (!amount || Number(amount) <= 0) {
      showToast('กรุณากรอกจำนวนเงิน', 'error');
      return;
    }
    showToast(`สร้าง QR พร้อมเพย์สำหรับ ${formatBaht(Number(amount))} สำเร็จ (Demo)`);
  });
}
