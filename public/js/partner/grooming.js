// Grooming: day schedule + work board. Book ahead (time, groomer, services, pet care notes),
// take walk-ins, pull in App bookings, then move each pet booked → arrived → grooming → done → picked up.
// API: server/routes/grooming.js. Styles: .st-* in src/css/input.css.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { openSheet } from './sheet.js';
import { getLang } from './portal-i18n.js';
import { T, addStrings, esc, baht, todayBkk, addDays, fmtDay, fmtTime, speciesEmoji, speciesLabel, petPicker, petFacts, askReason, apiError } from './stay-kit.js';

addStrings({
  gTitle: ['งานอาบน้ำตัดขน', 'Grooming', '美容', 'トリミング', '미용'],
  gSub: ['ตารางนัด คิวงาน และข้อมูลน้องแต่ละตัว', 'Schedule, work board and every pet’s notes', '预约、工作看板与宠物信息', '予約・作業ボード・ペット情報', '예약, 작업 보드, 반려동물 정보'],
  book: ['นัดหมาย', 'Book', '预约', '予約', '예약'], walkIn: ['รับ walk-in', 'Walk-in', '现场接待', '当日受付', '방문 접수'],
  today: ['วันนี้', 'Today', '今天', '今日', '오늘'],
  gRequests: ['นัดจากแอป รอรับเข้าตาราง', 'App bookings to add', '应用预约待加入', 'アプリ予約（未登録）', '앱 예약 (등록 대기)'],
  accept: ['รับเข้าตาราง', 'Add to schedule', '加入日程', 'スケジュールに追加', '일정에 추가'],
  col_booked: ['นัดไว้', 'Booked', '已预约', '予約', '예약'], col_waiting: ['มาถึงแล้ว รอคิว', 'Arrived', '已到达', '到着', '도착'],
  col_in_progress: ['กำลังทำ', 'Grooming', '进行中', '施術中', '진행 중'], col_done: ['เสร็จ รอรับกลับ', 'Ready for pickup', '待取回', 'お迎え待ち', '픽업 대기'],
  col_closed: ['รับกลับแล้ว / ยกเลิก', 'Picked up / cancelled', '已取回 / 已取消', 'お迎え済み・キャンセル', '픽업 완료 / 취소'],
  emptyDay: ['ยังไม่มีนัดในวันนี้', 'No bookings for this day', '这天没有预约', 'この日の予約はありません', '이 날 예약이 없어요'],
  emptyCol: ['—', '—', '—', '—', '—'],
  arrived: ['มาถึงแล้ว', 'Arrived', '已到达', '到着', '도착'], start: ['เริ่มทำ', 'Start', '开始', '開始', '시작'],
  finish: ['เสร็จแล้ว', 'Finish', '完成', '完了', '완료'], pickedUp: ['รับกลับแล้ว', 'Picked up', '已取回', 'お迎え済み', '픽업 완료'],
  noShow: ['ไม่มา', 'No-show', '未到', '来店なし', '노쇼'], cancelAppt: ['ยกเลิกนัด', 'Cancel booking', '取消预约', '予約をキャンセル', '예약 취소'],
  when: ['วันเวลา', 'Date & time', '日期时间', '日時', '날짜와 시간'], date: ['วันที่', 'Date', '日期', '日付', '날짜'], time: ['เวลา', 'Time', '时间', '時間', '시간'],
  duration: ['ใช้เวลา (นาที)', 'Duration (min)', '时长（分钟）', '所要時間（分）', '소요 시간 (분)'], groomer: ['ช่างตัดขน', 'Groomer', '美容师', 'トリマー', '미용사'],
  services: ['บริการ', 'Services', '服务', 'サービス', '서비스'], price: ['ราคา', 'Price', '价格', '料金', '가격'],
  customService: ['+ บริการอื่น', '+ Other service', '+ 其他服务', '+ その他', '+ 기타 서비스'],
  groomNotes: ['ข้อมูลสำหรับช่าง', 'Notes for the groomer', '美容注意事项', 'トリマーへのメモ', '미용사 메모'],
  coat: ['ลักษณะขน', 'Coat', '毛质', '毛質', '털 상태'], size: ['ขนาดตัว', 'Size', '体型', 'サイズ', '크기'], style: ['ทรงที่ต้องการ', 'Style wanted', '想要的造型', '希望のスタイル', '원하는 스타일'],
  temper: ['นิสัย / ข้อควรระวัง', 'Temperament / cautions', '性格 / 注意事项', '性格・注意点', '성격 / 주의사항'], skin: ['ผิวหนัง / จุดที่ระวัง', 'Skin / sore spots', '皮肤 / 注意部位', '皮膚・注意箇所', '피부 / 주의 부위'],
  sizeS: ['เล็ก', 'Small', '小', '小型', '소형'], sizeM: ['กลาง', 'Medium', '中', '中型', '중형'], sizeL: ['ใหญ่', 'Large', '大', '大型', '대형'], sizeXL: ['ใหญ่มาก', 'Extra large', '特大', '超大型', '초대형'],
  muzzle: ['ต้องใส่ตะกร้อปาก', 'Needs a muzzle', '需戴嘴套', '口輪が必要', '입마개 필요'], sensitive: ['ผิวแพ้ง่าย', 'Sensitive skin', '皮肤敏感', '敏感肌', '민감성 피부'],
  senior: ['สูงวัย', 'Senior', '老年', 'シニア', '노령'], matted: ['ขนพันกัน', 'Matted coat', '毛打结', '毛玉あり', '털 엉킴'],
  total: ['รวม', 'Total', '合计', '合計', '합계'], saveBooking: ['บันทึกนัด', 'Save booking', '保存预约', '予約を保存', '예약 저장'],
  overlap: ['ช่าง {g} มีนัดชนเวลา {t}', '{g} already has a booking at {t}', '{g} 在 {t} 已有预约', '{g} は {t} に予約があります', '{g}님은 {t}에 예약이 있어요'],
  report: ['รายงานหลังทำ', 'Grooming report', '美容报告', 'トリミング報告', '미용 리포트'],
  rSkin: ['ผิวหนัง', 'Skin', '皮肤', '皮膚', '피부'], rEars: ['หู', 'Ears', '耳朵', '耳', '귀'], rNails: ['เล็บ', 'Nails', '指甲', '爪', '발톱'], rTeeth: ['ฟัน', 'Teeth', '牙齿', '歯', '이빨'],
  rParasites: ['เห็บ หมัด', 'Fleas / ticks', '跳蚤 / 蜱虫', 'ノミ・ダニ', '벼룩·진드기'], rNote: ['ฝากถึงเจ้าของ', 'Message for the owner', '给主人的留言', '飼い主へのメッセージ', '보호자에게 전할 말'],
  normal: ['ปกติ', 'Normal', '正常', '正常', '정상'], printReport: ['พิมพ์รายงาน', 'Print report', '打印报告', '報告を印刷', '리포트 인쇄'],
  progress: ['ความคืบหน้า', 'Progress', '进度', '進捗', '진행률'], elapsed: ['ผ่านไป {m} นาที', '{m} min so far', '已过 {m} 分钟', '{m} 分経過', '{m}분 경과'],
  details: ['รายละเอียด', 'Details', '详情', '詳細', '상세'],
  invalid_transition: ['ขั้นตอนนี้ทำไม่ได้แล้ว รีเฟรชหน้า', 'That step is no longer possible. Refresh', '此步骤不可用，请刷新', 'この操作はできません', '이 단계는 할 수 없어요'],
  already_assigned: ['นัดนี้อยู่ในตารางแล้ว', 'This booking is already on the schedule', '该预约已在日程中', '既に登録済みです', '이미 일정에 있어요'],
  pet_required: ['กรอกชื่อน้องก่อน', 'Enter the pet name', '请输入宠物名', 'ペット名を入力', '반려동물 이름을 입력하세요'],
  cancelPresets: [['ลูกค้าขอยกเลิก', 'น้องไม่สบาย', 'ช่างไม่ว่าง'], ['Customer cancelled', 'Pet is unwell', 'Groomer unavailable'], ['顾客取消', '宠物生病', '美容师没空'], ['お客様都合', '体調不良', 'トリマー不在'], ['고객 취소', '반려동물 아픔', '미용사 부재']],
});

