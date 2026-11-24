// FUFU package for clinics (B2B): the whole Partner Portal is paid after the 3-month trial; packages differ by the
// number of users. Shows the plan, trial / paid-until date, 14-day grace, read-only state, FUFU's invoices, and lets
// the owner pick a package (an invoice is issued at once; FUFU confirms the transfer in Admin).
// Shown to clinics only. API: /api/clinic-links/billing (server/routes/clinic-links.js). Styles: .cb-*.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { icon } from '../utils/icons.js';
import { showToast } from '../utils/toast.js';
import { openSheet } from './sheet.js';
import { getLang, locale } from './portal-i18n.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// [th, en, zh, ja, ko]
const S = {
  title: ['แพ็กเกจ FUFU ของคลินิก', 'Your FUFU package', '诊所的 FUFU 套餐', 'FUFU プラン', 'FUFU 패키지'],
  why: ['ใช้ระบบคลินิกครบทุกเมนู ลูกค้าของคุณใช้แอป FUFU ฟรี แพ็กเกจต่างกันที่จำนวนผู้ใช้', 'The full clinic system; your customers use the FUFU app free. Packages differ by number of users.', '完整诊所系统，顾客免费使用 FUFU 应用，套餐按用户数区分', '病院システムの全機能。お客様はアプリ無料。プランはユーザー数で異なります', '병원 시스템 전체 기능, 고객은 앱 무료. 패키지는 사용자 수로 달라요'],
  trial: ['ทดลองใช้ฟรี', 'Free trial', '免费试用', '無料トライアル', '무료 체험'],
  active: ['ใช้งานอยู่', 'Active', '使用中', '利用中', '이용 중'],
  suspended: ['ระงับชั่วคราว', 'Suspended', '已暂停', '停止中', '정지됨'],
  cancelled: ['ยกเลิกแล้ว', 'Cancelled', '已取消', '解約済み', '해지됨'],
  endedOn: ['หมดเมื่อ {date}', 'Ended {date}', '{date} 到期', '{date} に終了', '{date} 종료'],
  expired: ['หมดอายุ', 'Expired', '已到期', '期限切れ', '만료'],
  until: ['ใช้ได้ถึง {date}', 'Until {date}', '至 {date}', '{date} まで', '{date}까지'],
  noPlan: ['ยังไม่ได้เลือกแพ็กเกจ', 'No package chosen yet', '尚未选择套餐', 'プラン未選択', '패키지 미선택'],
  paused: ['ระบบอยู่ในโหมดดูอย่างเดียว: ดูและค้นข้อมูลได้ แต่เพิ่มหรือแก้ไขไม่ได้ ลูกค้าใหม่เชื่อมแอปไม่ได้ ข้อมูลทั้งหมดยังอยู่ครบ การแชร์ฉุกเฉินยังใช้ได้', 'Read-only: you can view and search, but not add or edit. New customers can’t link. All data is kept; emergency sharing still works.', '只读模式：可查看和搜索，不能新增或修改。数据完整保留，紧急分享仍可用', '閲覧のみ：表示・検索はできますが追加・編集はできません。データは保持され、緊急共有は利用できます', '읽기 전용: 보기·검색만 되고 추가·수정은 안 돼요. 데이터는 그대로이고 긴급 공유는 사용 가능해요'],
  grace: ['หมดอายุแล้ว ระบบจะเป็นโหมดดูอย่างเดียวในวันที่ {date} เลือกแพ็กเกจและชำระเพื่อใช้งานต่อ', 'Expired. The system becomes read-only on {date}. Choose a package and pay to continue.', '已到期，系统将于 {date} 变为只读，请选择套餐并付款', '期限切れ。{date} から閲覧のみになります', '만료됐어요. {date}부터 읽기 전용이 돼요'],
  readOnlyTitle: ['ระบบอยู่ในโหมดดูอย่างเดียว', 'Read-only mode', '只读模式', '閲覧のみモード', '읽기 전용 모드'],
  readOnlyBody: ['แพ็กเกจของคลินิกหมดอายุ ดูข้อมูลได้ แต่เพิ่มหรือแก้ไขไม่ได้จนกว่าจะชำระค่าบริการ ข้อมูลทั้งหมดยังอยู่ครบ', 'The clinic package has expired. You can view data but not add or edit until it is paid. Nothing is deleted.', '诊所套餐已到期，付款前只能查看，数据不会删除', 'プランの期限切れ。お支払いまで閲覧のみです。データは削除されません', '패키지가 만료됐어요. 결제 전까지 보기만 가능하며 데이터는 그대로예요'],
  graceTitle: ['แพ็กเกจหมดอายุ ระบบจะเป็นโหมดดูอย่างเดียว {date}', 'Package expired: read-only from {date}', '套餐已到期：{date} 起只读', 'プラン期限切れ：{date} から閲覧のみ', '패키지 만료: {date}부터 읽기 전용'],
  graceBody: ['เลือกแพ็กเกจและชำระก่อนวันนั้นเพื่อใช้งานได้ต่อเนื่อง', 'Choose a package and pay before then to keep working.', '请在此之前选择套餐并付款', 'それまでにプランを選んでお支払いください', '그 전에 패키지를 선택하고 결제하세요'],
  choosePlan: ['เลือกแพ็กเกจ', 'Choose a package', '选择套餐', 'プランを選ぶ', '패키지 선택'],
  monthly: ['รายเดือน', 'Monthly', '按月', '月払い', '월간'], yearly: ['รายปี', 'Yearly', '按年', '年払い', '연간'],
  save2: ['ฟรี 2 เดือน', '2 months free', '免 2 个月', '2か月無料', '2개월 무료'],
  users: ['ผู้ใช้ {n} คน', '{n} users', '{n} 位用户', 'ユーザー{n}人', '사용자 {n}명'],
  usersUnlimited: ['ผู้ใช้ไม่จำกัด', 'Unlimited users', '不限用户', 'ユーザー無制限', '사용자 무제한'],
  usersNow: ['ใช้อยู่ {used}{max} คน', '{used}{max} users in use', '当前 {used}{max} 位用户', '利用中 {used}{max}人', '사용 중 {used}{max}명'],
  popular: ['แนะนำ', 'Popular', '推荐', 'おすすめ', '추천'],
  current: ['แพ็กเกจปัจจุบัน', 'Current package', '当前套餐', '現在のプラン', '현재 패키지'],
  pick: ['เลือกแพ็กเกจนี้', 'Choose this package', '选择此套餐', 'このプランにする', '이 패키지 선택'],
  renew: ['ต่ออายุ', 'Renew', '续费', '更新する', '갱신'],
  perMonthEq: ['เฉลี่ย {price}/เดือน', 'Works out to {price}/month', '折合 {price}/月', '月あたり {price}', '월 {price}'],
  tooMany: ['ตอนนี้มีผู้ใช้ {used} คน เกินแพ็กเกจนี้ ({max} คน) ปิดการใช้งานผู้ใช้ที่ไม่ใช้แล้วก่อน หรือเลือกแพ็กเกจที่ใหญ่กว่า', 'You have {used} users, more than this package allows ({max}). Deactivate unused users or choose a bigger package.', '当前有 {used} 位用户，超过此套餐 ({max})', '現在{used}人で、このプラン（{max}人）を超えています', '현재 {used}명으로 이 패키지({max}명)를 초과해요'],
  ownerOnly: ['เจ้าของคลินิกเป็นผู้เลือกแพ็กเกจและชำระเงิน', 'The clinic owner chooses the package and pays', '由诊所负责人选择套餐并付款', 'プランの選択と支払いはオーナーが行います', '패키지 선택과 결제는 원장님이 해요'],
  invoiceTitle: ['บิล {no}', 'Invoice {no}', '账单 {no}', '請求書 {no}', '청구서 {no}'],
  invoiceReady: ['ออกบิลแล้ว โอนตามรายละเอียดด้านล่าง ทีม FUFU จะยืนยันรับเงินและเปิดแพ็กเกจให้ภายใน 1 วันทำการ', 'Invoice issued. Transfer as shown below; the FUFU team confirms and activates the package within 1 working day.', '账单已开具，请按以下方式转账，FUFU 将在 1 个工作日内确认', '請求書を発行しました。下記の方法でお振込みください', '청구서가 발행됐어요. 아래 방법으로 이체해 주세요'],
  amount: ['ยอดชำระ', 'Amount', '金额', '金額', '금액'],
  noNote: ['ทีม FUFU จะติดต่อแจ้งช่องทางชำระเงิน', 'The FUFU team will contact you with payment details', 'FUFU 团队将联系您告知付款方式', 'FUFUチームからお支払い方法をご連絡します', 'FUFU 팀이 결제 방법을 안내해 드려요'],
  copy: ['คัดลอกรายละเอียด', 'Copy details', '复制信息', '詳細をコピー', '정보 복사'], copied: ['คัดลอกแล้ว', 'Copied', '已复制', 'コピーしました', '복사했어요'],
  close: ['ปิด', 'Close', '关闭', '閉じる', '닫기'],
  failed: ['ทำรายการไม่สำเร็จ ลองอีกครั้ง', 'Something went wrong. Try again', '操作失败，请重试', 'うまくいきませんでした', '처리하지 못했어요'],
  soon: ['เหลืออีก {n} วัน', '{n} days left', '剩余 {n} 天', '残り{n}日', '{n}일 남음'],
  invoices: ['บิลค่าบริการจาก FUFU', 'Invoices from FUFU', 'FUFU 账单', 'FUFUからの請求書', 'FUFU 청구서'],
  noInvoices: ['ยังไม่มีบิล', 'No invoices yet', '暂无账单', '請求書はありません', '청구서가 없어요'],
  issued: ['รอชำระ', 'Unpaid', '待付款', '未払い', '미납'], paid: ['ชำระแล้ว', 'Paid', '已付款', '支払済み', '납부 완료'],
  due: ['ครบกำหนด {date}', 'Due {date}', '{date} 到期', '期限 {date}', '{date} 마감'],
  overdue: ['เลยกำหนด', 'Overdue', '已逾期', '期限超過', '연체'],
  period: ['รอบ {from} – {to}', 'Period {from} – {to}', '周期 {from} – {to}', '期間 {from} – {to}', '기간 {from} – {to}'],
  howPay: ['วิธีชำระเงิน', 'How to pay', '付款方式', 'お支払い方法', '결제 방법'],
  contact: ['ราคาสุทธิ ไม่มีค่าใช้จ่ายอื่นเพิ่ม · มีคำถาม ติดต่อทีม FUFU', 'Net prices, nothing added · Questions? Contact the FUFU team', '净价，无其他费用 · 如有疑问请联系 FUFU 团队', '表示価格がお支払い総額です · ご不明点は FUFU チームへ', '표시 가격이 최종 금액 · 문의는 FUFU 팀으로'],
  perMonth: ['/เดือน', '/month', '/月', '/月', '/월'], perYear: ['/ปี', '/year', '/年', '/年', '/년'],
};
const T = (k, vars = {}) => {
  const i = ['th', 'en', 'zh', 'ja', 'ko'].indexOf(getLang());
  return String((S[k] || [k])[i] ?? S[k]?.[1] ?? k).replace(/\{(\w+)\}/g, (_, x) => vars[x] ?? '');
};
const day = iso => new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
const thb = n => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n) || 0);

