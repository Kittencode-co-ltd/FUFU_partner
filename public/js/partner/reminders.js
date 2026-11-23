// "เตือนลูกค้าอัตโนมัติ" card on the store settings page: vaccine and appointment reminders that the database sends
// to customers' FUFU app every morning at 08:00, the owner's settings, and (clinics) vaccines due in the next 30 days.
// API: server/routes/reminders.js. Styles: .rm-* in src/css/input.css.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { icon, speciesIcon } from '../utils/icons.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const DAY_CHOICES = [[14, '14 วันก่อน'], [7, '7 วันก่อน'], [3, '3 วันก่อน'], [1, '1 วันก่อน'], [0, 'วันที่ครบ']];
const pad = n => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const daysUntil = key => Math.round((new Date(`${key}T00:00:00`) - new Date(`${todayKey()}T00:00:00`)) / 864e5);
const thaiDate = key => new Date(`${key}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

export async function renderReminderCard(el, { canEdit = false, isClinic = false } = {}) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  el.innerHTML = `<div class="card p-5"><div class="cl-skel"></div></div>`;
  const r = await apiFetch(`/api/reminders?store_id=${storeId}`).catch(() => null);
  if (!r?.success) { el.innerHTML = ''; return; }
  const state = { ...r.data.settings };
  const due = r.data.due || [];

  const draw = () => {
    const showAll = el.dataset.all === '1';
    el.innerHTML = `
      <section class="card p-5 rm-card">
        <header class="cb-head">
          <span class="cb-ic">${icon('bell', 'w-5 h-5')}</span>
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-bold text-navy">เตือนลูกค้าอัตโนมัติ</h2>
            <p class="text-sm text-slate-500 mt-0.5">ส่งแจ้งเตือนในแอป FUFU ให้ลูกค้าฟรี ทุกเช้า 08:00 · 30 วันที่ผ่านมาส่งไป <b>${Number(r.data.sent_30d || 0).toLocaleString('th-TH')}</b> ครั้ง</p>
          </div>
        </header>
        <div class="rm-rows">
          ${isClinic ? `
          <div class="rm-row">
            <div class="min-w-0 flex-1"><b>เตือนวัคซีนครบกำหนด</b><small>จากวันนัดวัคซีนครั้งถัดไปที่บันทึกในประวัติวัคซีน</small>
              <div class="rm-days" role="group" aria-label="เตือนล่วงหน้า">
                ${DAY_CHOICES.map(([d, label]) => `<button type="button" class="rm-day" data-day="${d}" aria-pressed="${state.vaccine_days.includes(d)}" ${canEdit && state.vaccine_enabled ? '' : 'disabled'}>${label}</button>`).join('')}
              </div>
            </div>
            <button type="button" class="pm-switch rm-switch" role="switch" aria-checked="${state.vaccine_enabled}" aria-label="เตือนวัคซีน" data-toggle="vaccine_enabled" ${canEdit ? '' : 'disabled'}><span aria-hidden="true"></span></button>
          </div>` : ''}
          <div class="rm-row">
            <div class="min-w-0 flex-1"><b>เตือนนัดหมายล่วงหน้า 1 วัน</b><small>นัดที่ยืนยันแล้วของลูกค้าที่จองผ่านแอป ช่วยลดการไม่มาตามนัด</small></div>
            <button type="button" class="pm-switch rm-switch" role="switch" aria-checked="${state.appointment_enabled}" aria-label="เตือนนัดหมาย" data-toggle="appointment_enabled" ${canEdit ? '' : 'disabled'}><span aria-hidden="true"></span></button>
          </div>
        </div>
        ${canEdit ? '' : '<p class="cl-muted">เจ้าของร้านเป็นผู้เปลี่ยนการตั้งค่า</p>'}
        ${isClinic ? `
        <div class="rm-due">
          <p class="cl-people__head">วัคซีนที่ใกล้ครบใน 30 วัน <span>${due.length}</span></p>
          ${due.length ? `<ul>${(showAll ? due : due.slice(0, 6)).map(dueRow).join('')}</ul>
            ${due.length > 6 ? `<button type="button" class="ph-link" data-more>${showAll ? 'แสดงน้อยลง' : `ดูทั้งหมด ${due.length} รายการ`}</button>` : ''}`
            : '<p class="cl-empty">ยังไม่มีวัคซีนที่ใกล้ครบกำหนด ใส่วันนัดครั้งถัดไปตอนบันทึกวัคซีน ระบบจะเตือนลูกค้าให้เอง</p>'}
        </div>` : ''}
        <p class="cl-note">${icon('shield-alt', 'w-4 h-4')}ลูกค้าที่ยังไม่ได้ใช้แอป FUFU จะไม่ได้รับแจ้งเตือน ส่งรหัสเชื่อมแอปให้ได้จากรายชื่อเจ้าของ</p>
      </section>`;
    bind();
  };

  const save = async () => {
    const res = await apiFetch('/api/reminders/settings', { method: 'PUT', body: JSON.stringify({ store_id: storeId, ...state }) }).catch(() => null);
    showToast(res?.success ? 'บันทึกการเตือนแล้ว' : 'บันทึกไม่สำเร็จ ลองอีกครั้ง', res?.success ? 'success' : 'error');
  };

  const bind = () => {
    el.querySelectorAll('[data-toggle]').forEach(b => { b.onclick = () => { const k = b.dataset.toggle; state[k] = !state[k]; draw(); save(); }; });
    el.querySelectorAll('[data-day]').forEach(b => {
      b.onclick = () => {
        const d = Number(b.dataset.day);
        const has = state.vaccine_days.includes(d);
        if (has && state.vaccine_days.length === 1) { showToast('เลือกไว้อย่างน้อย 1 ช่วงเวลา', 'error'); return; }
        state.vaccine_days = has ? state.vaccine_days.filter(x => x !== d) : [...state.vaccine_days, d].sort((a, z) => z - a);
        draw(); save();
      };
    });
    el.querySelector('[data-more]')?.addEventListener('click', () => { el.dataset.all = el.dataset.all === '1' ? '' : '1'; draw(); });
  };

  draw();
}

function dueRow(v) {
  const n = daysUntil(v.due_date);
  const when = n < 0 ? `เลยกำหนด ${-n} วัน` : n === 0 ? 'ครบวันนี้' : `อีก ${n} วัน`;
  const status = !v.on_app ? ['is-muted', 'ไม่ได้ใช้แอป'] : v.reminded_at ? ['is-ok', 'เตือนในแอปแล้ว'] : ['is-info', 'จะเตือนอัตโนมัติ'];
  return `<li>
    <span class="ap-avatar">${speciesIcon(v.species, 'w-4 h-4')}</span>
    <div class="min-w-0 flex-1">
      <b>${esc(v.pet_name)}</b> <small>${esc(v.vaccine_name || 'วัคซีน')}</small>
      <small class="rm-owner">${esc(v.owner_name || '')}${v.owner_phone ? ` · ${esc(v.owner_phone)}` : ''}</small>
    </div>
    <div class="rm-when ${n < 0 ? 'is-late' : n <= 7 ? 'is-soon' : ''}"><b>${esc(when)}</b><small>${esc(thaiDate(v.due_date))}</small></div>
    <span class="ap-status ${status[0]}">${status[1]}</span>
  </li>`;
}
