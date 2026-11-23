import { apiFetch } from '../utils/api-client.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { storage } from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { escapeHtml } from '../utils/formatters.js';
import { renderClinicLinkCard, isClinicStore } from './clinic-link.js';
import { renderBillingCard } from './clinic-billing.js';
import { renderReminderCard } from './reminders.js';

const DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

export async function renderClinicProfile(container, detail = null) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const role = storage.get(STORAGE_KEYS.STAFF_ROLE) || 'owner';
  const canEdit = role === 'owner';
  if (!storeId) return renderError(container, 'ยังไม่ได้เลือกร้านค้า');
  container.innerHTML = '<div class="card p-8 text-center text-slate-400">กำลังโหลดการตั้งค่า...</div>';
  const [profileRes, hoursRes, holidaysRes, servicesRes] = await Promise.all([
    apiFetch(`/api/clinic/${storeId}`),
    apiFetch(`/api/clinic/${storeId}/hours`),
    apiFetch(`/api/clinic/${storeId}/holidays`),
    apiFetch(`/api/clinic/${storeId}/services`),
  ]);
  if (!profileRes?.success) return renderError(container, profileRes?.error || 'โหลดการตั้งค่าไม่สำเร็จ');
  render(container, { storeId, canEdit, focus: detail?.focus, profile: profileRes.data, hours: hoursRes?.data || [], holidays: holidaysRes?.data || [], services: servicesRes?.data || [] });
}