/** Current package state (cached per page load) — used by the link card to show a paused notice. */
let cached = null;
export async function clinicBilling(force = false) {
  if (cached && !force) return cached;
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  // Keep only a successful answer, so a failed first load (offline, expired session) is retried next time
  cached = apiFetch(`/api/clinic-links/billing?store_id=${storeId}`).then(r => (r?.success ? r.data : null)).catch(() => null)
    .then(data => { if (!data) cached = null; return data; });
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
      <p class="cb-users">${icon('users', 'w-4 h-4')}${esc(T('usersNow', { used: b.users?.used ?? 1, max: b.users?.max ? ` / ${b.users.max}` : '' }))}</p>
      ${(b.plans || []).length ? `<div class="cb-choose" data-choose>
        <div class="cb-choose__head"><p class="cl-people__head">${esc(T('choosePlan'))}</p>
          <div class="cb-cycle" role="radiogroup" aria-label="${esc(T('choosePlan'))}">
            <button type="button" role="radio" data-cycle="monthly">${esc(T('monthly'))}</button>
            <button type="button" role="radio" data-cycle="yearly">${esc(T('yearly'))} <em>${esc(T('save2'))}</em></button>
          </div></div>
        <div class="cb-plans" data-plans></div>
        ${isOwner ? '' : `<p class="cl-muted">${esc(T('ownerOnly'))}</p>`}
      </div>` : ''}
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
  bindChooser(el, b, isOwner);
}

