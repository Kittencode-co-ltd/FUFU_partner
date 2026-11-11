import { apiFetch } from '../utils/api-client.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { storage } from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { escapeHtml } from '../utils/formatters.js';

const DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

export async function renderClinicProfile(container) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const role = storage.get(STORAGE_KEYS.STAFF_ROLE) || 'owner';
  const canEdit = role === 'owner';
  if (!storeId) return renderError(container, 'ยังไม่ได้เลือกคลินิก');
  container.innerHTML = '<div class="card p-8 text-center text-slate-400">กำลังโหลดข้อมูลคลินิก...</div>';
  const [profileRes, hoursRes, holidaysRes, servicesRes] = await Promise.all([
    apiFetch(`/api/clinic/${storeId}`),
    apiFetch(`/api/clinic/${storeId}/hours`),
    apiFetch(`/api/clinic/${storeId}/holidays`),
    apiFetch(`/api/clinic/${storeId}/services`),
  ]);
  if (!profileRes?.success) return renderError(container, profileRes?.error || 'โหลดข้อมูลคลินิกไม่สำเร็จ');
  render(container, { storeId, canEdit, profile: profileRes.data, hours: hoursRes?.data || [], holidays: holidaysRes?.data || [], services: servicesRes?.data || [] });
}

function render(container, state) {
  const { profile, hours, holidays, services, canEdit } = state;
  const hoursByDay = new Map(hours.map(item => [Number(item.day_of_week), item]));
  container.innerHTML = `
    <div class="space-y-5">
      <div class="card p-5 space-y-4">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div><h2 class="text-lg font-bold text-navy">ข้อมูลคลินิก</h2><p class="text-sm text-slate-400">ข้อมูลนี้แสดงใน FUFU Mobile</p></div>
          <label class="flex items-center gap-2 text-sm font-semibold ${canEdit ? '' : 'opacity-60'}">
            <input id="accepting" type="checkbox" class="accent-primary" ${profile.accepting_appointments ? 'checked' : ''} ${canEdit ? '' : 'disabled'}> เปิดรับนัดหมาย
          </label>
        </div>
        <div class="flex items-center gap-4">
          <div class="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
            ${profile.logo_url ? `<img src="${escapeHtml(profile.logo_url)}" alt="โลโก้คลินิก" class="w-full h-full object-cover">` : '<span class="text-slate-400 text-xs">ไม่มีโลโก้</span>'}
          </div>
          ${canEdit ? '<input id="logo-file" type="file" accept="image/jpeg,image/png,image/webp" class="text-sm">' : ''}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${field('clinic-name','ชื่อคลินิก',profile.name,canEdit)}
          ${field('clinic-phone','เบอร์โทร',profile.phone,canEdit,'tel')}
          ${field('clinic-email','อีเมล',profile.email,canEdit,'email')}
          ${field('clinic-website','เว็บไซต์',profile.website,canEdit,'url')}
          ${field('clinic-latitude','ละติจูด',profile.location_lat,canEdit,'number','step="any"')}
          ${field('clinic-longitude','ลองจิจูด',profile.location_lng,canEdit,'number','step="any"')}
          ${field('clinic-timezone','Timezone',profile.timezone || 'Asia/Bangkok',canEdit)}
        </div>
        <div><label class="input-label">รายละเอียด</label><textarea id="clinic-description" class="input-field" rows="3" ${canEdit ? '' : 'disabled'}>${escapeHtml(profile.description || '')}</textarea></div>
        <div><label class="input-label">ที่อยู่</label><textarea id="clinic-address" class="input-field" rows="2" ${canEdit ? '' : 'disabled'}>${escapeHtml(profile.address || '')}</textarea></div>
        ${canEdit ? '<button id="save-profile" class="btn-primary px-5 py-2">บันทึกข้อมูลคลินิก</button>' : ''}
      </div>

      <div class="card p-5 space-y-4">
        <h2 class="text-lg font-bold text-navy">เวลาทำการ</h2>
        <div class="space-y-2">${DAYS.map((label, day) => hoursRow(day, label, hoursByDay.get(day), canEdit)).join('')}</div>
        ${canEdit ? '<button id="save-hours" class="btn-primary px-5 py-2">บันทึกเวลาทำการ</button>' : ''}
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div class="card p-5 space-y-4">
          <h2 class="text-lg font-bold text-navy">วันหยุดและเวลาพิเศษ</h2>
          ${canEdit ? `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2"><input id="holiday-date" type="date" class="input-field"><input id="holiday-reason" class="input-field" placeholder="เหตุผล"><button id="add-holiday" class="btn-primary">เพิ่มวันหยุด</button></div>` : ''}
          <div id="holiday-list">${holidays.length ? holidays.map(item => `<div class="flex justify-between gap-3 py-2 border-b"><div><div class="font-semibold text-sm">${escapeHtml(item.date)}</div><div class="text-xs text-slate-400">${escapeHtml(item.reason || 'ปิดทำการ')}</div></div>${canEdit ? `<button data-delete-holiday="${item.id}" class="text-red-500 text-sm">ลบ</button>` : ''}</div>`).join('') : '<div class="text-sm text-slate-400 py-4">ไม่มีวันหยุดที่กำหนด</div>'}</div>
        </div>
        <div class="card p-5 space-y-4">
          <h2 class="text-lg font-bold text-navy">บริการ</h2>
          ${canEdit ? `<div class="grid grid-cols-2 gap-2"><input id="service-name" class="input-field col-span-2" placeholder="ชื่อบริการ"><input id="service-duration" type="number" min="5" max="480" value="30" class="input-field" placeholder="นาที"><input id="service-capacity" type="number" min="1" max="50" value="1" class="input-field" placeholder="ความจุ"><button id="add-service" class="btn-primary col-span-2">เพิ่มบริการ</button></div>` : ''}
          <div>${services.length ? services.map(item => `<div class="flex items-center justify-between gap-3 py-2 border-b"><div><div class="font-semibold text-sm">${escapeHtml(item.name)}</div><div class="text-xs text-slate-400">${item.duration_minutes} นาที · ${item.capacity_per_slot} นัด/ช่วง</div></div>${canEdit ? `<button data-toggle-service="${item.id}" data-active="${item.is_active}" class="text-sm ${item.is_active ? 'text-red-500' : 'text-primary'}">${item.is_active ? 'ปิด' : 'เปิด'}</button>` : ''}</div>`).join('') : '<div class="text-sm text-slate-400 py-4">ยังไม่มีบริการ</div>'}</div>
        </div>
      </div>
    </div>`;
  bind(container, state);
}

function field(id, label, value, enabled, type = 'text', extra = '') {
  return `<div><label class="input-label">${label}</label><input id="${id}" type="${type}" class="input-field" value="${escapeHtml(value ?? '')}" ${extra} ${enabled ? '' : 'disabled'}></div>`;
}

function hoursRow(day, label, value = {}, enabled) {
  const closed = value.is_closed ?? (day === 0);
  return `<div data-hours-day="${day}" class="grid grid-cols-[1fr_auto] sm:grid-cols-[90px_90px_1fr_1fr] items-center gap-2 [&>input]:min-w-0 [&>input]:px-2 sm:[&>input]:px-4"><span class="text-sm">${label}</span><label class="text-xs"><input class="hours-closed accent-primary" type="checkbox" ${closed ? 'checked' : ''} ${enabled ? '' : 'disabled'}> ปิด</label><input class="hours-open input-field" type="time" value="${(value.opens_at || '09:00').slice(0,5)}" ${enabled && !closed ? '' : 'disabled'}><input class="hours-close input-field" type="time" value="${(value.closes_at || '18:00').slice(0,5)}" ${enabled && !closed ? '' : 'disabled'}></div>`;
}

function bind(container, state) {
  if (!state.canEdit) return;
  container.querySelectorAll('.hours-closed').forEach(input => input.addEventListener('change', () => {
    input.closest('[data-hours-day]').querySelectorAll('.hours-open,.hours-close').forEach(time => { time.disabled = input.checked; });
  }));
  container.querySelector('#save-profile')?.addEventListener('click', async () => {
    const body = { name: value(container,'clinic-name'), phone: value(container,'clinic-phone'), email: value(container,'clinic-email'), website: value(container,'clinic-website'), latitude: nullableNumber(value(container,'clinic-latitude')), longitude: nullableNumber(value(container,'clinic-longitude')), timezone: value(container,'clinic-timezone'), description: value(container,'clinic-description'), address: value(container,'clinic-address'), accepting_appointments: container.querySelector('#accepting').checked };
    await mutate(container, `/api/clinic/${state.storeId}`, { method:'PATCH', body:JSON.stringify(body) }, 'บันทึกข้อมูลคลินิกแล้ว');
  });
  container.querySelector('#accepting')?.addEventListener('change', async event => mutate(container, `/api/clinic/${state.storeId}`, { method:'PATCH', body:JSON.stringify({ accepting_appointments:event.target.checked }) }, event.target.checked ? 'เปิดรับนัดหมายแล้ว' : 'ปิดรับนัดหมายแล้ว'));
  container.querySelector('#logo-file')?.addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) return showToast('โลโก้ต้องไม่เกิน 2 MB','error');
    const data = await readDataUrl(file);
    await mutate(container, `/api/clinic/${state.storeId}/logo`, { method:'POST', body:JSON.stringify({ data }) }, 'อัปโหลดโลโก้แล้ว', true);
  });
  container.querySelector('#save-hours')?.addEventListener('click', async () => {
    const hours = [...container.querySelectorAll('[data-hours-day]')].map(row => ({ day_of_week:Number(row.dataset.hoursDay), is_closed:row.querySelector('.hours-closed').checked, opens_at:row.querySelector('.hours-open').value, closes_at:row.querySelector('.hours-close').value }));
    await mutate(container, `/api/clinic/${state.storeId}/hours`, { method:'PUT', body:JSON.stringify({ hours }) }, 'บันทึกเวลาทำการแล้ว');
  });
  container.querySelector('#add-holiday')?.addEventListener('click', async () => mutate(container, `/api/clinic/${state.storeId}/holidays`, { method:'POST', body:JSON.stringify({ date:value(container,'holiday-date'), reason:value(container,'holiday-reason'), is_closed:true }) }, 'เพิ่มวันหยุดแล้ว', true));
  container.querySelectorAll('[data-delete-holiday]').forEach(button => button.addEventListener('click', async () => mutate(container, `/api/clinic/holidays/${button.dataset.deleteHoliday}`, { method:'DELETE' }, 'ลบวันหยุดแล้ว', true)));
  container.querySelector('#add-service')?.addEventListener('click', async () => mutate(container, `/api/clinic/${state.storeId}/services`, { method:'POST', body:JSON.stringify({ name:value(container,'service-name'), duration_minutes:Number(value(container,'service-duration')), capacity_per_slot:Number(value(container,'service-capacity')) }) }, 'เพิ่มบริการแล้ว', true));
  container.querySelectorAll('[data-toggle-service]').forEach(button => button.addEventListener('click', async () => mutate(container, `/api/clinic/services/${button.dataset.toggleService}`, { method:'PATCH', body:JSON.stringify({ is_active:button.dataset.active !== 'true' }) }, 'อัปเดตบริการแล้ว', true)));
}

async function mutate(container, path, options, success, reload = false) {
  const result = await apiFetch(path, options);
  if (!result?.success) return showToast(result?.error || 'บันทึกไม่สำเร็จ','error');
  showToast(success);
  if (reload) await renderClinicProfile(container);
}
const value = (container, id) => container.querySelector(`#${id}`)?.value.trim() || '';
const nullableNumber = input => input === '' ? null : Number(input);
const readDataUrl = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); });
function renderError(container, message) { container.innerHTML = `<div class="card p-8 text-center"><div class="font-semibold text-navy">โหลดข้อมูลไม่สำเร็จ</div><p class="text-sm text-slate-500 mt-2">${escapeHtml(message)}</p><button id="retry-clinic" class="btn-primary mt-4 px-4 py-2">ลองใหม่</button></div>`; container.querySelector('#retry-clinic')?.addEventListener('click',()=>renderClinicProfile(container)); }