const PRESETS = [
  { name: ['อาบน้ำ', 'Bath', '洗澡', 'シャンプー', '목욕'], price: 300 },
  { name: ['ตัดขนทั้งตัว', 'Full haircut', '全身剪毛', '全身カット', '전체 미용'], price: 600 },
  { name: ['ตัดเล็บ', 'Nail trim', '剪指甲', '爪切り', '발톱 정리'], price: 100 },
  { name: ['เช็ดหู', 'Ear cleaning', '清洁耳朵', '耳掃除', '귀 청소'], price: 80 },
  { name: ['แปรงฟัน', 'Teeth brushing', '刷牙', '歯みがき', '양치'], price: 100 },
  { name: ['สปาขน', 'Coat spa', '护毛 SPA', 'スパ', '스파'], price: 350 },
  { name: ['กำจัดเห็บหมัด', 'Flea & tick bath', '除跳蚤蜱虫', 'ノミ・ダニ駆除', '진드기 목욕'], price: 250 },
];
/** Default grooming menu (Thai names), also used by the POS when the shop has no grooming service items. */
export const SERVICES = PRESETS.map((p, i) => ({ id: `g${i + 1}`, name: p.name[0], price: p.price }));
const COLS = ['booked', 'waiting', 'in_progress', 'done'];

let _storeId = null;
let _date = null;
let _container = null;
let _catalog = null;
let _groomers = [];
let _boardTab = 'booked';
let _tick = null;