function bindChooser(el, b, isOwner) {
  const box = el.querySelector('[data-choose]');
  if (!box) return;
  let cycle = b.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
  const draw = () => {
    box.querySelectorAll('[data-cycle]').forEach(btn => btn.setAttribute('aria-checked', String(btn.dataset.cycle === cycle)));
    box.querySelector('[data-plans]').innerHTML = b.plans.map(p => {
      const price = cycle === 'yearly' ? p.price_yearly : p.price_monthly;
      const isCurrent = b.plan?.id === p.id && b.status !== 'trial';
      const over = p.max_users != null && (b.users?.used ?? 1) > p.max_users;
      return `<article class="cb-option ${p.is_popular ? 'is-popular' : ''} ${isCurrent ? 'is-current' : ''}">
        ${p.is_popular ? `<span class="cb-option__flag">${esc(T('popular'))}</span>` : ''}
        <b class="cb-option__name">${esc(p.name)}</b>
        ${p.description ? `<small>${esc(p.description)}</small>` : ''}
        <p class="cb-option__price">${esc(thb(price))}<small>${esc(T(cycle === 'yearly' ? 'perYear' : 'perMonth'))}</small></p>
        ${cycle === 'yearly' ? `<small class="cb-option__eq">${esc(T('perMonthEq', { price: thb(price / 12) }))}</small>` : ''}
        <p class="cb-option__users">${icon('users', 'w-4 h-4')}${esc(p.max_users ? T('users', { n: p.max_users }) : T('usersUnlimited'))}</p>
        ${isOwner ? (over
          ? `<p class="cb-option__over">${esc(T('tooMany', { used: b.users.used, max: p.max_users }))}</p>`
          : `<button type="button" class="ph-btn ${p.is_popular ? 'is-primary' : ''}" data-order="${esc(p.id)}">${esc(isCurrent ? T('renew') : T('pick'))}</button>`)
          : (isCurrent ? `<span class="cb-chip is-ok">${esc(T('current'))}</span>` : '')}
      </article>`;
    }).join('');
    box.querySelectorAll('[data-order]').forEach(btn => { btn.onclick = () => order(el, btn, btn.dataset.order, cycle, isOwner); });
  };
  box.querySelectorAll('[data-cycle]').forEach(btn => { btn.onclick = () => { cycle = btn.dataset.cycle; draw(); }; });
  draw();
}

