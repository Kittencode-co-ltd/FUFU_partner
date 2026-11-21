// FUFU package for clinics (business model phase 5): plan, trial / paid-until date, 14-day grace, and FUFU's invoices.
// Clinics pay FUFU; customers use the app free. Shown on "ร้านและการรับจอง" for clinics only.
// API: GET /api/clinic-links/billing (server/routes/clinic-links.js). Styles: .cb-* in src/css/input.css.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { icon } from '../utils/icons.js';
import { getLang, locale } from './portal-i18n.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// [th, en, zh, ja, ko]
const S = {
  title: ['แพ็กเกจ FUFU ของคลินิก', 'Your FUFU package', '诊所的 FUFU 套餐', 'FUFU プラン', 'FUFU 패키지'],
  why: ['ลูกค้าของคุณใช้แอป FUFU ฟรี คลินิกเป็นผู้ใช้บริการระบบเชื่อมลูกค้า', 'Your customers use the FUFU app free; the clinic subscribes to the customer link.', '您的顾客免费使用 FUFU 应用，由诊所订阅连接服务', 'お客様はFUFUアプリを無料で使えます。連携サービスは病院が契約します', '고객은 FUFU 앱을 무료로 쓰고, 병원이 연결 서비스를 이용해요'],
  trial: ['ทดลองใช้ฟรี', 'Free trial', '免费试用', '無料トライアル', '무료 체험'],
  active: ['ใช้งานอยู่', 'Active', '使用中', '利用中', '이용 중'],
  suspended: ['ระงับชั่วคราว', 'Suspended', '已暂停', '停止中', '정지됨'],
  cancelled: ['ยกเลิกแล้ว', 'Cancelled', '已取消', '解約済み', '해지됨'],
  endedOn: ['หมดเมื่อ {date}', 'Ended {date}', '{date} 到期', '{date} に終了', '{date} 종료'],
  expired: ['หมดอายุ', 'Expired', '已到期', '期限切れ', '만료'],
  until: ['ใช้ได้ถึง {date}', 'Until {date}', '至 {date}', '{date} まで', '{date}까지'],
  noPlan: ['ยังไม่ได้เลือกแพ็กเกจ', 'No package chosen yet', '尚未选择套餐', 'プラン未選択', '패키지 미선택'],
  grace: ['หมดอายุแล้ว ฟีเจอร์แอปจะพักในวันที่ {date} ชำระบิลเพื่อใช้งานต่อ', 'Expired. App features pause on {date}. Pay the invoice to continue.', '已到期，应用功能将于 {date} 暂停，请付款继续使用', '期限切れです。{date} にアプリ機能が停止します', '만료됐어요. {date}에 앱 기능이 중지돼요'],
  paused: ['พักฟีเจอร์แอปอยู่: ลูกค้าใหม่เชื่อมคลินิกไม่ได้ และเปิดดูข้อมูลที่ลูกค้าแชร์ไม่ได้ ระบบ Partner และการแชร์ฉุกเฉินยังใช้ได้ตามปกติ', 'App features are paused: new customers can’t link and shared data is hidden. The Portal and emergency sharing still work.', '应用功能已暂停：新顾客无法连接，分享资料不可见。Partner 与紧急分享照常', 'アプリ機能停止中：新規連携と共有データの閲覧ができません。Partnerと緊急共有は利用できます', '앱 기능 중지: 신규 연결과 공유 정보 열람이 안 돼요. Partner와 긴급 공유는 사용 가능해요'],
  soon: ['เหลืออีก {n} วัน', '{n} days left', '剩余 {n} 天', '残り{n}日', '{n}일 남음'],
  invoices: ['บิลค่าบริการจาก FUFU', 'Invoices from FUFU', 'FUFU 账单', 'FUFUからの請求書', 'FUFU 청구서'],
  noInvoices: ['ยังไม่มีบิล', 'No invoices yet', '暂无账单', '請求書はありません', '청구서가 없어요'],
  issued: ['รอชำระ', 'Unpaid', '待付款', '未払い', '미납'], paid: ['ชำระแล้ว', 'Paid', '已付款', '支払済み', '납부 완료'],
  due: ['ครบกำหนด {date}', 'Due {date}', '{date} 到期', '期限 {date}', '{date} 마감'],
  overdue: ['เลยกำหนด', 'Overdue', '已逾期', '期限超過', '연체'],
  period: ['รอบ {from} – {to}', 'Period {from} – {to}', '周期 {from} – {to}', '期間 {from} – {to}', '기간 {from} – {to}'],
  howPay: ['วิธีชำระเงิน', 'How to pay', '付款方式', 'お支払い方法', '결제 방법'],
  contact: ['ต้องการเปลี่ยนแพ็กเกจหรือมีคำถาม ติดต่อทีม FUFU', 'To change package or ask a question, contact the FUFU team', '如需更换套餐或咨询，请联系 FUFU 团队', 'プラン変更・お問い合わせはFUFUチームへ', '패키지 변경이나 문의는 FUFU 팀에 연락하세요'],
  perMonth: ['/เดือน', '/month', '/月', '/月', '/월'], perYear: ['/ปี', '/year', '/年', '/年', '/년'],
};
const T = (k, vars = {}) => {
  const i = ['th', 'en', 'zh', 'ja', 'ko'].indexOf(getLang());
  return String((S[k] || [k])[i] ?? S[k]?.[1] ?? k).replace(/\{(\w+)\}/g, (_, x) => vars[x] ?? '');
};
const day = iso => new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
const thb = n => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(Number(n) || 0);

