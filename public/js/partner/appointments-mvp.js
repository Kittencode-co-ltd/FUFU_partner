// Appointments (front desk): requests from the FUFU app and upcoming bookings, grouped by day, with the next step
// as a button on each row. Proposing a new time uses date and time pickers; rejecting and cancelling ask for a
// reason in a sheet. The 7-day calendar shows the same bookings as a week grid.
// API: server/routes/appointments.js (list, calendar, transition). Styles: .ap-* in src/css/input.css.
import { apiFetch } from '../utils/api-client.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { storage } from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { icon, speciesIcon } from '../utils/icons.js';
import { openSheet } from './sheet.js';

const LABEL = {
  requested: 'รอยืนยัน', reschedule_proposed: 'เสนอเวลาใหม่แล้ว', confirmed: 'ยืนยันแล้ว', checked_in: 'มาถึงแล้ว',
  completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก', no_show: 'ไม่มาตามนัด', rejected: 'ปฏิเสธ',
};
const TONE = {
  requested: 'is-warn', reschedule_proposed: 'is-info', confirmed: 'is-ok', checked_in: 'is-live',
  completed: 'is-done', cancelled: 'is-muted', no_show: 'is-bad', rejected: 'is-muted',
};
const ACTION = {
  confirmed: 'ยืนยันนัด', reschedule_proposed: 'เสนอเวลาใหม่', rejected: 'ปฏิเสธ', cancelled: 'ยกเลิกนัด',
  checked_in: 'เช็กอิน', no_show: 'ไม่มาตามนัด', completed: 'เสร็จสิ้น',
};
// Next steps per status, most common first. The first one is the primary button.
const NEXT = {
  requested: ['confirmed', 'reschedule_proposed', 'rejected'],
  reschedule_proposed: ['confirmed', 'rejected'],
  confirmed: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['completed'],
};
const CATEGORY = { Vet: 'ตรวจรักษา', Hotel: 'ฝากเลี้ยง', Grooming: 'อาบน้ำตัดขน' };
const TABS = [['requested', 'คำขอ'], ['upcoming', 'กำลังจะมาถึง'], ['history', 'ประวัติ']];
const REJECT_PRESETS = ['คิวเต็มในวันและเวลาที่เลือก', 'คลินิกปิดทำการวันนั้น', 'บริการนี้ยังไม่พร้อมให้บริการ', 'ข้อมูลไม่ครบ กรุณาติดต่อคลินิก'];
const CANCEL_PRESETS = ['ลูกค้าแจ้งยกเลิก', 'สัตวแพทย์ไม่ว่าง', 'คลินิกปิดฉุกเฉิน'];

let bucket = 'requested';
let search = '';
let weekOffset = 0;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const storeId = () => storage.get(STORAGE_KEYS.STORE_ID);
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const apptDate = a => String(a.appt_date || a.starts_at || '').slice(0, 10);
const apptTime = a => String(a.appt_time || a.appt_time_slot || String(a.starts_at || '').slice(11, 16) || '').slice(0, 5);
const tel = p => String(p || '').replace(/[^\d+]/g, '');

function dayLabel(key) {
  if (!key) return 'ไม่ระบุวัน';
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const d = new Date(`${key}T00:00:00`);
  const full = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
  if (key === dateKey(today)) return `วันนี้ · ${full}`;
  if (key === dateKey(tomorrow)) return `พรุ่งนี้ · ${full}`;
  if (key === dateKey(yesterday)) return `เมื่อวาน · ${full}`;
  return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
}

export async function renderAppointments(container, view = 'inbox') {
  if (view === 'calendar') return renderCalendar(container);
  container.innerHTML = shell('<div class="skeleton ph-skel"></div><div class="skeleton ph-skel"></div>');
  const [list, count] = await Promise.all([
    apiFetch(`/api/appointments?store_id=${storeId()}&bucket=${bucket}&limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`).catch(() => null),
    apiFetch(`/api/appointments/count?store_id=${storeId()}`).catch(() => null),
  ]);
  if (!list?.success) {
    container.innerHTML = shell(`<div class="ph-section ap-error"><p>โหลดนัดหมายไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่</p><button type="button" class="ph-btn is-primary" data-retry>ลองอีกครั้ง</button></div>`);
    container.querySelector('[data-retry]').onclick = () => renderAppointments(container);
    bindShell(container);
    return;
  }
  const rows = list.data || [];
  container.innerHTML = shell(rows.length ? groups(rows) : empty(), count?.count);
  bindShell(container);
  bindRows(container, rows);
}