async function order(el, btn, planId, cycle, isOwner) {
  btn.disabled = true;
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const r = await apiFetch('/api/clinic-links/billing/order', { method: 'POST', body: JSON.stringify({ store_id: storeId, plan_id: planId, cycle }) }).catch(() => null);
  btn.disabled = false;
  const d = r?.data;
  if (!r?.success || !d?.ok) {
    showToast(d?.code === 'too_many_users' ? T('tooMany', { used: d.used, max: d.max }) : (r?.error || T('failed')), 'error');
    return;
  }
  showInvoice(d.invoice);
  renderBillingCard(el, { isOwner });
}

function showInvoice(i) {
  const sheet = openSheet({ title: T('invoiceTitle', { no: i.invoice_no }) });
  const details = `${i.invoice_no} · ${i.plan_name} (${T(i.billing_cycle)}) · ${thb(i.amount)}\n${i.payment_note || ''}`.trim();
  sheet.body.innerHTML = `
    <div class="cb-invoice">
      <p class="cb-alert is-ok">${icon('check-circle', 'w-4 h-4')}${esc(T('invoiceReady'))}</p>
      <dl>
        <div><dt>${esc(T('amount'))}</dt><dd class="cb-invoice__amount">${esc(thb(i.amount))}</dd></div>
        <div><dt>${esc(T('due', { date: '' }).trim())}</dt><dd>${esc(day(i.due_date))}</dd></div>
        <div><dt>${esc(i.plan_name)}</dt><dd>${esc(T('period', { from: day(i.period_start), to: day(i.period_end) }))}</dd></div>
      </dl>
      <p class="cl-people__head">${esc(T('howPay'))}</p>
      <p class="cb-invoice__note">${esc(i.payment_note || T('noNote'))}</p>
    </div>`;
  sheet.foot.innerHTML = `<button type="button" class="ph-btn" data-copy>${icon('copy', 'w-4 h-4')}${esc(T('copy'))}</button><span class="flex-1"></span><button type="button" class="ph-btn is-primary" data-sh-close>${esc(T('close'))}</button>`;
  sheet.foot.querySelector('[data-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(details); showToast(T('copied')); } catch { window.prompt('', details); }
  };
}