function render(container, state) {
  const { profile, hours, holidays, services, canEdit } = state;
  const hoursByDay = new Map(hours.map(item => [Number(item.day_of_week), item]));
  const category = storage.get(STORAGE_KEYS.STORE_CATEGORY) || '';
  const isHotel = category === 'pet_hotel';
  container.innerHTML = `
    <div class="space-y-5">
      ${readinessCard(profile, hours, services, category)}
      ${isClinicStore() ? '<div data-clinic-billing></div><div data-clinic-link></div>' : ''}
      <div data-reminders></div>
      <div class="card p-5 space-y-4">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div><h2 class="text-lg font-bold text-navy">ตั้งค่า</h2><p class="text-sm text-slate-400">ข้อมูลร้านที่แสดงใน FUFU</p></div>
          <label class="flex items-center gap-2 text-sm font-semibold ${canEdit ? '' : 'opacity-60'}">
            <input id="accepting" type="checkbox" class="accent-primary" ${profile.accepting_appointments ? 'checked' : ''} ${canEdit ? '' : 'disabled'}> เปิดรับจองผ่านแอป FUFU
          </label>
        </div>
        <div class="flex items-center gap-4">
          <div class="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
            ${profile.store_profile_image_url || profile.logo_url ? `<img id="store-profile-preview" src="${escapeHtml(profile.store_profile_image_url || profile.logo_url)}" alt="รูปโปรไฟล์ร้านค้า" class="w-full h-full object-cover">` : '<img id="store-profile-preview" alt="รูปโปรไฟล์ร้านค้า" class="hidden w-full h-full object-cover">'}
          </div>
          <div class="min-w-0 space-y-1">
            <div class="font-semibold text-sm text-navy">รูปโปรไฟล์ร้านค้า</div>
            ${canEdit ? '<input id="store-profile-file" type="file" accept="image/jpeg,image/png,image/webp" class="text-sm">' : ''}
            <p class="text-xs text-slate-400">ใช้แสดงใน Partner และ FUFU</p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${field('clinic-name','ชื่อร้าน',profile.name,canEdit)}
          ${field('clinic-phone','เบอร์โทร',profile.phone,canEdit,'tel')}
          ${field('clinic-email','อีเมล',profile.email,canEdit,'email')}
          ${field('clinic-website','เว็บไซต์',profile.website,canEdit,'url')}
          ${field('clinic-latitude','ละติจูด',profile.location_lat,canEdit,'number','step="any"')}
          ${field('clinic-longitude','ลองจิจูด',profile.location_lng,canEdit,'number','step="any"')}
          ${field('clinic-timezone','Timezone',profile.timezone || 'Asia/Bangkok',canEdit)}
        </div>
        <div><label class="input-label">รายละเอียด</label><textarea id="clinic-description" class="input-field" rows="3" ${canEdit ? '' : 'disabled'}>${escapeHtml(profile.description || '')}</textarea></div>
        <div><label class="input-label">ที่อยู่</label><textarea id="clinic-address" class="input-field" rows="2" ${canEdit ? '' : 'disabled'}>${escapeHtml(profile.address || '')}</textarea></div>
        ${canEdit ? '<button id="save-profile" class="btn-primary px-5 py-2">บันทึกการตั้งค่า</button>' : ''}
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
          <div><h2 class="text-lg font-bold text-navy">${isHotel ? 'ห้องพักที่เปิดให้จอง' : 'บริการที่เปิดให้จอง'}</h2><p class="text-xs text-slate-400">ลูกค้าเลือกรายการเหล่านี้ตอนจองในแอป FUFU</p></div>
          ${canEdit ? (isHotel
            ? `<div class="grid grid-cols-2 gap-2"><label class="col-span-2"><span class="input-label">ประเภทห้อง</span><input id="service-name" class="input-field" placeholder="เช่น ห้องมาตรฐาน (แมว)"></label><input id="service-duration" type="hidden" value="60"><label class="col-span-2"><span class="input-label">จำนวนห้องที่รับได้ต่อคืน</span><input id="service-capacity" type="number" min="1" max="50" value="1" class="input-field"></label><button id="add-service" class="btn-primary col-span-2">เพิ่มประเภทห้อง</button></div>`
            : `<div class="grid grid-cols-2 gap-2"><label class="col-span-2"><span class="input-label">ชื่อบริการ</span><input id="service-name" class="input-field" placeholder="${category === 'pet_grooming' ? 'เช่น อาบน้ำ + ตัดเล็บ' : 'เช่น ตรวจสุขภาพทั่วไป'}"></label><label><span class="input-label">ใช้เวลา (นาที)</span><input id="service-duration" type="number" min="5" max="480" value="30" class="input-field"></label><label><span class="input-label">รับได้กี่ตัวต่อช่วงเวลา</span><input id="service-capacity" type="number" min="1" max="50" value="1" class="input-field"></label><button id="add-service" class="btn-primary col-span-2">เพิ่มบริการ</button></div>`) : ''}
          <div>${services.length ? services.map(item => `<div class="flex items-center justify-between gap-3 py-2 border-b"><div><div class="font-semibold text-sm">${escapeHtml(item.name)}</div><div class="text-xs text-slate-400">${isHotel ? `${item.capacity_per_slot} ห้อง/คืน` : `${item.duration_minutes} นาที · ${item.capacity_per_slot} ตัว/ช่วง`}</div></div>${canEdit ? `<button data-toggle-service="${item.id}" data-active="${item.is_active}" class="text-sm ${item.is_active ? 'text-red-500' : 'text-primary'}">${item.is_active ? 'ปิด' : 'เปิด'}</button>` : ''}</div>`).join('') : '<div class="text-sm text-slate-400 py-4">ยังไม่มีบริการ</div>'}</div>
        </div>
      </div>
    </div>`;
  bind(container, state);
  const linkEl = container.querySelector('[data-clinic-link]');
  const remindersEl = container.querySelector('[data-reminders]');
  if (remindersEl) renderReminderCard(remindersEl, { canEdit: state.canEdit, isClinic: isClinicStore() });
  const billingEl = container.querySelector('[data-clinic-billing]');
  if (billingEl) renderBillingCard(billingEl, { isOwner: state.canEdit }).then(() => { if (state.focus === 'billing') billingEl.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  if (linkEl) renderClinicLinkCard(linkEl, { canEdit: state.canEdit });
}

// What a store still needs before customers can book it in the FUFU app (mirrors create_service_booking checks)
function readinessCard(profile, hours, services, category) {
  if (!['vet_clinic', 'vet_hospital', 'pet_hotel', 'pet_grooming'].includes(category)) return '';
  const steps = [
    { ok: Boolean(profile.is_verified), label: 'ร้านผ่านการตรวจสอบจาก FUFU', todo: 'รอทีมงาน FUFU ตรวจสอบร้าน' },
    { ok: Boolean(profile.accepting_appointments), label: 'เปิดรับจองผ่านแอป FUFU', todo: 'เปิดสวิตช์ "เปิดรับจองผ่านแอป FUFU" ด้านล่าง' },
    ...(category === 'pet_hotel' ? [] : [{ ok: hours.some(h => !h.is_closed), label: 'ตั้งเวลาทำการแล้ว', todo: 'ตั้งเวลาทำการอย่างน้อย 1 วัน (ลูกค้าจองได้เฉพาะช่วงเวลาทำการ)' }]),
    { ok: services.some(s => s.is_active), label: category === 'pet_hotel' ? 'มีห้องพักที่เปิดให้จอง' : 'มีบริการที่เปิดให้จอง', todo: category === 'pet_hotel' ? 'เพิ่มประเภทห้องอย่างน้อย 1 รายการ' : 'เพิ่มบริการอย่างน้อย 1 รายการ' },
  ];
  const ready = steps.every(s => s.ok);
  return `<div class="card p-5">
    <div class="flex items-start gap-3">
      <span class="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${ready ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}">${ready ? '✓' : '!'}</span>
      <div class="min-w-0 flex-1">
        <h2 class="font-bold text-navy">${ready ? 'พร้อมรับจองผ่านแอปแล้ว' : 'ยังรับจองผ่านแอปไม่ได้'}</h2>
        <p class="text-sm text-slate-500">${ready ? 'ลูกค้าเห็นปุ่ม "จองบริการ" ในหน้าร้านของคุณ คำขอจองใหม่จะแสดงในเมนูการจองให้กดยืนยันหรือปฏิเสธ' : 'ทำรายการที่เหลือให้ครบ แล้วปุ่ม "จองบริการ" จะแสดงในหน้าร้านบนแอป FUFU'}</p>
        <ul class="mt-3 space-y-1.5">${steps.map(s => `<li class="flex items-start gap-2 text-sm"><span class="${s.ok ? 'text-emerald-600' : 'text-slate-300'}">${s.ok ? '●' : '○'}</span><span class="${s.ok ? 'text-slate-600' : 'text-navy font-semibold'}">${s.ok ? s.label : s.todo}</span></li>`).join('')}</ul>
      </div>
    </div>
  </div>`;
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
    await mutate(container, `/api/clinic/${state.storeId}`, { method:'PATCH', body:JSON.stringify(body) }, 'บันทึกการตั้งค่าแล้ว');
  });
  container.querySelector('#accepting')?.addEventListener('change', async event => mutate(container, `/api/clinic/${state.storeId}`, { method:'PATCH', body:JSON.stringify({ accepting_appointments:event.target.checked }) }, event.target.checked ? 'เปิดรับจองแล้ว' : 'ปิดรับจองแล้ว', true));
  container.querySelector('#store-profile-file')?.addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { showToast('กรุณาเลือกรูป JPEG, PNG หรือ WebP','error'); event.target.value = ''; return; }
    try {
      const data = await prepareProfileImageDataUrl(file);
      const preview = container.querySelector('#store-profile-preview');
      preview.src = data; preview.classList.remove('hidden');
      const result = await mutate(container, `/api/clinic/${state.storeId}/profile-image`, { method:'POST', body:JSON.stringify({ data }) }, 'บันทึกรูปโปรไฟล์แล้ว', true);
      if (result?.success && result.data?.store_profile_image_url) {
        const storeInfo = storage.getJSON(STORAGE_KEYS.STORE_INFO) || {};
        storage.set(STORAGE_KEYS.STORE_INFO, JSON.stringify({ ...storeInfo, store_profile_image_url: result.data.store_profile_image_url }));
        window.dispatchEvent(new CustomEvent('fufu:store-profile-image-updated', { detail: { url: result.data.store_profile_image_url } }));
      }
    } catch { showToast('บันทึกรูปไม่สำเร็จ','error'); }
  });
  container.querySelector('#save-hours')?.addEventListener('click', async () => {
    const hours = [...container.querySelectorAll('[data-hours-day]')].map(row => ({ day_of_week:Number(row.dataset.hoursDay), is_closed:row.querySelector('.hours-closed').checked, opens_at:row.querySelector('.hours-open').value, closes_at:row.querySelector('.hours-close').value }));
    await mutate(container, `/api/clinic/${state.storeId}/hours`, { method:'PUT', body:JSON.stringify({ hours }) }, 'บันทึกเวลาทำการแล้ว', true);
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
  return result;
}
const value = (container, id) => container.querySelector(`#${id}`)?.value.trim() || '';
const nullableNumber = input => input === '' ? null : Number(input);
function prepareProfileImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = reject;
    reader.onload = () => {
      const image = new Image(); image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, 1600 / image.width, 1200 / image.height);
        const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.86; let data = canvas.toDataURL('image/jpeg', quality);
        while (data.length > 2_700_000 && quality > 0.5) { quality -= 0.08; data = canvas.toDataURL('image/jpeg', quality); }
        if (data.length > 2_700_000) return reject(new Error('Image too large'));
        resolve(data);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function renderError(container, message) { container.innerHTML = `<div class="card p-8 text-center"><div class="font-semibold text-navy">โหลดข้อมูลไม่สำเร็จ</div><p class="text-sm text-slate-500 mt-2">${escapeHtml(message)}</p><button id="retry-clinic" class="btn-primary mt-4 px-4 py-2">ลองใหม่</button></div>`; container.querySelector('#retry-clinic')?.addEventListener('click',()=>renderClinicProfile(container)); }
