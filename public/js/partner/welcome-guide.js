// First-run welcome guide for the Partner Portal: 4 short slides tailored to the store type.
// Shown once per user after the first sign-in (localStorage, keyed by user id), always skippable,
// and reopened from the profile menu ("ดูคู่มือการใช้งาน"). Centred dialog on tablets and up,
// bottom sheet on phones. Page names come from the live menu (pageLabel), never hard-coded.
import { icon } from '../utils/icons.js';
import { getLang } from './portal-i18n.js';

const SEEN_PREFIX = 'fufu_guide_portal_v1:';

const TEXT = {
  th: {
    dialog: 'คู่มือการใช้งาน', menuEntry: 'ดูคู่มือการใช้งาน', skip: 'ข้าม', back: 'ย้อนกลับ', next: 'ถัดไป', start: 'เริ่มใช้งาน', goTo: 'ไปขั้นที่ {n}',
    navTitle: 'ยินดีต้อนรับสู่ FUFU Partner',
    navBodyBar: 'หน้าที่ใช้บ่อยอยู่แถบล่าง หน้าอื่นอยู่ใน «{menu}»',
    navBodySide: 'ทุกหน้าอยู่ในเมนูซ้าย เรียงตามลำดับงาน',
    bookTitle: 'คำขอจอง',
    bookBody: 'คำขอจองจากแอปเข้ามาที่ «{page}» กดยืนยันหรือปฏิเสธได้ทันที',
    orderTitle: 'คำสั่งซื้อออนไลน์',
    orderBody: 'ออเดอร์จากแอปเข้ามาที่ «{page}» ตรวจสอบแล้วกดยืนยัน',
    flowTitle: 'คิวและชำระเงิน',
    flowBody: 'ทำตามขั้นตอนด้านล่าง รับชำระที่ «{cashier}» ขายสินค้าที่ «{pos}»',
    flowBodyPos: 'ทำตามขั้นตอนด้านล่าง แล้วรับชำระที่ «{pos}»',
    sellTitle: 'ขายและคลังสินค้า',
    sellBody: 'ขายที่ «{pos}» ดูสินค้าคงเหลือที่ «{inventory}»',
    sellBodyPos: 'ขายและรับชำระที่ «{pos}»',
    profileTitle: 'ตั้งค่าร้าน',
    profileBody: 'แตะปุ่มโปรไฟล์มุมขวาบนเพื่อเปิด «{page}» และคู่มือนี้',
    profileBodyNoPage: 'แตะปุ่มโปรไฟล์มุมขวาบนเพื่อตั้งค่าการแสดงผลและเปิดคู่มือนี้',
  },
  en: {
    dialog: 'User guide', menuEntry: 'View user guide', skip: 'Skip', back: 'Back', next: 'Next', start: 'Get started', goTo: 'Go to step {n}',
    navTitle: 'Welcome to FUFU Partner',
    navBodyBar: 'Your main pages are in the bottom bar. Everything else is under “{menu}”.',
    navBodySide: 'Every page is in the left menu, in the order your day runs.',
    bookTitle: 'Booking requests',
    bookBody: 'Bookings from the app arrive in “{page}”. Confirm or decline them right away.',
    orderTitle: 'Online orders',
    orderBody: 'Orders from the app arrive in “{page}”. Check and confirm them.',
    flowTitle: 'Queue and payment',
    flowBody: 'Follow the steps below. Take payment at “{cashier}”, sell products at “{pos}”.',
    flowBodyPos: 'Follow the steps below, then take payment at “{pos}”.',
    sellTitle: 'Sales and stock',
    sellBody: 'Sell at “{pos}”. Check stock at “{inventory}”.',
    sellBodyPos: 'Sell and take payment at “{pos}”.',
    profileTitle: 'Store setup',
    profileBody: 'Tap the profile button (top right) for “{page}” and this guide.',
    profileBodyNoPage: 'Tap the profile button (top right) for display settings and this guide.',
  },
  zh: {
    dialog: '使用指南', menuEntry: '查看使用指南', skip: '跳过', back: '上一步', next: '下一步', start: '开始使用', goTo: '前往第 {n} 步',
    navTitle: '欢迎使用 FUFU Partner',
    navBodyBar: '常用页面在底部栏，其他页面在“{menu}”中。',
    navBodySide: '所有页面都在左侧菜单，按工作顺序排列。',
    bookTitle: '预约请求',
    bookBody: 'App 的预约会出现在“{page}”，可立即确认或拒绝。',
    orderTitle: '线上订单',
    orderBody: 'App 的订单会出现在“{page}”，核对后确认。',
    flowTitle: '排队与收款',
    flowBody: '按下方步骤处理，在“{cashier}”收款，在“{pos}”销售商品。',
    flowBodyPos: '按下方步骤处理，然后在“{pos}”收款。',
    sellTitle: '销售与库存',
    sellBody: '在“{pos}”销售，在“{inventory}”查看库存。',
    sellBodyPos: '在“{pos}”销售并收款。',
    profileTitle: '门店设置',
    profileBody: '点击右上角的个人按钮，打开“{page}”和本指南。',
    profileBodyNoPage: '点击右上角的个人按钮，可调整显示设置并打开本指南。',
  },
  ja: {
    dialog: '使い方ガイド', menuEntry: '使い方ガイドを見る', skip: 'スキップ', back: '戻る', next: '次へ', start: 'はじめる', goTo: 'ステップ {n} へ',
    navTitle: 'FUFU Partner へようこそ',
    navBodyBar: 'よく使うページは下のバーに、その他は「{menu}」にあります。',
    navBodySide: 'すべてのページは左のメニューに、仕事の順に並んでいます。',
    bookTitle: '予約リクエスト',
    bookBody: 'アプリからの予約は「{page}」に届きます。すぐに承認・辞退できます。',
    orderTitle: 'オンライン注文',
    orderBody: 'アプリからの注文は「{page}」に届きます。確認して承認します。',
    flowTitle: '受付と会計',
    flowBody: '下の順に進め、「{cashier}」で会計、「{pos}」で商品を販売します。',
    flowBodyPos: '下の順に進め、「{pos}」で会計します。',
    sellTitle: '販売と在庫',
    sellBody: '「{pos}」で販売し、「{inventory}」で在庫を確認します。',
    sellBodyPos: '「{pos}」で販売と会計を行います。',
    profileTitle: '店舗設定',
    profileBody: '右上のプロフィールボタンから「{page}」とこのガイドを開けます。',
    profileBodyNoPage: '右上のプロフィールボタンから表示設定とこのガイドを開けます。',
  },
  ko: {
    dialog: '사용 안내', menuEntry: '사용 안내 보기', skip: '건너뛰기', back: '이전', next: '다음', start: '시작하기', goTo: '{n}단계로 이동',
    navTitle: 'FUFU Partner에 오신 것을 환영합니다',
    navBodyBar: '자주 쓰는 페이지는 아래 바에, 나머지는 “{menu}”에 있어요.',
    navBodySide: '모든 페이지는 왼쪽 메뉴에 업무 순서대로 있어요.',
    bookTitle: '예약 요청',
    bookBody: '앱 예약은 “{page}”에 도착해요. 바로 확정하거나 거절하세요.',
    orderTitle: '온라인 주문',
    orderBody: '앱 주문은 “{page}”에 도착해요. 확인 후 확정하세요.',
    flowTitle: '대기열과 결제',
    flowBody: '아래 순서대로 진행하고 “{cashier}”에서 결제, “{pos}”에서 상품을 판매해요.',
    flowBodyPos: '아래 순서대로 진행한 뒤 “{pos}”에서 결제해요.',
    sellTitle: '판매와 재고',
    sellBody: '“{pos}”에서 판매하고 “{inventory}”에서 재고를 확인해요.',
    sellBodyPos: '“{pos}”에서 판매하고 결제해요.',
    profileTitle: '매장 설정',
    profileBody: '오른쪽 위 프로필 버튼에서 “{page}”과(와) 이 안내를 열 수 있어요.',
    profileBodyNoPage: '오른쪽 위 프로필 버튼에서 화면 설정과 이 안내를 열 수 있어요.',
  },
};

