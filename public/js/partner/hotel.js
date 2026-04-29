import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const ROOM_TYPES = {
  standard: { label: 'Standard', icon: '🛏', price: 400 },
  deluxe:   { label: 'Deluxe',   icon: '⭐', price: 650 },
  suite:    { label: 'Suite',    icon: '👑', price: 900 },
};
const STATUS_CFG = {
  available:   { label: 'ว่าง',          cls: 'border-primary bg-primary-subtle text-primary-dark' },
  occupied:    { label: 'มีผู้เข้าพัก',  cls: 'border-orange-300 bg-orange-50 text-orange-700' },
  maintenance: { label: 'ซ่อมบำรุง',     cls: 'border-slate-300 bg-slate-50 text-slate-500' },
  cleaning:    { label: 'ทำความสะอาด',  cls: 'border-blue-300 bg-blue-50 text-blue-600' },
};

let _storeId = '';

export async function renderHotel(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  await _renderRooms(container);
}

async function _renderRooms(container) {
  const res   = await apiFetch(`/api/hotel/rooms?store_id=${_storeId}`);
  const rooms = res?.data || [];

  const stats = { available: 0, occupied: 0, maintenance: 0, cleaning: 0 };
  rooms.forEach(r => { if (stats[r.status] !== undefined) stats[r.status]++; });

  container.innerHTML = `
    <div class="space-y-5 max-w-5xl">
      <!-- Stats -->
      <div class="grid grid-cols-4 gap-3">
        ${[['🟢','ว่าง',stats.available,'text-primary'],['🐾','มีผู้เข้าพัก',stats.occupied,'text-orange-500'],
           ['🔧','ซ่อมบำรุง',stats.maintenance,'text-slate-400'],['🧹','ทำความสะอาด',stats.cleaning,'text-blue-500']]
          .map(([icon,label,val,cls])=>`<div class="card p-4 text-center"><div class="text-2xl">${icon}</div><div class="text-xs text-slate-400 font-body mt-1">${label}</div><div class="text-2xl font-bold ${cls} mt-1">${val}</div></div>`).join('')}
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2">
        <button id="add-room-btn" class="btn-outline text-sm px-4 py-2">+ เพิ่มห้อง</button>
      </div>

      <!-- Room grid -->
      ${rooms.length === 0
        ? `<div class="card p-10 text-center space-y-3">
             <div class="text-4xl">🏨</div>
             <div class="font-semibold text-navy">ยังไม่มีห้องพัก</div>
             <button id="add-room-btn2" class="btn-primary">+ เพิ่มห้องแรก</button>
           </div>`
        : `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" id="room-grid">
             ${rooms.map(_roomCard).join('')}
           </div>`}
    </div>`;

  container.querySelector('#add-room-btn')?.addEventListener('click', () => _openAddRoomModal(container));
  container.querySelector('#add-room-btn2')?.addEventListener('click', () => _openAddRoomModal(container));
  container.querySelector('#room-grid')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-room-id]');
    if (!card) return;
    const room = rooms.find(r => r.id === card.dataset.roomId);
    if (!room) return;
    if (room.status === 'available') _openCheckinModal(room, container);
    else if (room.status === 'occupied') _openCheckoutModal(room, container);
    else if (room.status === 'cleaning') _markAvailable(room.id, container);
  });
}

function _roomCard(r) {
  const cfg  = STATUS_CFG[r.status] || STATUS_CFG.available;
  const type = ROOM_TYPES[r.room_type] || ROOM_TYPES.standard;
  const b    = r.current_booking;

  return `
    <div data-room-id="${r.id}" class="card border-2 ${cfg.cls} p-4 cursor-pointer hover:shadow-card-hover transition-all">
      <div class="flex items-center justify-between mb-2">
        <span class="font-mono font-bold text-navy text-lg">${r.room_number}</span>
        <span class="text-lg">${type.icon}</span>
      </div>
      <div class="text-xs font-semibold mb-2">${cfg.label}</div>
      ${b ? `
        <div class="text-xs font-body text-slate-600 space-y-0.5">
          <div class="font-semibold truncate">🐾 ${b.pet_name}</div>
          <div class="truncate">เจ้าของ: ${b.owner_name}</div>
          <div>ออก: ${b.check_out_date}</div>
        </div>` : `
        <div class="text-xs text-slate-400 font-body">
          ${type.label} · ฿${r.price_per_night}/คืน
          ${r.status === 'cleaning' ? '<div class="text-blue-500 mt-1 font-semibold">แตะเพื่อพร้อม</div>' : ''}
        </div>`}
    </div>`;
}