/** Current package state (cached per page load) — used by the link card to show a paused notice. */
let cached = null;
export async function clinicBilling(force = false) {
  if (cached && !force) return cached;
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  cached = apiFetch(`/api/clinic-links/billing?store_id=${storeId}`).then(r => (r?.success ? r.data : null)).catch(() => null);
  return cached;
}
export const billingText = (k, vars) => T(k, vars);

export async function renderBillingCard(el, { isOwner = false } = {}) {
  el.innerHTML = `<div class="card p-5"><div class="cl-skel"></div></div>`;
  const b = await clinicBilling(true);
  if (!b?.applies) { el.innerHTML = ''; return; }
  const left = b.ends_at ? Math.ceil((new Date(b.ends_at) - Date.now()) / 864e5) : null;
  const statusKey = b.status === 'suspended' || b.status === 'cancelled' ? b.status : b.phase === 'ok' ? b.status : 'expired';
  const tone = b.phase === 'ok' ? 'is-ok' : b.phase === 'grace' ? 'is-warn' : 'is-bad';
  const today = new Date().toISOString().slice(0, 10);
  const invoices = b.invoices || [];
  el.innerHTML = `
    <section class="card p-5 cb-card">
      <header class="cb-head">
        <span class="cb-ic">${icon('receipt', 'w-5 h-5')}</span>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-bold text-navy">${esc(T('title'))}</h2>
          <p class="text-sm text-slate-500 mt-0.5">${esc(T('why'))}</p>
        </div>
      </header>
      <div class="cb-plan ${tone}">
        <div class="min-w-0 flex-1">
          <p class="cb-plan__name">${esc(b.plan?.name || (b.status === 'trial' ? T('trial') : T('noPlan')))}</p>
          <p class="cb-plan__meta"><span class="cb-chip ${tone}">${esc(T(statusKey))}</span>${b.ends_at ? esc(T(b.phase === 'ok' ? 'until' : 'endedOn', { date: day(b.ends_at) })) : ''}${b.phase === 'ok' && left !== null && left <= 14 ? ` · <b>${esc(T('soon', { n: left }))}</b>` : ''}</p>
        </div>
        ${b.plan ? `<p class="cb-price">${esc(thb(b.billing_cycle === 'yearly' ? b.plan.price_yearly : b.plan.price_monthly))}<small>${esc(T(b.billing_cycle === 'yearly' ? 'perYear' : 'perMonth'))}</small></p>` : ''}
      </div>
      ${b.phase === 'grace' ? `<p class="cb-alert is-warn">${icon('exclamation-triangle', 'w-4 h-4')}${esc(T('grace', { date: day(b.grace_ends_at) }))}</p>` : ''}
      ${b.phase === 'paused' ? `<p class="cb-alert is-bad">${icon('exclamation-triangle', 'w-4 h-4')}${esc(T('paused'))}</p>` : ''}
      ${b.plan?.features?.length ? `<ul class="cb-features">${b.plan.features.map(f => `<li>${icon('check-circle', 'w-4 h-4')}${esc(f)}</li>`).join('')}</ul>` : ''}
      ${isOwner ? `
        <div class="cb-invoices">
          <p class="cl-people__head">${esc(T('invoices'))}</p>
          ${invoices.length ? `<ul>${invoices.map(i => {
            const overdue = i.status === 'issued' && i.due_date < today;
            return `<li>
              <div class="min-w-0 flex-1">
                <b>${esc(i.invoice_no)}</b> <span class="cb-chip ${i.status === 'paid' ? 'is-ok' : overdue ? 'is-bad' : 'is-warn'}">${esc(overdue ? T('overdue') : T(i.status))}</span>
                <small>${esc(i.plan_name)} · ${esc(T('period', { from: day(i.period_start), to: day(i.period_end) }))}${i.status === 'issued' ? ` · ${esc(T('due', { date: day(i.due_date) }))}` : ''}</small>
                ${i.status === 'issued' && i.payment_note ? `<details class="cb-how"><summary>${esc(T('howPay'))}</summary><p>${esc(i.payment_note)}</p></details>` : ''}
              </div>
              <span class="cb-amount">${esc(thb(i.amount))}</span>
            </li>`;
          }).join('')}</ul>` : `<p class="cl-empty">${esc(T('noInvoices'))}</p>`}
        </div>` : ''}
      <p class="cl-note">${icon('shield-alt', 'w-4 h-4')}${esc(T('contact'))}</p>
    </section>`;
}