function shell(body, requestedCount) {
  return `
    <div class="ap-page">
      <header class="ph-head">
        <div><h1 class="ph-title">นัดหมาย</h1><p class="ph-sub">คำขอจองจากแอป FUFU และนัดที่กำลังจะมาถึง</p></div>
        <label class="ap-search">${icon('search', 'w-4 h-4')}<input type="search" data-search placeholder="ค้นหาชื่อสัตว์" value="${esc(search)}" aria-label="ค้นหาชื่อสัตว์"></label>
      </header>
      <nav class="ap-tabs" role="tablist" aria-label="รายการนัดหมาย">
        ${TABS.map(([id, label]) => `<button type="button" role="tab" data-bucket="${id}" aria-selected="${bucket === id}">${label}${id === 'requested' && requestedCount ? `<span>${requestedCount}</span>` : ''}</button>`).join('')}
      </nav>
      <div class="ap-list" data-list>${body}</div>
    </div>`;
}

function empty() {
  const text = { requested: ['ไม่มีคำขอรอยืนยัน', 'คำขอใหม่จากแอป FUFU จะขึ้นที่นี่ และมีตัวเลขแจ้งที่เมนู'], upcoming: ['ยังไม่มีนัดที่กำลังจะมาถึง', 'นัดที่ยืนยันแล้วจะเรียงตามวันและเวลาที่นี่'], history: ['ยังไม่มีประวัติ', 'นัดที่เสร็จสิ้น ยกเลิก หรือไม่มาตามนัด จะอยู่ที่นี่'] }[bucket];
  return `<div class="ph-section ap-empty">${icon('calendar-alt', 'w-7 h-7')}<b>${text[0]}</b><p>${search ? `ไม่พบ "${esc(search)}"` : text[1]}</p></div>`;
}

function groups(rows) {
  const byDay = new Map();
  for (const a of rows) {
    const k = apptDate(a);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(a);
  }
  return [...byDay].map(([k, items]) => `
    <section class="ap-day">
      <h2>${esc(dayLabel(k))}<span>${items.length} นัด</span></h2>
      <div class="ph-section ap-rows">${items.map(row).join('')}</div>
    </section>`).join('');
}

function row(a) {
  const status = a.status;
  const next = NEXT[status] || [];
  const owner = a.owner?.name || (a.user_id ? 'ลูกค้าจากแอป FUFU' : 'ลูกค้า');
  const phone = a.owner?.phone;
  const service = a.service?.name || (Array.isArray(a.services) ? a.services.join(', ') : a.service_type) || CATEGORY[a.category] || '';
  const species = a.pet?.species;
  const stay = a.category === 'Hotel' && a.check_in_date && a.check_out_date
    ? `<span class="ap-chip">${icon('bed', 'w-3.5 h-3.5')}เข้าพัก ${esc(shortDate(a.check_in_date))} – ${esc(shortDate(a.check_out_date))}</span>` : '';
  const proposed = status === 'reschedule_proposed' && a.proposed_starts_at
    ? `<span class="ap-chip is-info">${icon('clock', 'w-3.5 h-3.5')}เสนอ ${esc(new Date(a.proposed_starts_at).toLocaleString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · รอลูกค้าตอบ</span>` : '';
  const note = a.customer_notes ? `<p class="ap-note">${icon('comment', 'w-3.5 h-3.5')}${esc(a.customer_notes)}</p>` : '';
  const why = (status === 'rejected' && a.rejection_reason) || (status === 'cancelled' && a.cancellation_reason)
    ? `<p class="ap-note is-muted">เหตุผล: ${esc(a.rejection_reason || a.cancellation_reason)}</p>` : '';
  return `
    <article class="ap-row" data-row="${esc(a.id)}">
      <div class="ap-time"><b>${esc(apptTime(a) || '–')}</b><span>${esc(CATEGORY[a.category] || '')}</span></div>
      <span class="ap-avatar">${speciesIcon(species, 'w-5 h-5')}</span>
      <div class="ap-main">
        <div class="ap-title"><b>${esc(a.pet_name || 'ไม่ระบุชื่อสัตว์')}</b>${a.pet?.breed ? `<small>${esc(a.pet.breed)}</small>` : ''}<span class="ap-status ${TONE[status] || ''}">${esc(LABEL[status] || status)}</span></div>
        <p class="ap-meta">${esc(service)}${service ? ' · ' : ''}${esc(owner)}${phone ? ` · <a href="tel:${esc(tel(phone))}" class="ap-phone">${icon('phone-call', 'w-3.5 h-3.5')}${esc(phone)}</a>` : ''}</p>
        ${stay || proposed ? `<div class="ap-chips">${stay}${proposed}</div>` : ''}
        ${note}${why}
      </div>
      ${next.length ? `<div class="ap-actions">${next.map((x, i) => `<button type="button" class="ph-btn ${i === 0 ? 'is-primary' : x === 'rejected' || x === 'cancelled' || x === 'no_show' ? 'is-quiet-danger' : ''}" data-action="${x}" data-id="${esc(a.id)}">${ACTION[x]}</button>`).join('')}</div>` : ''}
    </article>`;
}