async function _markAvailable(roomId, container) {
  await apiFetch(`/api/hotel/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify({ status: 'available' }) });
  showToast('ห้องพร้อมใช้งานแล้ว');
  await _renderRooms(container);
}

function _openCheckinModal(room, container) {
  const type = ROOM_TYPES[room.room_type] || ROOM_TYPES.standard;
  const modal = _modal(`Check-in ห้อง ${room.room_number} (${type.label})`, `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">ชื่อสัตว์เลี้ยง *</label><input id="ci-pet" class="input-field" placeholder="บัดดี้"></div>
        <div><label class="input-label">ชนิด</label>
          <select id="ci-species" class="input-field">
            <option value="dog">🐕 สุนัข</option><option value="cat">🐈 แมว</option><option value="rabbit">🐰 กระต่าย</option><option value="other">🐾 อื่นๆ</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">ชื่อเจ้าของ</label><input id="ci-owner" class="input-field" placeholder="คุณสมชาย"></div>
        <div><label class="input-label">เบอร์โทร</label><input id="ci-phone" class="input-field" placeholder="0812345678" type="tel"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">วันที่เช็คอิน *</label><input id="ci-in" class="input-field" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
        <div><label class="input-label">วันที่เช็คเอาต์ *</label><input id="ci-out" class="input-field" type="date"></div>
      </div>
      <div id="ci-calc" class="bg-primary-subtle rounded-lg p-3 text-sm text-primary-dark font-body hidden"></div>
      <div><label class="input-label">หมายเหตุ</label><input id="ci-notes" class="input-field" placeholder="อาหาร / ยา / พฤติกรรม"></div>
    </div>`);

  const calcTotal = () => {
    const inDate  = modal.querySelector('#ci-in').value;
    const outDate = modal.querySelector('#ci-out').value;
    if (!inDate || !outDate) return;
    const nights = Math.max(1, Math.ceil((new Date(outDate) - new Date(inDate)) / 86400000));
    const total  = nights * room.price_per_night;
    const calc   = modal.querySelector('#ci-calc');
    calc.textContent = `${nights} คืน × ฿${room.price_per_night} = ฿${total.toLocaleString('th-TH')}`;
    calc.classList.remove('hidden');
  };
  modal.querySelector('#ci-in').addEventListener('change', calcTotal);
  modal.querySelector('#ci-out').addEventListener('change', calcTotal);

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const pet = modal.querySelector('#ci-pet').value.trim();
    const inD = modal.querySelector('#ci-in').value;
    const outD = modal.querySelector('#ci-out').value;
    if (!pet || !inD || !outD) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
    if (outD <= inD) { showToast('วันเช็คเอาต์ต้องหลังวันเช็คอิน', 'error'); return; }

    const res = await apiFetch('/api/hotel/checkin', { method: 'POST', body: JSON.stringify({
      store_id: _storeId, room_id: room.id,
      pet_name: pet, owner_name: modal.querySelector('#ci-owner').value.trim(),
      owner_phone: modal.querySelector('#ci-phone').value.trim(),
      species: modal.querySelector('#ci-species').value,
      check_in_date: inD, check_out_date: outD,
      notes: modal.querySelector('#ci-notes').value.trim() || null,
    })});
    if (res?.success) { showToast(`Check-in ${pet} เรียบร้อย`); modal.remove(); await _renderRooms(container); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

function _openCheckoutModal(room, container) {
  const b = room.current_booking;
  if (!b) return;
  const modal = _modal(`Check-out ห้อง ${room.room_number}`, `
    <div class="space-y-3">
      <div class="bg-slate-50 rounded-xl p-4 space-y-1 font-body text-sm">
        <div class="font-bold text-navy text-base">🐾 ${b.pet_name}</div>
        <div class="text-slate-500">เจ้าของ: ${b.owner_name} · ${b.owner_phone||''}</div>
        <div class="text-slate-500">เช็คอิน: ${b.check_in_date} → เช็คเอาต์: ${b.check_out_date}</div>
        <div class="text-primary font-bold text-lg mt-2">ยอดรวม: ฿${(b.total_amount||0).toLocaleString('th-TH')}</div>
        <div class="text-slate-400 text-xs">${b.nights} คืน × ฿${room.price_per_night}/คืน</div>
      </div>
    </div>`);

  modal.querySelector('#modal-confirm').textContent = 'ยืนยัน Check-out';
  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const res = await apiFetch(`/api/hotel/checkout/${b.id}`, { method: 'POST', body: JSON.stringify({ store_id: _storeId }) });
    if (res?.success) { showToast(`Check-out ${b.pet_name} เรียบร้อย`); modal.remove(); await _renderRooms(container); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

function _openAddRoomModal(container) {
  const modal = _modal('เพิ่มห้องพัก', `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">หมายเลขห้อง *</label><input id="ar-num" class="input-field" placeholder="101"></div>
        <div><label class="input-label">ชั้น</label><input id="ar-floor" class="input-field" type="number" value="1" min="1"></div>
      </div>
      <div><label class="input-label">ประเภทห้อง</label>
        <select id="ar-type" class="input-field">
          ${Object.entries(ROOM_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label} — ฿${v.price}/คืน</option>`).join('')}
        </select>
      </div>
      <div><label class="input-label">ราคาต่อคืน (฿)</label><input id="ar-price" class="input-field" type="number" value="400"></div>
    </div>`);

  modal.querySelector('#ar-type').addEventListener('change', (e) => {
    modal.querySelector('#ar-price').value = ROOM_TYPES[e.target.value]?.price || 400;
  });

  modal.querySelector('#modal-confirm').addEventListener('click', async () => {
    const num = modal.querySelector('#ar-num').value.trim();
    if (!num) { showToast('กรุณากรอกหมายเลขห้อง', 'error'); return; }
    const res = await apiFetch('/api/hotel/rooms', { method: 'POST', body: JSON.stringify({
      store_id: _storeId, room_number: num,
      room_type: modal.querySelector('#ar-type').value,
      floor: parseInt(modal.querySelector('#ar-floor').value) || 1,
      price_per_night: parseInt(modal.querySelector('#ar-price').value) || 400,
    })});
    if (res?.success) { showToast(`เพิ่มห้อง ${num} แล้ว`); modal.remove(); await _renderRooms(container); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

function _modal(title, body) {
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
  m.innerHTML = `<div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-md space-y-4">
    <h3 class="font-bold text-navy text-lg">${title}</h3>
    <div>${body}</div>
    <div class="flex gap-3"><button id="modal-cancel" class="btn-outline flex-1">ยกเลิก</button><button id="modal-confirm" class="btn-primary flex-1">ยืนยัน</button></div>
  </div>`;
  document.body.appendChild(m);
  m.querySelector('#modal-cancel').addEventListener('click', () => m.remove());
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  return m;
}
