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
let _hotelSelPet = null; // { pet_id, pet_name, species, owner_name, owner_phone } | null
const SPECIES_EMOJI = { dog: '🐕', cat: '🐈', rabbit: '🐰', bird: '🐦', other: '🐾' };

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
  _hotelSelPet = null;

  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 my-4">
      <h3 class="font-bold text-navy text-lg">Check-in ห้อง ${room.room_number} (${type.label})</h3>

      <!-- Pet search -->
      <div id="hs1">
        <label class="input-label">ค้นหาสัตว์เลี้ยงในระบบ</label>
        <div class="relative">
          <input id="hs-search" class="input-field" placeholder="บัดดี้ หรือ 0812345678..." autocomplete="off">
          <div id="hs-dd" class="hidden absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card-hover border border-slate-100 max-h-56 overflow-y-auto text-sm"></div>
        </div>
        <div class="mt-1.5 text-right">
          <button id="hs-register" class="text-xs text-primary hover:underline font-body">+ ลงทะเบียนสัตว์ใหม่</button>
        </div>
      </div>

      <!-- Selected pet + details -->
      <div id="hs2" class="hidden space-y-3">
        <div id="hs-pet-card" class="rounded-xl border-2 border-primary bg-primary-subtle p-3"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="input-label">วันที่เช็คอิน *</label><input id="ci-in" class="input-field" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
          <div><label class="input-label">วันที่เช็คเอาต์ *</label><input id="ci-out" class="input-field" type="date"></div>
        </div>
        <div id="ci-calc" class="bg-primary-subtle rounded-lg p-3 text-sm text-primary-dark font-body hidden"></div>
        <div><label class="input-label">หมายเหตุ (อาหาร / ยา / พฤติกรรม)</label>
          <input id="ci-notes" class="input-field" placeholder="กินอาหาร Royal Canin วันละ 2 ครั้ง...">
        </div>
        <button id="hs-change" class="text-xs text-primary hover:underline font-body">← เปลี่ยนสัตว์เลี้ยง</button>
      </div>

      <div class="flex gap-3">
        <button id="hs-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="hs-confirm" class="btn-primary flex-1" disabled>Check-in</button>
      </div>
    </div>`;

  document.body.appendChild(m);

  const input   = m.querySelector('#hs-search');
  const dd      = m.querySelector('#hs-dd');
  const s1      = m.querySelector('#hs1');
  const s2      = m.querySelector('#hs2');
  const confBtn = m.querySelector('#hs-confirm');

  function showS2(pet) {
    _hotelSelPet = pet;
    s1.classList.add('hidden'); s2.classList.remove('hidden'); confBtn.disabled = false;
    m.querySelector('#hs-pet-card').innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-2xl">${SPECIES_EMOJI[pet.species]||'🐾'}</span>
        <div>
          <div class="font-bold text-primary-dark">${pet.pet_name}</div>
          <div class="text-xs text-slate-500 font-body">เจ้าของ: ${pet.owner_name}${pet.owner_phone?' · '+pet.owner_phone:''}</div>
          ${pet.allergies?`<div class="text-xs text-red-600 mt-0.5">⚠️ แพ้: ${pet.allergies}</div>`:''}
        </div>
      </div>`;
  }

  function showS1() {
    _hotelSelPet = null; s2.classList.add('hidden'); s1.classList.remove('hidden');
    confBtn.disabled = true; input.value = ''; input.focus();
  }

  m.querySelector('#hs-change').addEventListener('click', showS1);
  m.querySelector('#hs-cancel').addEventListener('click', () => m.remove());
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  m.querySelector('#hs-register').addEventListener('click', () => _hotelRegister(m, showS2));

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { dd.classList.add('hidden'); return; }
    timer = setTimeout(async () => {
      const res = await apiFetch(`/api/pets/owners/search?store_id=${_storeId}&q=${encodeURIComponent(q)}`);
      const owners = res?.data || [];
      if (!owners.length) {
        dd.innerHTML = `<div class="px-4 py-3 text-slate-400 font-body text-sm">ไม่พบ — <button id="hd-reg" class="text-primary underline text-xs">ลงทะเบียนใหม่</button></div>`;
        dd.classList.remove('hidden');
        dd.querySelector('#hd-reg')?.addEventListener('click', () => { dd.classList.add('hidden'); _hotelRegister(m, showS2); });
        return;
      }
      const rows = [];
      for (const o of owners)
        for (const p of (o.pets || []))
          rows.push({ pet_id: p.id, pet_name: p.name, species: p.species, allergies: p.allergies, owner_name: o.name, owner_phone: o.phone||'' });

      dd.innerHTML = rows.map((r, i) =>
        `<div class="flex items-center gap-3 px-4 py-2.5 hover:bg-primary-subtle cursor-pointer transition-colors" data-hi="${i}">
           <span>${SPECIES_EMOJI[r.species]||'🐾'}</span>
           <div><div class="font-semibold text-navy text-sm">${r.pet_name}${r.allergies?' ⚠️':''}</div>
           <div class="text-xs text-slate-400 font-body">เจ้าของ: ${r.owner_name}${r.owner_phone?' · '+r.owner_phone:''}</div></div>
         </div>`
      ).join('') + `<div class="border-t px-4 py-2"><button id="hd-reg2" class="text-xs text-primary hover:underline font-body">+ ลงทะเบียนใหม่</button></div>`;
      dd.classList.remove('hidden');
      dd.querySelectorAll('[data-hi]').forEach(el => {
        el.addEventListener('click', () => { dd.classList.add('hidden'); showS2(rows[parseInt(el.dataset.hi)]); });
      });
      dd.querySelector('#hd-reg2')?.addEventListener('click', () => { dd.classList.add('hidden'); _hotelRegister(m, showS2); });
    }, 300);
  });
  input.addEventListener('blur', () => setTimeout(() => dd.classList.add('hidden'), 200));

  // Calc nights
  const calcNights = () => {
    const inD = m.querySelector('#ci-in')?.value;
    const outD = m.querySelector('#ci-out')?.value;
    if (!inD || !outD) return;
    const nights = Math.max(1, Math.ceil((new Date(outD) - new Date(inD)) / 86400000));
    const calc   = m.querySelector('#ci-calc');
    calc.textContent = `${nights} คืน × ฿${room.price_per_night} = ฿${(nights*room.price_per_night).toLocaleString('th-TH')}`;
    calc.classList.remove('hidden');
  };
  m.querySelector('#ci-in')?.addEventListener('change', calcNights);
  m.querySelector('#ci-out')?.addEventListener('change', calcNights);

  confBtn.addEventListener('click', async () => {
    if (!_hotelSelPet) return;
    const inD  = m.querySelector('#ci-in').value;
    const outD = m.querySelector('#ci-out').value;
    if (!inD || !outD) { showToast('กรุณาเลือกวันที่', 'error'); return; }
    if (outD <= inD)   { showToast('วันเช็คเอาต์ต้องหลังวันเช็คอิน', 'error'); return; }

    confBtn.disabled = true; confBtn.textContent = 'กำลังบันทึก...';
    const res = await apiFetch('/api/hotel/checkin', { method: 'POST', body: JSON.stringify({
      store_id: _storeId, room_id: room.id,
      pet_id:     _hotelSelPet.pet_id,
      pet_name:   _hotelSelPet.pet_name,
      owner_name: _hotelSelPet.owner_name,
      owner_phone:_hotelSelPet.owner_phone || null,
      species:    _hotelSelPet.species || 'dog',
      check_in_date: inD, check_out_date: outD,
      notes: m.querySelector('#ci-notes').value.trim() || null,
    })});
    if (res?.success) {
      showToast(`Check-in ${_hotelSelPet.pet_name} เรียบร้อย`); m.remove(); await _renderRooms(container);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      confBtn.disabled = false; confBtn.textContent = 'Check-in';
    }
  });

  setTimeout(() => input.focus(), 100);
}