/** Guide string for the current language, with {placeholders} filled in. */
export function guideText(key, vars = {}, lang = getLang()) {
  const raw = TEXT[lang]?.[key] ?? TEXT.th[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

// The booking → queue → service → payment path per workspace (same order as the dashboard step bar)
const FLOW = {
  vet: ['queue', 'opd', 'cashier'],
  hotel: ['queue', 'hotel', 'cashier'],
  grooming: ['queue', 'grooming', 'cashier'],
};

/**
 * Pure step builder (tested in test/welcome-guide.test.js).
 * ctx: { role, navItems: [{id,label}], accountItems: [{id,label}], bottomTabs: [{id,label}], drawer, label(item), menuLabel, lang }
 * Only pages this user can actually open are mentioned.
 */
export function buildPortalGuideSteps(ctx) {
  const lang = ctx.lang || getLang();
  const tx = (key, vars) => guideText(key, vars, lang);
  const label = ctx.label || (item => item.label);
  const nav = ctx.navItems || [];
  const find = id => nav.find(item => item.id === id);
  const name = id => (find(id) ? label(find(id)) : '');
  const steps = [];

  steps.push({
    key: 'nav', icon: 'th-large',
    title: tx('navTitle'),
    body: ctx.drawer ? tx('navBodyBar', { menu: ctx.menuLabel }) : tx('navBodySide'),
    chips: ctx.drawer
      ? [...(ctx.bottomTabs || []).map(item => ({ label: item.label, icon: item.icon })), { label: ctx.menuLabel, icon: 'th-large' }]
      : nav.slice(0, 5).map(item => ({ label: label(item), icon: item.icon })),
    chipStyle: ctx.drawer ? 'bar' : 'list',
  });

  if (find('appointments')) {
    steps.push({ key: 'bookings', icon: 'calendar-alt', title: tx('bookTitle'), body: tx('bookBody', { page: name('appointments') }), chips: [{ label: name('appointments'), icon: 'calendar-alt', badge: 3, on: true }], chipStyle: 'list' });
  } else if (find('orders')) {
    steps.push({ key: 'orders', icon: 'receipt', title: tx('orderTitle'), body: tx('orderBody', { page: name('orders') }), chips: [{ label: name('orders'), icon: 'receipt', badge: 2, on: true }], chipStyle: 'list' });
  }

  const flow = (FLOW[ctx.role] || []).filter(find);
  if (ctx.role !== 'shop' && (find('cashier') || find('pos'))) {
    const body = find('cashier') && find('pos')
      ? tx('flowBody', { cashier: name('cashier'), pos: name('pos') })
      : tx('flowBodyPos', { pos: name('pos') || name('cashier') });
    steps.push({ key: 'flow', icon: 'coins', title: tx('flowTitle'), body, chips: flow.map(id => ({ label: name(id).split(' · ')[0], icon: find(id).icon })), chipStyle: 'flow' });
  } else if (find('pos')) {
    const body = find('inventory') ? tx('sellBody', { pos: name('pos'), inventory: name('inventory') }) : tx('sellBodyPos', { pos: name('pos') });
    steps.push({ key: 'sell', icon: 'credit-card', title: tx('sellTitle'), body, chips: ['pos', 'inventory'].filter(find).map(id => ({ label: name(id).split(' · ')[0], icon: find(id).icon })), chipStyle: 'flow' });
  }

  // Store setup page in the profile menu: the store-and-bookings page where the workspace has one, else settings
  const account = ctx.accountItems || [];
  const setup = ['clinic', 'settings', 'users'].map(id => account.find(item => item.id === id)).find(Boolean);
  const guide = tx('menuEntry');
  steps.push({
    key: 'profile', icon: 'user',
    title: tx('profileTitle'),
    body: setup ? tx('profileBody', { page: label(setup), guide }) : tx('profileBodyNoPage', { guide }),
    chips: [...account.map(item => ({ label: label(item), icon: item.icon, on: item === setup })), { label: guide, icon: 'list-ul' }],
    chipStyle: 'menu',
  });
  return steps;
}

// ─── Seen flag ────────────────────────────────────────────────────────────────

const seenKey = userId => SEEN_PREFIX + (userId || 'anon');
export function hasSeenGuide(userId) {
  try { return localStorage.getItem(seenKey(userId)) === 'done'; } catch { return true; } // blocked storage: never nag
}
function markSeen(userId) {
  try { localStorage.setItem(seenKey(userId), 'done'); } catch { /* storage blocked */ }
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
let _active = null;

function _preview(step) {
  const chips = step.chips || [];
  if (!chips.length) return '';
  if (step.chipStyle === 'bar') {
    return `<div class="wg-bar" aria-hidden="true">${chips.map((c, i) => `
      <span class="wg-bar__tab ${i === chips.length - 1 ? 'is-on' : ''}" style="--i:${i}">${icon(c.icon, 'w-4 h-4')}<span>${esc(c.label)}</span></span>`).join('')}</div>`;
  }
  if (step.chipStyle === 'flow') {
    return `<div class="wg-flow" aria-hidden="true">${chips.map((c, i) => `
      ${i ? `<span class="wg-flow__arrow" style="--i:${i * 2 - 1}">›</span>` : ''}<span class="wg-flow__step" style="--i:${i * 2}"><span class="wg-flow__n">${i + 1}</span>${esc(c.label)}</span>`).join('')}</div>`;
  }
  return `<div class="wg-list" aria-hidden="true">${chips.slice(0, 5).map((c, i) => `
    <span class="wg-list__row ${c.on ? 'is-on' : ''}" style="--i:${i}">${icon(c.icon, 'w-4 h-4')}<span class="wg-list__label">${esc(c.label)}</span>${c.badge ? `<span class="wg-list__badge">${c.badge}</span>` : ''}</span>`).join('')}</div>`;
}

/**
 * Open the guide. getSteps() is called on every render so the slides follow
 * a resize between the bottom bar (< 1024px) and the sidebar.
 */
export function openGuide({ getSteps, userId, returnFocus } = {}) {
  if (_active) return _active;
  let steps = getSteps();
  let index = 0;
  const previousFocus = returnFocus || document.activeElement;
  const root = document.createElement('div');
  root.className = 'wg';
  root.innerHTML = `
    <div class="wg-panel" role="dialog" aria-modal="true" aria-labelledby="wg-title" aria-describedby="wg-body">
      <div class="wg-top">
        <button type="button" class="wg-skip" data-wg-skip>${esc(guideText('skip'))}</button>
      </div>
      <div class="wg-stage" data-wg-stage></div>
      <div class="wg-dots" data-wg-dots></div>
      <div class="wg-foot">
        <button type="button" class="wg-btn wg-btn--ghost" data-wg-back>${esc(guideText('back'))}</button>
        <button type="button" class="wg-btn wg-btn--primary" data-wg-next></button>
      </div>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('wg-open');

  const stage = root.querySelector('[data-wg-stage]');
  const backBtn = root.querySelector('[data-wg-back]');
  const nextBtn = root.querySelector('[data-wg-next]');

  function render(dir = 0) {
    steps = getSteps();
    index = Math.min(index, steps.length - 1);
    const step = steps[index];
    const last = index === steps.length - 1;
    stage.innerHTML = `
      <div class="wg-slide ${dir > 0 ? 'from-right' : dir < 0 ? 'from-left' : ''}">
        <div class="wg-art">
          ${_preview(step)}
        </div>
        <h2 class="wg-title" id="wg-title">${esc(step.title)}</h2>
        <p class="wg-body" id="wg-body">${esc(step.body)}</p>
      </div>`;
    root.querySelector('[data-wg-dots]').innerHTML = steps.map((s, i) => `
      <button type="button" class="wg-dot ${i === index ? 'is-on' : ''}" data-wg-dot="${i}" aria-label="${esc(guideText('goTo', { n: i + 1 }))}" ${i === index ? 'aria-current="step"' : ''}></button>`).join('');
    backBtn.hidden = index === 0;
    nextBtn.textContent = last ? guideText('start') : guideText('next');
    nextBtn.classList.toggle('is-last', last);
  }

  function go(next) {
    if (next < 0 || next >= steps.length || next === index) return;
    const dir = next > index ? 1 : -1;
    index = next;
    render(dir);
  }

  function close() {
    markSeen(userId);
    document.removeEventListener('keydown', onKey, true);
    root.classList.remove('is-open');
    setTimeout(() => { root.remove(); document.body.classList.remove('wg-open'); }, 240);
    _active = null;
    (previousFocus && previousFocus !== document.body && document.contains(previousFocus) ? previousFocus : document.getElementById('profile-btn'))?.focus?.({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'ArrowRight' && !e.target.closest('input,textarea')) { e.preventDefault(); go(index + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); return; }
    if (e.key !== 'Tab') return;
    // Focus trap: cycle inside the panel
    const focusables = [...root.querySelectorAll('button:not([hidden]):not([disabled])')];
    if (!focusables.length) return;
    const first = focusables[0];
    const lastEl = focusables[focusables.length - 1];
    if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey, true);

  root.addEventListener('click', e => {
    if (e.target.closest('[data-wg-skip]')) return close();
    if (e.target.closest('[data-wg-back]')) { go(index - 1); if (backBtn.hidden) nextBtn.focus(); return; }
    if (e.target.closest('[data-wg-next]')) { if (index === steps.length - 1) close(); else go(index + 1); return; }
    const dot = e.target.closest('[data-wg-dot]');
    if (dot) go(Number(dot.dataset.wgDot));
  });

  // Swipe left / right on the slide (touch and pen)
  let start = null;
  stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') start = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { start = null; });

  render();
  requestAnimationFrame(() => root.classList.add('is-open'));
  setTimeout(() => nextBtn.focus({ preventScroll: true }), 60);
  _active = { close };
  return _active;
}

/** Show the guide once per user (first sign-in on this browser). */
export function maybeShowGuide(options) {
  if (hasSeenGuide(options.userId) || _active) return;
  // Let the first page paint before the guide slides in
  setTimeout(() => { if (!hasSeenGuide(options.userId) && !document.querySelector('.sh, .pm.is-open')) openGuide(options); }, 700);
}