const shortDate = s => new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

function bindShell(container) {
  container.querySelectorAll('[data-bucket]').forEach(b => { b.onclick = () => { bucket = b.dataset.bucket; renderAppointments(container); }; });
  const input = container.querySelector('[data-search]');
  let t;
  input?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { search = input.value.trim(); renderAppointments(container).then(() => { const i = container.querySelector('[data-search]'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }); }, 350); });
}

function bindRows(container, rows) {
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = async () => {
      const a = rows.find(r => r.id === btn.dataset.id);
      const to = btn.dataset.action;
      let extra = {};
      if (to === 'rejected') { const reason = await askReason('ปฏิเสธคำขอจอง', 'ลูกค้าจะเห็นเหตุผลนี้ในแอป', REJECT_PRESETS, true, 'ยืนยันการปฏิเสธ'); if (!reason) return; extra = { reason }; }
      else if (to === 'cancelled') { const reason = await askReason('ยกเลิกนัด', 'ลูกค้าจะได้รับแจ้งการยกเลิก', CANCEL_PRESETS, false, 'ยกเลิกนัด'); if (reason === null) return; extra = { reason }; }
      else if (to === 'reschedule_proposed') { const r = await askNewTime(a); if (!r) return; extra = r; }
      btn.disabled = true;
      const res = await apiFetch(`/api/appointments/${btn.dataset.id}/transition`, {
        method: 'PATCH', headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ store_id: storeId(), status: to, reason: extra.reason || null, proposed_starts_at: extra.proposed_starts_at || null }),
      }).catch(() => null);
      if (!res?.success) { btn.disabled = false; showToast(res?.error || 'อัปเดตไม่สำเร็จ ลองอีกครั้ง', 'error'); return; }
      showToast({ confirmed: 'ยืนยันนัดแล้ว ลูกค้าได้รับแจ้ง', reschedule_proposed: 'ส่งเวลาใหม่ให้ลูกค้าแล้ว', rejected: 'ปฏิเสธคำขอแล้ว', cancelled: 'ยกเลิกนัดแล้ว', checked_in: 'เช็กอินแล้ว', no_show: 'บันทึกว่าไม่มาตามนัด', completed: 'ปิดนัดแล้ว' }[to] || 'อัปเดตแล้ว', 'success');
      renderAppointments(container);
    };
  });
}

/** Reason sheet with one-tap presets. Resolves the text, '' when optional and left empty, or null when closed. */
function askReason(title, subtitle, presets, required, submitLabel) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const sheet = openSheet({ title, subtitle, onClose: () => finish(null) });
    sheet.body.innerHTML = `
      <div class="ap-presets">${presets.map(p => `<button type="button" class="ap-preset" data-preset>${esc(p)}</button>`).join('')}</div>
      <label class="cx-field"><span>เหตุผล${required ? ' <b aria-hidden="true">*</b>' : ' (ไม่บังคับ)'}</span><textarea rows="3" maxlength="1000" data-reason placeholder="พิมพ์เหตุผล หรือเลือกด้านบน"></textarea></label>
      <p class="ap-err" data-error role="alert" hidden>กรุณาระบุเหตุผล</p>`;
    const ta = sheet.body.querySelector('[data-reason]');
    sheet.body.querySelectorAll('[data-preset]').forEach(b => { b.onclick = () => { ta.value = b.textContent; sheet.body.querySelectorAll('[data-preset]').forEach(x => x.classList.toggle('is-on', x === b)); }; });
    sheet.foot.innerHTML = `<button type="button" class="ph-btn" data-cancel>ปิด</button><button type="button" class="ph-btn is-primary" data-submit>${esc(submitLabel)}</button>`;
    sheet.foot.querySelector('[data-cancel]').onclick = () => { finish(null); sheet.close(); };
    sheet.foot.querySelector('[data-submit]').onclick = () => {
      const v = ta.value.trim();
      if (required && !v) { sheet.body.querySelector('[data-error]').hidden = false; ta.focus(); return; }
      finish(v); sheet.close();
    };
  });
}