export async function renderGrooming(container) {
  _container = container;
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  _date = _date || todayBkk();
  clearInterval(_tick);
  _tick = setInterval(() => { if (!document.hidden && _container?.isConnected) updateElapsed(); else if (!_container?.isConnected) clearInterval(_tick); }, 60000);
  container.innerHTML = `
    <div class="st-page">
      <header class="so-head">
        <div class="min-w-0"><h1 class="so-title">${esc(T('gTitle'))}</h1><p class="so-sub">${esc(T('gSub'))}</p></div>
        <div class="flex gap-2"><button type="button" class="ph-btn" data-walkin>${esc(T('walkIn'))}</button><button type="button" class="ph-btn is-primary" data-book>${esc(T('book'))}</button></div>
      </header>
      <div class="st-cal-bar">
        <div class="flex gap-2 items-center">
          <button type="button" class="ph-btn" data-day="-1" aria-label="${esc(T('date'))} -1">‹</button>
          <input type="date" class="st-date" data-date value="${_date}">
          <button type="button" class="ph-btn" data-day="1" aria-label="${esc(T('date'))} +1">›</button>
          <button type="button" class="ph-btn" data-day="0">${esc(T('today'))}</button>
        </div>
        <p class="st-muted" data-day-label></p>
      </div>
      <div data-view></div>
    </div>`;
  container.querySelector('[data-book]').onclick = () => openBookingSheet({ when: `${_date}T${nextSlot()}` });
  container.querySelector('[data-walkin]').onclick = () => openBookingSheet({ walkIn: true });
  container.querySelectorAll('[data-day]').forEach(b => { b.onclick = () => { const n = Number(b.dataset.day); _date = n ? addDays(_date, n) : todayBkk(); container.querySelector('[data-date]').value = _date; load(); }; });
  container.querySelector('[data-date]').onchange = e => { if (e.target.value) { _date = e.target.value; load(); } };
  await load();
}