function _hotelRegister(parentModal, onDone) {
  parentModal.style.visibility = 'hidden';
  const m1 = document.createElement('div');
  m1.className = 'fixed inset-0 flex items-center justify-center bg-black/40 p-4';
  m1.style.zIndex = '60';
  m1.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">ลงทะเบียน — 1/2 เจ้าของ</h3>
      <div><label class="input-label">ชื่อ *</label><input id="ho-name" class="input-field" placeholder="คุณสมชาย" autofocus></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">เบอร์โทร *</label><input id="ho-phone" class="input-field" type="tel" placeholder="0812345678"></div>
        <div><label class="input-label">อีเมล</label><input id="ho-email" class="input-field" type="email"></div>
      </div>
      <div class="flex gap-3">
        <button id="ho-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="ho-next" class="btn-primary flex-1">ถัดไป →</button>
      </div>
    </div>`;
  document.body.appendChild(m1);
  m1.querySelector('#ho-cancel').addEventListener('click', () => { m1.remove(); parentModal.style.visibility=''; });

  m1.querySelector('#ho-next').addEventListener('click', async () => {
    const name  = m1.querySelector('#ho-name').value.trim();
    const phone = m1.querySelector('#ho-phone').value.trim();
    if (!name||!phone) { showToast('กรุณากรอกชื่อและเบอร์','error'); return; }
    const btn = m1.querySelector('#ho-next'); btn.disabled=true; btn.textContent='กำลังบันทึก...';
    const res = await apiFetch('/api/pets/owners',{method:'POST',body:JSON.stringify({name,phone,email:m1.querySelector('#ho-email').value.trim()||null})});
    if (!res?.success) { showToast(res?.error||'เกิดข้อผิดพลาด','error'); btn.disabled=false; btn.textContent='ถัดไป →'; return; }
    m1.remove();
    const owner = res.data;
    const m2 = document.createElement('div');
    m2.className = 'fixed inset-0 flex items-center justify-center bg-black/40 p-4';
    m2.style.zIndex = '60';
    m2.innerHTML = `
      <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h3 class="font-bold text-navy text-lg">ลงทะเบียน — 2/2 สัตว์เลี้ยง</h3>
        <div class="bg-primary-subtle rounded-xl px-4 py-2 text-sm text-primary-dark font-semibold">👤 ${owner.name} · ${owner.phone||''}</div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="input-label">ชื่อสัตว์ *</label><input id="hp-name" class="input-field" placeholder="บัดดี้" autofocus></div>
          <div><label class="input-label">ชนิด</label>
            <select id="hp-species" class="input-field">
              <option value="dog">🐕 สุนัข</option><option value="cat">🐈 แมว</option><option value="rabbit">🐰 กระต่าย</option><option value="bird">🐦 นก</option><option value="other">🐾 อื่นๆ</option>
            </select>
          </div>
          <div class="col-span-2"><label class="input-label">แพ้ยา/อาหาร</label><input id="hp-allergy" class="input-field" placeholder="ถ้าไม่มีเว้นว่าง"></div>
        </div>
        <div class="flex gap-3">
          <button id="hp-cancel" class="btn-outline flex-1">ยกเลิก</button>
          <button id="hp-save" class="btn-primary flex-1">บันทึก + เลือก</button>
        </div>
      </div>`;
    document.body.appendChild(m2);
    m2.querySelector('#hp-cancel').addEventListener('click', () => { m2.remove(); parentModal.style.visibility=''; });
    m2.querySelector('#hp-save').addEventListener('click', async () => {
      const petName = m2.querySelector('#hp-name').value.trim();
      const species = m2.querySelector('#hp-species').value;
      if (!petName) { showToast('กรุณากรอกชื่อสัตว์','error'); return; }
      const b2 = m2.querySelector('#hp-save'); b2.disabled=true; b2.textContent='กำลังบันทึก...';
      const pr = await apiFetch('/api/pets',{method:'POST',body:JSON.stringify({owner_id:owner.id,store_id:_storeId,name:petName,species,allergies:m2.querySelector('#hp-allergy').value.trim()||null})});
      if (!pr?.success) { showToast(pr?.error||'เกิดข้อผิดพลาด','error'); b2.disabled=false; b2.textContent='บันทึก + เลือก'; return; }
      const pet = pr.data;
      m2.remove(); parentModal.style.visibility='';
      showToast(`ลงทะเบียน ${petName} แล้ว`);
      onDone({ pet_id: pet.id, pet_name: pet.name, species: pet.species, allergies: pet.allergies||null, owner_name: owner.name, owner_phone: owner.phone||'' });
    });
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