/** Propose another date and time: date picker + time chips (every 30 min, 08:00–20:00). */
function askNewTime(a) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const sheet = openSheet({ title: `เสนอเวลาใหม่ · ${a?.pet_name || ''}`, subtitle: 'ลูกค้าจะได้รับแจ้งและกดยืนยันเวลาใหม่ในแอป', onClose: () => finish(null) });
    const today = dateKey(new Date());
    const slots = [];
    for (let m = 8 * 60; m <= 20 * 60; m += 30) slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    const start = apptDate(a) >= today ? apptDate(a) : today;
    sheet.body.innerHTML = `
      <p class="ap-was">${icon('clock', 'w-4 h-4')}เวลาเดิม: ${esc(dayLabel(apptDate(a)))} ${esc(apptTime(a))} น.</p>
      <label class="cx-field"><span>วันที่</span><input type="date" data-date min="${today}" value="${esc(start)}"></label>
      <div class="cx-field"><span>เวลา</span><div class="ap-slots" role="radiogroup" aria-label="เวลา">${slots.map(s => `<button type="button" role="radio" aria-checked="false" data-slot="${s}">${s}</button>`).join('')}</div></div>
      <label class="cx-field"><span>ข้อความถึงลูกค้า (ไม่บังคับ)</span><textarea rows="2" maxlength="500" data-reason placeholder="เช่น ช่วงเช้าคิวเต็ม ขอเลื่อนเป็นช่วงบ่าย"></textarea></label>
      <p class="ap-err" data-error role="alert" hidden>เลือกวันที่และเวลา</p>`;
    let slot = '';
    sheet.body.querySelectorAll('[data-slot]').forEach(b => { b.onclick = () => { slot = b.dataset.slot; sheet.body.querySelectorAll('[data-slot]').forEach(x => x.setAttribute('aria-checked', String(x === b))); }; });
    sheet.foot.innerHTML = `<button type="button" class="ph-btn" data-cancel>ปิด</button><button type="button" class="ph-btn is-primary" data-submit>ส่งเวลาใหม่</button>`;
    sheet.foot.querySelector('[data-cancel]').onclick = () => { finish(null); sheet.close(); };
    sheet.foot.querySelector('[data-submit]').onclick = () => {
      const d = sheet.body.querySelector('[data-date]').value;
      if (!d || !slot) { sheet.body.querySelector('[data-error]').hidden = false; return; }
      finish({ proposed_starts_at: `${d}T${slot}:00+07:00`, reason: sheet.body.querySelector('[data-reason]').value.trim() || null });
      sheet.close();
    };
  });
}

// ── Week calendar ─────────────────────────────────────────────────────────────
async function renderCalendar(container) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);  // Monday
  const to = new Date(from); to.setDate(to.getDate() + 7);
  const days = [...Array(7)].map((_, i) => { const d = new Date(from); d.setDate(d.getDate() + i); return d; });
  const range = `${from.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  container.innerHTML = calShell(range, '<div class="skeleton ph-skel" style="height:320px"></div>');
  bindCal(container);
  const r = await apiFetch(`/api/appointments/calendar?store_id=${storeId()}&from=${dateKey(from)}T00:00:00&to=${dateKey(to)}T00:00:00`).catch(() => null);
  const rows = (r?.data || []).filter(a => !['cancelled', 'rejected'].includes(a.status));
  const todayKey = dateKey(new Date());
  const body = `<div class="ap-week">${days.map(d => {
    const k = dateKey(d);
    const items = rows.filter(a => apptDate(a) === k);
    return `<section class="ap-wday ${k === todayKey ? 'is-today' : ''}">
      <h3><span>${d.toLocaleDateString('th-TH', { weekday: 'short' })}</span><b>${d.getDate()}</b>${items.length ? `<em>${items.length}</em>` : ''}</h3>
      ${items.length ? items.map(a => `<div class="ap-wchip ${TONE[a.status] || ''}"><b>${esc(apptTime(a))}</b><span>${esc(a.pet_name || '')}</span><small>${esc(LABEL[a.status] || '')}</small></div>`).join('') : '<p class="ap-wempty">ว่าง</p>'}
    </section>`;
  }).join('')}</div>`;
  container.querySelector('[data-list]').innerHTML = r?.success ? body : '<div class="ph-section ap-error"><p>โหลดปฏิทินไม่สำเร็จ</p></div>';
}

function calShell(range, body) {
  return `
    <div class="ap-page">
      <header class="ph-head">
        <div><h1 class="ph-title">ปฏิทินนัดหมาย</h1><p class="ph-sub">${esc(range)}</p></div>
        <div class="ap-weeknav">
          <button type="button" class="ph-btn" data-week="-1" aria-label="สัปดาห์ก่อน">${icon('chevron-left', 'w-4 h-4')}</button>
          <button type="button" class="ph-btn" data-week="0">สัปดาห์นี้</button>
          <button type="button" class="ph-btn" data-week="1" aria-label="สัปดาห์ถัดไป">${icon('chevron-right', 'w-4 h-4')}</button>
        </div>
      </header>
      <div data-list>${body}</div>
    </div>`;
}

function bindCal(container) {
  container.querySelectorAll('[data-week]').forEach(b => { b.onclick = () => { const v = Number(b.dataset.week); weekOffset = v === 0 ? 0 : weekOffset + v; renderCalendar(container); }; });
}