function nextSlot() {
  if (_date !== todayBkk()) return '10:00';
  const now = new Date(Date.now() + 7 * 3600000);
  const m = now.getUTCHours() * 60 + now.getUTCMinutes() + 30;
  const h = Math.min(20, Math.max(9, Math.ceil(m / 30) * 30 / 60));
  return `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
}

async function load() {
  const el = _container.querySelector('[data-view]');
  _container.querySelector('[data-day-label]').textContent = fmtDay(_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  el.innerHTML = '<div class="st-skeleton"></div><div class="st-skeleton"></div>';
  const res = await apiFetch(`/api/grooming?store_id=${_storeId}&date=${_date}`).catch(() => null);
  if (!res?.success) {
    el.innerHTML = `<div class="st-empty"><p>${esc(T('loadFail'))}</p><button type="button" class="ph-btn" data-retry>${esc(T('retry'))}</button></div>`;
    el.querySelector('[data-retry]').onclick = load;
    return;
  }
  const sessions = res.data;
  _groomers = [...new Set(sessions.map(s => s.groomer_name).filter(Boolean))];
  const by = Object.fromEntries([...COLS, 'closed'].map(c => [c, []]));
  sessions.forEach(s => (COLS.includes(s.status) ? by[s.status] : by.closed).push(s));
  if (!by[_boardTab]?.length) _boardTab = COLS.find(c => by[c].length) || 'booked';

  el.innerHTML = `
    ${res.requests.length ? `<section class="st-section"><h2 class="st-h2">${esc(T('gRequests'))} <span class="st-count">${res.requests.length}</span></h2>
      <div class="st-list">${res.requests.map(a => `
        <article class="st-card is-request">
          <span class="st-avatar">${speciesEmoji(a.pets?.species)}</span>
          <div class="min-w-0 flex-1">
            <p class="st-strong">${esc(a.pets?.name || a.pet_name)} <span class="st-chip is-app">${esc(T('fromApp'))}</span></p>
            <p class="st-muted">${a.starts_at ? esc(fmtTime(a.starts_at)) : esc(a.appt_time || '')} · ${esc((a.services || []).join(', '))}${a.pets?.breed ? ` · ${esc(a.pets.breed)}` : ''}</p>
            ${a.customer_notes ? `<p class="st-note">“${esc(a.customer_notes)}”</p>` : ''}
          </div>
          <button type="button" class="ph-btn is-primary" data-accept="${a.id}">${esc(T('accept'))}</button>
        </article>`).join('')}</div></section>` : ''}
    ${sessions.length ? `
      <nav class="so-tabs st-board-tabs">${COLS.map(c => `<button type="button" class="so-tab" data-col-tab="${c}" aria-pressed="${_boardTab === c}">${esc(T(`col_${c}`))} <span>${by[c].length}</span></button>`).join('')}</nav>
      <div class="st-board">${COLS.map(c => `
        <section class="st-col ${_boardTab === c ? 'is-active' : ''}" data-col="${c}">
          <h2 class="st-col-head">${esc(T(`col_${c}`))} <span class="st-count">${by[c].length}</span></h2>
          ${by[c].map(sessionCard).join('') || `<p class="st-muted st-col-empty">${esc(T('emptyCol'))}</p>`}
        </section>`).join('')}</div>
      ${by.closed.length ? `<details class="st-details st-closed"><summary>${esc(T('col_closed'))} (${by.closed.length})</summary><div class="st-list">${by.closed.map(sessionCard).join('')}</div></details>` : ''}`
    : `<div class="st-empty"><p>${esc(T('emptyDay'))}</p><button type="button" class="ph-btn is-primary" data-empty-book>${esc(T('book'))}</button></div>`}`;

  el.querySelector('[data-empty-book]')?.addEventListener('click', () => openBookingSheet({ when: `${_date}T${nextSlot()}` }));
  el.querySelectorAll('[data-col-tab]').forEach(b => {
    b.onclick = () => { _boardTab = b.dataset.colTab; el.querySelectorAll('[data-col-tab]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); el.querySelectorAll('[data-col]').forEach(c => c.classList.toggle('is-active', c.dataset.col === _boardTab)); };
  });
  el.querySelectorAll('[data-accept]').forEach(b => {
    b.onclick = () => {
      const a = res.requests.find(r => r.id === b.dataset.accept);
      openBookingSheet({
        appointmentId: a.id, when: a.starts_at ? toLocalInput(a.starts_at) : `${_date}T${(a.appt_time || '10:00').slice(0, 5)}`,
        pet: { pet_id: a.pet_id, pet_name: a.pets?.name || a.pet_name, species: a.pets?.species || 'dog', owner_name: '', owner_phone: '', pet: a.pets },
        services: (a.services || []).map(n => ({ name: n, price: 0 })), notes: a.customer_notes,
      });
    };
  });
  const byId = Object.fromEntries(sessions.map(s => [s.id, s]));
  el.querySelectorAll('[data-step]').forEach(b => { b.onclick = e => { e.stopPropagation(); step(byId[b.dataset.id], b.dataset.step, b); }; });
  el.querySelectorAll('[data-pct]').forEach(b => { b.onclick = e => { e.stopPropagation(); setProgress(byId[b.dataset.id], Number(b.dataset.pct)); }; });
  el.querySelectorAll('[data-open]').forEach(card => {
    const open = () => openDetail(byId[card.dataset.open]);
    card.onclick = open;
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
}

const toLocalInput = iso => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 16);
const fromLocalInput = v => (v ? new Date(`${v}:00+07:00`).toISOString() : null);

function sessionCard(s) {
  const care = s.care_profile || {};
  const list = (s.services || []).map(x => (typeof x === 'string' ? x : x.name)).filter(Boolean);
  const flags = [care.muzzle && T('muzzle'), care.sensitive_skin && T('sensitive'), care.senior && T('senior'), care.matted && T('matted')].filter(Boolean);
  const next = { booked: [['arrive', 'arrived', 'is-primary']], waiting: [['start', 'start', 'is-primary']], in_progress: [['complete', 'finish', 'is-primary']], done: [['pickup', 'pickedUp', 'is-primary']] }[s.status] || [];
  return `
    <article class="st-card is-session is-${s.status}" data-open="${s.id}" tabindex="0" role="button">
      <div class="st-session-top">
        <span class="st-time">${s.scheduled_at ? esc(fmtTime(s.scheduled_at)) : '—'}</span>
        <span class="st-avatar is-sm">${speciesEmoji(s.species)}</span>
        <div class="min-w-0 flex-1">
          <p class="st-strong">${esc(s.pet_name)}${s.appointment_id ? ` <span class="st-chip is-app">${esc(T('fromApp'))}</span>` : ''}</p>
          <p class="st-muted truncate">${esc([s.owner_name, s.owner_phone].filter(Boolean).join(' · ') || speciesLabel(s.species))}</p>
        </div>
      </div>
      ${list.length ? `<p class="st-services">${list.map(n => `<span>${esc(n)}</span>`).join('')}</p>` : ''}
      ${flags.length || care.temperament ? `<p class="st-flags">${flags.map(f => `<span class="st-chip is-warn">${esc(f)}</span>`).join('')}${care.temperament ? `<span class="st-chip">${esc(care.temperament)}</span>` : ''}</p>` : ''}
      <p class="st-meta">${s.groomer_name ? `✂ ${esc(s.groomer_name)} · ` : ''}${esc(s.estimated_minutes)}′${Number(s.total_amount) ? ` · ${esc(baht(s.total_amount))}` : ''}</p>
      ${s.status === 'in_progress' ? `
        <div class="st-progress"><i style="width:${s.progress || 0}%"></i></div>
        <div class="st-progress-row"><span class="st-muted" data-elapsed="${esc(s.start_time || '')}"></span>${[50, 75].map(p => `<button type="button" class="so-tab" data-pct="${p}" data-id="${s.id}">${p}%</button>`).join('')}</div>` : ''}
      ${s.status === 'picked_up' || s.status === 'cancelled' || s.status === 'no_show' ? `<p class="st-muted">${esc(s.status === 'picked_up' ? T('pickedUp') : s.status === 'no_show' ? T('noShow') : `${T('cancel')}${s.cancelled_reason ? ` · ${s.cancelled_reason}` : ''}`)}</p>` : ''}
      ${next.length ? `<div class="st-card-actions">${next.map(([a, l, c]) => `<button type="button" class="ph-btn ${c}" data-step="${a}" data-id="${s.id}">${esc(T(l))}</button>`).join('')}</div>` : ''}
    </article>`;
}

function updateElapsed() {
  _container?.querySelectorAll('[data-elapsed]').forEach(e => {
    if (!e.dataset.elapsed) return;
    e.textContent = T('elapsed', { m: Math.max(0, Math.round((Date.now() - Date.parse(e.dataset.elapsed)) / 60000)) });
  });
}

async function call(s, action, body = {}) {
  const res = await apiFetch(`/api/grooming/${s.id}/${action}`, { method: 'PATCH', body: JSON.stringify({ store_id: _storeId, ...body }) }).catch(() => null);
  if (!res?.success) { showToast(apiError(res), 'error'); return null; }
  showToast(res.appointment_sync_error ? T('appSyncFail') : T('saved'), res.appointment_sync_error ? 'info' : 'success');
  return res.data;
}

async function step(s, action, btn) {
  if (action === 'complete') { openReport(s); return; }
  if (btn) btn.disabled = true;
  const done = await call(s, action);
  if (done) { if (action === 'arrive') _boardTab = 'waiting'; if (action === 'start') _boardTab = 'in_progress'; if (action === 'pickup') _boardTab = 'done'; load(); } else if (btn) btn.disabled = false;
}

async function setProgress(s, pct) {
  const res = await apiFetch(`/api/grooming/${s.id}`, { method: 'PATCH', body: JSON.stringify({ store_id: _storeId, progress: pct }) }).catch(() => null);
  if (res?.success) load(); else showToast(apiError(res), 'error');
}

async function catalog() {
  if (_catalog) return _catalog;
  const r = await apiFetch(`/api/service-items?store_id=${_storeId}&category=grooming`).catch(() => null);
  const items = (r?.data || []).map(s => ({ name: s.name, price: Number(s.price || 0) }));
  const li = ['th', 'en', 'zh', 'ja', 'ko'].indexOf(getLang());
  _catalog = items.length ? items : PRESETS.map(p => ({ name: p.name[li] || p.name[0], price: p.price }));
  return _catalog;
}

async function openBookingSheet({ when = null, walkIn = false, appointmentId = null, pet = null, services = [], notes = '', session = null } = {}) {
  const editing = Boolean(session);
  const sheet = openSheet({ title: editing ? `${T('edit')} · ${session.pet_name}` : walkIn ? T('walkIn') : appointmentId ? T('accept') : T('book'), wide: true });
  const items = await catalog();
  const selected = new Map((session?.services || services).map(s => (typeof s === 'string' ? [s, 0] : [s.name, Number(s.price || 0)])));
  for (const [n, p] of selected) { const c = items.find(i => i.name === n); if (c && !p) selected.set(n, c.price); }
  const care = session?.care_profile || {};
  const allServices = [...items, ...[...selected.keys()].filter(n => !items.some(i => i.name === n)).map(n => ({ name: n, price: selected.get(n) }))];

  sheet.body.innerHTML = `
    ${walkIn ? '' : `<section class="st-block"><p class="st-label">${esc(T('when'))}</p>
      <div class="st-grid2"><label class="cx-field"><span>${esc(T('date'))} · ${esc(T('time'))}</span><input type="datetime-local" step="900" data-when value="${esc(session?.scheduled_at ? toLocalInput(session.scheduled_at) : when || '')}"></label>
      <label class="cx-field"><span>${esc(T('duration'))}</span><input type="number" min="15" max="600" step="15" data-min value="${session?.estimated_minutes || 60}"></label></div>
      <p class="st-warn" data-overlap hidden></p></section>`}
    <section class="st-block"><p class="st-label">${esc(T('pet'))}</p><div data-picker></div></section>
    <section class="st-block"><p class="st-label">${esc(T('services'))}</p>
      <div class="st-service-pick">${allServices.map((s, i) => `<label><input type="checkbox" data-svc="${i}" ${selected.has(s.name) ? 'checked' : ''}><span>${esc(s.name)}</span><input type="number" min="0" step="10" data-svc-price="${i}" value="${selected.get(s.name) ?? s.price}" aria-label="${esc(T('price'))}"></label>`).join('')}</div>
      <div class="st-log-add"><input class="cx-search" data-custom placeholder="${esc(T('customService').replace('+ ', ''))}" maxlength="80"><button type="button" class="ph-btn" data-add-custom>${esc(T('add'))}</button></div>
    </section>
    <section class="st-block st-grid2">
      <label class="cx-field"><span>${esc(T('groomer'))}</span><input data-groomer list="st-groomers" maxlength="80" value="${esc(session?.groomer_name || '')}"><datalist id="st-groomers">${_groomers.map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
      ${walkIn ? `<label class="cx-field"><span>${esc(T('duration'))}</span><input type="number" min="15" max="600" step="15" data-min value="60"></label>` : ''}
    </section>
    <details class="st-details" ${editing || pet ? 'open' : ''}><summary>${esc(T('groomNotes'))}</summary>
      <div class="st-grid2">
        <label class="cx-field"><span>${esc(T('coat'))}</span><input data-c="coat" maxlength="200" value="${esc(care.coat || '')}"></label>
        <label class="cx-field"><span>${esc(T('size'))}</span><select class="st-select" data-c="size">${['', 'S', 'M', 'L', 'XL'].map(z => `<option value="${z}" ${care.size === z ? 'selected' : ''}>${z ? esc(T(`size${z}`)) : '—'}</option>`).join('')}</select></label>
        <label class="cx-field"><span>${esc(T('style'))}</span><input data-c="style" maxlength="200" value="${esc(care.style || '')}"></label>
        <label class="cx-field"><span>${esc(T('temper'))}</span><input data-c="temperament" maxlength="200" value="${esc(care.temperament || '')}"></label>
        <label class="cx-field"><span>${esc(T('skin'))}</span><input data-c="skin_notes" maxlength="300" value="${esc(care.skin_notes || '')}"></label>
      </div>
      <div class="st-checks">${[['muzzle', 'muzzle'], ['sensitive_skin', 'sensitive'], ['senior', 'senior'], ['matted', 'matted']].map(([k, l]) => `<label><input type="checkbox" data-c="${k}" ${care[k] ? 'checked' : ''}> ${esc(T(l))}</label>`).join('')}</div>
      <label class="cx-field"><span>${esc(T('notes'))}</span><textarea rows="2" data-notes maxlength="2000">${esc(session?.notes || notes || '')}</textarea></label>
    </details>`;
  sheet.foot.innerHTML = `<p class="st-total" data-total></p><span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('cancel'))}</button><button type="button" class="ph-btn is-primary" data-save>${esc(editing ? T('save') : walkIn ? T('arrived') : T('saveBooking'))}</button>`;
  const $ = s => sheet.body.querySelector(s);

  const picker = petPicker({ storeId: _storeId, initial: session ? { pet_id: session.pet_id, pet_name: session.pet_name, species: session.species, owner_name: session.owner_name, owner_phone: session.owner_phone, pet: session.pets } : pet });
  $('[data-picker]').appendChild(picker.el);

  const readServices = () => allServices.map((s, i) => ($(`[data-svc="${i}"]`)?.checked ? { name: s.name, price: Number($(`[data-svc-price="${i}"]`).value || 0) } : null)).filter(Boolean);
  const total = () => { sheet.foot.querySelector('[data-total]').innerHTML = `${esc(T('total'))} <b>${esc(baht(readServices().reduce((n, s) => n + s.price, 0)))}</b>`; };
  sheet.body.addEventListener('input', e => { if (e.target.matches('[data-svc],[data-svc-price]')) total(); if (e.target.matches('[data-when],[data-min],[data-groomer]')) checkOverlap(); });
  sheet.body.addEventListener('change', e => { if (e.target.matches('[data-svc]')) total(); });
  $('[data-add-custom]').onclick = () => {
    const name = $('[data-custom]').value.trim();
    if (!name) return;
    allServices.push({ name, price: 0 });
    const i = allServices.length - 1;
    $('.st-service-pick').insertAdjacentHTML('beforeend', `<label><input type="checkbox" data-svc="${i}" checked><span>${esc(name)}</span><input type="number" min="0" step="10" data-svc-price="${i}" value="0" aria-label="${esc(T('price'))}"></label>`);
    $('[data-custom]').value = '';
    total();
  };
  total();

  let others = [];
  async function checkOverlap() {
    const box = $('[data-overlap]');
    if (!box) return;
    const at = $('[data-when]').value, g = $('[data-groomer]').value.trim();
    if (!at || !g) { box.hidden = true; return; }
    const day = at.slice(0, 10);
    if (!others.day || others.day !== day) {
      const r = await apiFetch(`/api/grooming?store_id=${_storeId}&date=${day}`).catch(() => null);
      others = Object.assign(r?.data || [], { day });
    }
    const start = Date.parse(fromLocalInput(at)), end = start + Number($('[data-min]').value || 60) * 60000;
    const hit = others.find(o => o.id !== session?.id && o.groomer_name === g && o.scheduled_at && !['cancelled', 'no_show', 'picked_up'].includes(o.status)
      && Date.parse(o.scheduled_at) < end && Date.parse(o.scheduled_at) + o.estimated_minutes * 60000 > start);
    box.hidden = !hit;
    if (hit) box.textContent = T('overlap', { g, t: fmtTime(hit.scheduled_at) });
  }

  sheet.foot.querySelector('[data-save]').onclick = async e => {
    const p = picker.get();
    if (!p) { showToast(T('pet_required'), 'error'); return; }
    const careOut = {};
    sheet.body.querySelectorAll('[data-c]').forEach(i => { careOut[i.dataset.c] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
    const body = {
      store_id: _storeId, pet_id: p.pet_id, pet_name: p.pet_name, species: p.species, owner_name: p.owner_name, owner_phone: p.owner_phone,
      services: readServices(), groomer_name: $('[data-groomer]').value.trim(), estimated_minutes: Number($('[data-min]')?.value || 60),
      care_profile: careOut, notes: $('[data-notes]').value.trim(),
    };
    if (!walkIn) body.scheduled_at = fromLocalInput($('[data-when]').value);
    if (!editing) { body.appointment_id = appointmentId; body.arrived_now = walkIn; }
    e.target.disabled = true;
    const res = await apiFetch(editing ? `/api/grooming/${session.id}` : '/api/grooming', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) }).catch(() => null);
    if (!res?.success) { showToast(apiError(res), 'error'); e.target.disabled = false; return; }
    showToast(res.appointment_sync_error ? T('appSyncFail') : T('saved'), res.appointment_sync_error ? 'info' : 'success');
    if (!editing && body.scheduled_at) { _date = toLocalInput(body.scheduled_at).slice(0, 10); _container.querySelector('[data-date]').value = _date; }
    _boardTab = walkIn ? 'waiting' : _boardTab;
    sheet.close(); load();
  };
}

async function openDetail(s) {
  const sheet = openSheet({ title: `${s.pet_name}`, subtitle: s.scheduled_at ? `${fmtDay(toLocalInput(s.scheduled_at).slice(0, 10), { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(s.scheduled_at)}` : '', wide: true });
  const r = await apiFetch(`/api/grooming/${s.id}?store_id=${_storeId}`).catch(() => null);
  const full = r?.data || s;
  const care = full.care_profile || {};
  const list = (full.services || []).map(x => (typeof x === 'string' ? { name: x, price: 0 } : x));
  const rep = full.health_report || null;
  const kv = (l, v) => v ? `<div class="st-kv"><span>${esc(l)}</span><p>${esc(v)}</p></div>` : '';
  sheet.body.innerHTML = `
    <div class="st-detail-head">
      <span class="st-avatar is-lg">${full.pets?.avatar_url ? `<img src="${esc(full.pets.avatar_url)}" alt="">` : speciesEmoji(full.species)}</span>
      <div class="min-w-0 flex-1">
        <p class="st-strong">${esc(full.pet_name)} <span class="st-muted">· ${esc(speciesLabel(full.species))}</span> <span class="st-status is-g-${full.status}">${esc(T(`col_${COLS.includes(full.status) ? full.status : 'closed'}`))}</span></p>
        <p class="st-muted">${esc([full.owner_name, full.owner_phone].filter(Boolean).join(' · ') || '—')}${full.owner_phone ? ` · <a class="st-link" href="tel:${esc(full.owner_phone.replace(/[^\d+]/g, ''))}">${esc(T('phone'))}</a>` : ''}</p>
        ${petFacts(full.pets)}
      </div>
    </div>
    <section class="st-block"><p class="st-label">${esc(T('services'))}</p>
      <dl class="st-bill">${list.map(x => `<div><dt>${esc(x.name)}</dt><dd>${esc(baht(x.price))}</dd></div>`).join('')}<div class="is-total"><dt>${esc(T('total'))}</dt><dd>${esc(baht(full.total_amount))}</dd></div></dl>
      <p class="st-meta">${full.groomer_name ? `✂ ${esc(full.groomer_name)} · ` : ''}${esc(full.estimated_minutes)}′</p>
    </section>
    <section class="st-block"><p class="st-label">${esc(T('groomNotes'))}</p>
      ${kv(T('coat'), care.coat)}${kv(T('size'), care.size ? T(`size${care.size}`) : '')}${kv(T('style'), care.style)}${kv(T('temper'), care.temperament)}${kv(T('skin'), care.skin_notes)}
      <p class="st-flags">${[care.muzzle && T('muzzle'), care.sensitive_skin && T('sensitive'), care.senior && T('senior'), care.matted && T('matted')].filter(Boolean).map(f => `<span class="st-chip is-warn">${esc(f)}</span>`).join('')}</p>
      ${kv(T('notes'), full.notes)}
    </section>
    ${rep ? `<section class="st-block"><p class="st-label">${esc(T('report'))}</p>${['skin', 'ears', 'nails', 'teeth', 'parasites'].map(k => kv(T(`r${k[0].toUpperCase()}${k.slice(1)}`), rep[k])).join('')}${kv(T('rNote'), rep.note)}</section>` : ''}`;

  const acts = [];
  if (['booked', 'waiting'].includes(full.status)) acts.push(`<button type="button" class="ph-btn is-danger" data-a="cancel">${esc(T('cancelAppt'))}</button>`);
  if (full.status === 'booked') acts.push(`<button type="button" class="ph-btn" data-a="no-show">${esc(T('noShow'))}</button>`);
  acts.push('<span class="flex-1"></span>');
  if (rep) acts.push(`<button type="button" class="ph-btn" data-a="print">${esc(T('printReport'))}</button>`);
  if (!['picked_up', 'cancelled', 'no_show'].includes(full.status)) acts.push(`<button type="button" class="ph-btn" data-a="edit">${esc(T('edit'))}</button>`);
  const next = { booked: ['arrive', 'arrived'], waiting: ['start', 'start'], in_progress: ['complete', 'finish'], done: ['pickup', 'pickedUp'] }[full.status];
  if (next) acts.push(`<button type="button" class="ph-btn is-primary" data-a="${next[0]}">${esc(T(next[1]))}</button>`);
  sheet.foot.innerHTML = acts.join('');
  sheet.foot.querySelectorAll('[data-a]').forEach(b => {
    b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'edit') { sheet.close(); openBookingSheet({ session: full }); return; }
      if (a === 'print') { printReport(full); return; }
      if (a === 'complete') { sheet.close(); openReport(full); return; }
      if (a === 'cancel') {
        const reason = await askReason(openSheet, { title: T('cancelAppt'), presets: T('cancelPresets').split(',') });
        if (!reason) return;
        if (await call(full, 'cancel', { reason })) { sheet.close(); load(); }
        return;
      }
      b.disabled = true;
      if (await call(full, a)) { sheet.close(); load(); } else b.disabled = false;
    };
  });
}

function openReport(s) {
  const sheet = openSheet({ title: `${T('report')} · ${s.pet_name}` });
  const rows = [['skin', 'rSkin'], ['ears', 'rEars'], ['nails', 'rNails'], ['teeth', 'rTeeth'], ['parasites', 'rParasites']];
  sheet.body.innerHTML = `${rows.map(([k, l]) => `<label class="cx-field"><span>${esc(T(l))}</span><input data-r="${k}" placeholder="${esc(T('normal'))}" maxlength="200"></label>`).join('')}
    <label class="cx-field"><span>${esc(T('rNote'))}</span><textarea rows="3" data-r="note" maxlength="1000"></textarea></label>`;
  sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('cancel'))}</button><button type="button" class="ph-btn is-primary" data-ok>${esc(T('finish'))}</button>`;
  sheet.foot.querySelector('[data-ok]').onclick = async e => {
    e.target.disabled = true;
    const report = Object.fromEntries([...sheet.body.querySelectorAll('[data-r]')].map(i => [i.dataset.r, i.value.trim() || (i.dataset.r === 'note' ? '' : T('normal'))]));
    if (await call(s, 'complete', { health_report: report })) { _boardTab = 'done'; sheet.close(); load(); } else e.target.disabled = false;
  };
}

function printReport(s) {
  const rep = s.health_report || {};
  const w = window.open('', '_blank', 'noopener,width=480,height=640');
  if (!w) return;
  const row = (l, v) => v ? `<tr><th>${esc(l)}</th><td>${esc(v)}</td></tr>` : '';
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(T('report'))}</title>
    <style>body{font:14px/1.6 system-ui,sans-serif;padding:24px;color:#1d3640}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 16px;color:#5e7379}table{width:100%;border-collapse:collapse}th{text-align:left;width:40%;color:#5e7379;font-weight:500}th,td{padding:6px 0;border-bottom:1px solid #e4eae9}</style>
    <h1>${esc(T('report'))} · ${esc(s.pet_name)}</h1><p>${esc(fmtDay(todayBkk(), { day: 'numeric', month: 'long', year: 'numeric' }))}${s.groomer_name ? ` · ${esc(s.groomer_name)}` : ''}</p>
    <table>${row(T('services'), (s.services || []).map(x => (typeof x === 'string' ? x : x.name)).join(', '))}${row(T('rSkin'), rep.skin)}${row(T('rEars'), rep.ears)}${row(T('rNails'), rep.nails)}${row(T('rTeeth'), rep.teeth)}${row(T('rParasites'), rep.parasites)}${row(T('rNote'), rep.note)}</table>`);
  w.document.close();
  w.focus();
  w.print();
}
