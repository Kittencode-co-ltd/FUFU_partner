import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const SERVICES = [
  { id: 'bath',       name: 'อาบน้ำ',             icon: '🛁', price: 200 },
  { id: 'nail',       name: 'ตัดเล็บ',             icon: '💅', price: 80  },
  { id: 'ear',        name: 'ทำความสะอาดหู',       icon: '👂', price: 100 },
  { id: 'teeth',      name: 'แปรงฟัน',             icon: '🪥', price: 120 },
  { id: 'spa',        name: 'สปาผิว',              icon: '💆', price: 350 },
  { id: 'haircut',    name: 'ตัดขน',               icon: '✂️', price: 300 },
  // add-ons
  { id: 'cologne',    name: 'น้ำหอม',              icon: '🌸', price: 50  },
  { id: 'blueberry',  name: 'สระบลูเบอร์รี่',      icon: '🫐', price: 150 },
  { id: 'detangle',   name: 'แก้ขนพัน',            icon: '🧶', price: 200 },
  { id: 'anal',       name: 'บีบต่อมกลิ่น',        icon: '🐾', price: 80  },
  { id: 'bandana',    name: 'ผ้าพันคอ',             icon: '🎀', price: 30  },
];

let _storeId     = '';
let _refreshTimer = null;
let _selPet      = null; // { pet_id, pet_name, owner_name, species } | null

export async function renderGrooming(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  await _render(container);
  clearInterval(_refreshTimer);
  _refreshTimer = setInterval(() => _render(container), 30000);
}

async function _render(container) {
  const res      = await apiFetch(`/api/grooming?store_id=${_storeId}`);
  const sessions = res?.data || [];

  const waiting = sessions.filter(s => s.status === 'waiting').length;
  const inProg  = sessions.filter(s => s.status === 'in_progress').length;
  const done    = sessions.filter(s => s.status === 'done').length;

  container.innerHTML = `
    <div class="space-y-5 w-full">

      <!-- Walk-in bar -->
      <div class="card p-4">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="relative flex-1 min-w-52">
            <label class="input-label">ค้นหาสัตว์เลี้ยง / เจ้าของ / เบอร์โทร</label>
            <input id="ga-search" class="input-field" placeholder="บัดดี้ หรือ 0812345678..." autocomplete="off">
            <div id="ga-dropdown"
                 class="hidden absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-xl
                        shadow-card-hover border border-slate-100 max-h-56 overflow-y-auto text-sm"></div>
          </div>
          <div class="flex-1 min-w-28">
            <label class="input-label">เวลาโดยประมาณ (นาที)</label>
            <input id="ga-time" class="input-field" type="number" value="60" min="15">
          </div>
          <button id="ga-submit" class="btn-primary whitespace-nowrap">+ รับลูกค้า</button>
        </div>
        <div class="flex items-center justify-between mt-2 min-h-6">
          <div id="ga-selected" class="hidden items-center gap-2">
            <span id="ga-chip" class="text-xs bg-primary-subtle text-primary-dark rounded-lg px-3 py-1.5 font-semibold"></span>
            <button id="ga-deselect" class="text-xs text-slate-400 hover:text-red-500 transition-colors">× เปลี่ยน</button>
          </div>
          <button id="ga-register" class="text-xs text-primary hover:underline font-body ml-auto">
            + ลูกค้าใหม่
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-2">
        ${[['⏳','รอ',waiting,'text-amber-500'],['✂️','กำลังทำ',inProg,'text-primary'],['✅','เสร็จ',done,'text-slate-400']]
          .map(([i,l,v,c])=>`<div class="card p-2 sm:p-3 text-center"><div class="text-xl sm:text-2xl">${i}</div><div class="text-xs text-slate-400 font-body mt-0.5 truncate">${l}</div><div class="text-xl sm:text-2xl font-bold ${c} mt-1">${v}</div></div>`).join('')}
      </div>

      <!-- Sessions -->
      <div id="groom-sessions" class="space-y-3">
        ${sessions.length === 0
          ? `<div class="card p-10 text-center text-slate-400 font-body">ยังไม่มีลูกค้าในวันนี้</div>`
          : sessions.map(s => _sessionCard(s)).join('')}
      </div>
    </div>`;

  _selPet = null;
  _bindGroomSearch(container);
  container.querySelector('#ga-submit')?.addEventListener('click', () => _handleGroomWalkin(container));
  container.querySelector('#ga-register')?.addEventListener('click', () => _groomRegister(container));

  container.querySelector('#groom-sessions')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const s  = sessions.find(x => x.id === id);
    if (btn.dataset.action === 'start')    _startSession(id, container);
    if (btn.dataset.action === 'services') _openServicesModal(s, container);
    if (btn.dataset.action === 'complete') _openCompleteModal(s, container);
    if (btn.dataset.action === 'progress') _updateProgress(id, parseInt(btn.dataset.pct), container);
    if (btn.dataset.action === 'print')    _printGroomReport(s);
  });
}

function _sessionCard(s) {
  const elapsed = s.start_time ? _elapsed(new Date(s.start_time)) : null;
  const progress = s.progress || 0;
  const svcs  = Array.isArray(s.services) ? s.services : [];
  const total = svcs.reduce((sum, sv) => sum + (sv.price || 0), 0);

  const STATUS = {
    waiting:     { label: 'รอ',         cls: 'badge-gold',                    border: 'border-l-amber-400' },
    in_progress: { label: 'กำลังทำ',   cls: 'bg-primary-subtle text-primary', border: 'border-l-primary' },
    done:        { label: 'เสร็จแล้ว', cls: 'badge-navy',                     border: 'border-l-slate-300' },
  };
  const cfg = STATUS[s.status] || STATUS.waiting;

  return `
    <div class="card border-l-4 ${cfg.border} p-4 ${s.status==='done' ? 'opacity-60' : ''}">
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-navy">✂️ ${s.pet_name || '—'}</span>
            <span class="badge ${cfg.cls} text-xs">${cfg.label}</span>
          </div>
          <div class="text-sm text-slate-500 font-body mt-0.5">
            ${s.owner_name ? `เจ้าของ: ${s.owner_name} · ` : ''}${s.estimated_minutes} นาที
            ${elapsed ? `· เริ่มมา ${elapsed}` : ''}
          </div>
          ${svcs.length ? `<div class="flex flex-wrap gap-1 mt-2">
            ${svcs.map(sv=>`<span class="badge badge-navy text-xs">${sv.icon||'✂️'} ${sv.name}</span>`).join('')}
            <span class="text-xs text-primary font-semibold ml-1">฿${total.toLocaleString()}</span>
          </div>` : ''}
          ${s.status === 'in_progress' ? `
            <div class="mt-2">
              <div class="flex justify-between text-xs text-slate-400 font-body mb-1">
                <span>ความคืบหน้า</span><span>${progress}%</span>
              </div>
              <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 ${progress<50?'bg-primary':progress<80?'bg-amber-400':'bg-orange-500'}"
                     style="width:${progress}%"></div>
              </div>
            </div>` : ''}
        </div>
        <div class="flex flex-col gap-2 flex-shrink-0">
          ${s.status === 'waiting' ? `
            <button data-action="services" data-id="${s.id}" class="text-xs border border-slate-200 text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">🛁 บริการ</button>
            <button data-action="start" data-id="${s.id}" class="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors">▶ เริ่ม</button>` : ''}
          ${s.status === 'in_progress' ? `
            <button data-action="services" data-id="${s.id}" class="text-xs border border-slate-200 text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">🛁 แก้ไขบริการ</button>
            <div class="flex gap-1">
              ${[25,50,75].map(p => `<button data-action="progress" data-id="${s.id}" data-pct="${p}"
                class="text-xs border border-slate-200 text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors
                       ${progress >= p ? 'bg-primary-subtle border-primary text-primary' : ''}">${p}%</button>`).join('')}
            </div>
            <button data-action="complete" data-id="${s.id}" class="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors">✓ เสร็จสิ้น</button>` : ''}
          ${s.status === 'done' ? `
            <button data-action="print" data-id="${s.id}" class="text-xs border border-slate-200 text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">🖨 รายงาน</button>` : ''}
        </div>
      </div>
    </div>`;
}

async function _updateProgress(id, pct, container) {
  const res = await apiFetch(`/api/grooming/${id}`, { method: 'PATCH', body: JSON.stringify({ progress: pct }) });
  if (res?.success) await _render(container);
  else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
}

async function _startSession(id, container) {
  const res = await apiFetch(`/api/grooming/${id}/start`, { method: 'PATCH', body: '{}' });
  if (res?.success) { await _render(container); showToast('เริ่มบริการแล้ว'); }
  else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
}

function _openServicesModal(session, container) {
  const selected = new Set((session.services || []).map(s => s.id));
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">บริการ — ${session.pet_name}</h3>
      <div class="space-y-2">
        ${SERVICES.map(sv => `
          <label class="flex items-center justify-between p-3 rounded-xl border cursor-pointer
                         ${selected.has(sv.id) ? 'border-primary bg-primary-subtle' : 'border-slate-100 hover:border-primary'} transition-all">
            <div class="flex items-center gap-2">
              <input type="checkbox" value="${sv.id}" ${selected.has(sv.id) ? 'checked' : ''} class="w-4 h-4 accent-primary">
              <span class="text-lg">${sv.icon}</span>
              <span class="font-semibold text-navy text-sm">${sv.name}</span>
            </div>
            <span class="text-sm font-semibold text-primary">฿${sv.price}</span>
          </label>`).join('')}
      </div>
      <div id="svc-total" class="text-right font-bold text-primary text-lg"></div>
      <div class="flex gap-3">
        <button id="svc-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="svc-save"   class="btn-primary flex-1">บันทึก</button>
      </div>
    </div>`;

  const calcTotal = () => {
    const checked = [...modal.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
    const total   = SERVICES.filter(s => checked.includes(s.id)).reduce((sum, s) => sum + s.price, 0);
    modal.querySelector('#svc-total').textContent = `รวม ฿${total.toLocaleString()}`;
  };
  modal.querySelectorAll('input[type=checkbox]').forEach(c => c.addEventListener('change', calcTotal));
  calcTotal();
  document.body.appendChild(modal);

  modal.querySelector('#svc-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#svc-save').addEventListener('click', async () => {
    const checked  = [...modal.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
    const services = SERVICES.filter(s => checked.includes(s.id));
    const res = await apiFetch(`/api/grooming/${session.id}`, { method: 'PATCH', body: JSON.stringify({ services }) });
    if (res?.success) { modal.remove(); await _render(container); showToast('บันทึกบริการแล้ว'); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

function _openCompleteModal(session, container) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-xl2 shadow-card-hover p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">รายงานสุขภาพหลัง Grooming</h3>
      <p class="text-sm text-slate-500 font-body">สัตว์เลี้ยง: <strong>${session.pet_name}</strong></p>
      <div class="space-y-2">
        ${[['skin','ผิวหนัง'],['coat','ขน'],['ear','หู'],['nail','เล็บ'],['eye','ตา']].map(([k,l]) => `
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-navy">${l}</span>
            <div class="flex gap-2">
              <label class="flex items-center gap-1 text-sm cursor-pointer">
                <input type="radio" name="${k}" value="normal" checked class="accent-primary"> ปกติ
              </label>
              <label class="flex items-center gap-1 text-sm cursor-pointer text-orange-500">
                <input type="radio" name="${k}" value="abnormal" class="accent-orange-500"> ผิดปกติ
              </label>
            </div>
          </div>`).join('')}
      </div>
      <div>
        <label class="input-label">หมายเหตุ</label>
        <textarea id="complete-notes" rows="2" class="input-field resize-none" placeholder="ข้อสังเกตอื่นๆ..."></textarea>
      </div>
      <div class="flex gap-3">
        <button id="complete-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="complete-confirm" class="btn-primary flex-1">✓ เสร็จสิ้น</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#complete-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#complete-confirm').addEventListener('click', async () => {
    const report = { checklist: {}, notes: modal.querySelector('#complete-notes').value.trim() };
    ['skin','coat','ear','nail','eye'].forEach(k => {
      report.checklist[k] = modal.querySelector(`input[name="${k}"]:checked`)?.value || 'normal';
    });
    report.referred_to_clinic = Object.values(report.checklist).some(v => v === 'abnormal');
    const res = await apiFetch(`/api/grooming/${session.id}/complete`, { method: 'PATCH', body: JSON.stringify({ health_report: report }) });
    if (res?.success) { modal.remove(); await _render(container); showToast('บันทึกเสร็จสิ้นแล้ว' + (report.referred_to_clinic ? ' ⚠️ พบความผิดปกติ' : '')); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

function _elapsed(since) {
  const mins = Math.floor((Date.now() - since) / 60000);
  if (mins < 60) return `${mins} นาที`;
  return `${Math.floor(mins/60)} ชม. ${mins%60} นาที`;
}

// ─── Pet search (walk-in) ─────────────────────────────────────────────────────

function _bindGroomSearch(container) {
  const input    = container.querySelector('#ga-search');
  const dropdown = container.querySelector('#ga-dropdown');
  if (!input || !dropdown) return;
  const EMOJI = { dog: '🐕', cat: '🐈', rabbit: '🐰', bird: '🐦', other: '🐾' };
  let timer;

  input.addEventListener('input', () => {
    _selPet = null; _updateGroomChip(container);
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { dropdown.classList.add('hidden'); return; }

    timer = setTimeout(async () => {
      const res    = await apiFetch(`/api/pets/owners/search?store_id=${_storeId}&q=${encodeURIComponent(q)}`);
      const owners = res?.data || [];
      if (!owners.length) {
        dropdown.innerHTML = `<div class="px-4 py-3 text-slate-400 font-body text-sm">ไม่พบ "${q}" — <button id="gg-reg" class="text-primary underline text-xs">ลงทะเบียนใหม่</button></div>`;
        dropdown.classList.remove('hidden');
        dropdown.querySelector('#gg-reg')?.addEventListener('click', () => { dropdown.classList.add('hidden'); _groomRegister(container); });
        return;
      }
      const rows = [];
      for (const o of owners) {
        for (const p of (o.pets || [])) rows.push({ pet_id: p.id, pet_name: p.name, species: p.species, owner_name: o.name });
        if (!(o.pets || []).length) rows.push({ _no_pet: true, owner_name: o.name });
      }
      dropdown.innerHTML = rows.map((r, i) => r._no_pet
        ? `<div class="px-4 py-2 text-xs text-slate-400 font-body">${r.owner_name} — ยังไม่มีสัตว์เลี้ยง</div>`
        : `<div class="flex items-center gap-3 px-4 py-2.5 hover:bg-primary-subtle cursor-pointer transition-colors" data-ri="${i}">
             <span>${EMOJI[r.species]||'🐾'}</span>
             <div><div class="font-semibold text-navy text-sm">${r.pet_name}</div>
             <div class="text-xs text-slate-400 font-body">เจ้าของ: ${r.owner_name}</div></div>
           </div>`).join('')
        + `<div class="border-t px-4 py-2"><button id="gg-reg2" class="text-xs text-primary hover:underline font-body">+ ลูกค้าใหม่</button></div>`;
      dropdown.classList.remove('hidden');
      dropdown.querySelectorAll('[data-ri]').forEach(el => {
        el.addEventListener('click', () => {
          const r = rows[parseInt(el.dataset.ri)];
          _selPet = r; input.value = r.pet_name; _updateGroomChip(container); dropdown.classList.add('hidden');
        });
      });
      dropdown.querySelector('#gg-reg2')?.addEventListener('click', () => { dropdown.classList.add('hidden'); _groomRegister(container); });
    }, 300);
  });
  input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 200));
  container.querySelector('#ga-deselect')?.addEventListener('click', () => {
    _selPet = null; input.value = ''; _updateGroomChip(container); input.focus();
  });
}

function _updateGroomChip(container) {
  const el   = container.querySelector('#ga-selected');
  const chip = container.querySelector('#ga-chip');
  if (!el || !chip) return;
  if (_selPet) {
    chip.textContent = `🐾 ${_selPet.pet_name} · ${_selPet.owner_name}`;
    el.classList.remove('hidden'); el.classList.add('flex');
  } else {
    el.classList.add('hidden'); el.classList.remove('flex');
  }
}

async function _handleGroomWalkin(container) {
  const search = container.querySelector('#ga-search');
  const freeText = search?.value.trim() || '';
  const pet_name   = _selPet?.pet_name   || freeText;
  const owner_name = _selPet?.owner_name || '';
  if (!pet_name) { showToast('กรุณาค้นหาหรือกรอกชื่อสัตว์เลี้ยง', 'error'); return; }

  const btn = container.querySelector('#ga-submit');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  const res = await apiFetch('/api/grooming', { method: 'POST', body: JSON.stringify({
    store_id: _storeId,
    pet_id:   _selPet?.pet_id   || null,
    pet_name,
    owner_name,
    species:  _selPet?.species  || 'dog',
    estimated_minutes: parseInt(container.querySelector('#ga-time')?.value) || 60,
  })});

  if (btn) { btn.disabled = false; btn.textContent = '+ รับลูกค้า'; }
  if (res?.success) {
    if (search) search.value = '';
    _selPet = null; _updateGroomChip(container);
    await _render(container); showToast(`รับ ${pet_name} แล้ว`);
  } else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
}

function _groomRegister(container) {
  // reuse same 2-step owner+pet registration pattern
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">ลูกค้าใหม่ — 1/2 เจ้าของ</h3>
      <div><label class="input-label">ชื่อ *</label><input id="rg-name" class="input-field" placeholder="คุณสมชาย" autofocus></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="input-label">เบอร์โทร *</label><input id="rg-phone" class="input-field" type="tel" placeholder="0812345678"></div>
        <div><label class="input-label">อีเมล</label><input id="rg-email" class="input-field" type="email"></div>
      </div>
      <div class="flex gap-3">
        <button id="rg-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="rg-next" class="btn-primary flex-1">ถัดไป →</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#rg-cancel').addEventListener('click', () => m.remove());
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });

  m.querySelector('#rg-next').addEventListener('click', async () => {
    const name = m.querySelector('#rg-name').value.trim();
    const phone= m.querySelector('#rg-phone').value.trim();
    if (!name || !phone) { showToast('กรุณากรอกชื่อและเบอร์', 'error'); return; }
    const btn = m.querySelector('#rg-next');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    const res = await apiFetch('/api/pets/owners', { method: 'POST', body: JSON.stringify({ name, phone, email: m.querySelector('#rg-email').value.trim()||null, store_id: _storeId }) });
    if (!res?.success) { showToast(res?.error||'เกิดข้อผิดพลาด','error'); btn.disabled=false; btn.textContent='ถัดไป →'; return; }
    m.remove();
    const owner = res.data;
    const m2 = document.createElement('div');
    m2.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
    m2.innerHTML = `
      <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h3 class="font-bold text-navy text-lg">ลูกค้าใหม่ — 2/2 สัตว์เลี้ยง</h3>
        <div class="bg-primary-subtle rounded-xl px-4 py-2 text-sm text-primary-dark font-semibold">👤 ${owner.name} · ${owner.phone||''}</div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="input-label">ชื่อสัตว์เลี้ยง *</label><input id="rp-name" class="input-field" placeholder="บัดดี้" autofocus></div>
          <div><label class="input-label">ชนิด</label>
            <select id="rp-species" class="input-field">
              <option value="dog">🐕 สุนัข</option><option value="cat">🐈 แมว</option><option value="rabbit">🐰 กระต่าย</option><option value="bird">🐦 นก</option><option value="other">🐾 อื่นๆ</option>
            </select>
          </div>
        </div>
        <div class="flex gap-3">
          <button id="rp-cancel" class="btn-outline flex-1">ยกเลิก</button>
          <button id="rp-save" class="btn-primary flex-1">บันทึก + เลือก</button>
        </div>
      </div>`;
    document.body.appendChild(m2);
    m2.querySelector('#rp-cancel').addEventListener('click', () => m2.remove());
    m2.addEventListener('click', e => { if (e.target === m2) m2.remove(); });
    m2.querySelector('#rp-save').addEventListener('click', async () => {
      const petName = m2.querySelector('#rp-name').value.trim();
      const species = m2.querySelector('#rp-species').value;
      if (!petName) { showToast('กรุณากรอกชื่อสัตว์', 'error'); return; }
      const b2 = m2.querySelector('#rp-save'); b2.disabled=true; b2.textContent='กำลังบันทึก...';
      const pr = await apiFetch('/api/pets', { method:'POST', body: JSON.stringify({ owner_id: owner.id, store_id: _storeId, name: petName, species }) });
      if (!pr?.success) { showToast(pr?.error||'เกิดข้อผิดพลาด','error'); b2.disabled=false; b2.textContent='บันทึก + เลือก'; return; }
      const pet = pr.data;
      _selPet = { pet_id: pet.id, pet_name: pet.name, species: pet.species, owner_name: owner.name };
      const search = container.querySelector('#ga-search');
      if (search) search.value = pet.name;
      _updateGroomChip(container);
      showToast(`ลงทะเบียน ${petName} แล้ว — กด "+ รับลูกค้า"`);
      m2.remove();
    });
  });
}

// ─── Print grooming session report ───────────────────────────────────────────

function _printGroomReport(session) {
  const svcs    = Array.isArray(session.services) ? session.services : [];
  const total   = svcs.reduce((s, v) => s + (v.price || 0), 0);
  const report  = session.health_report || {};
  const checks  = report.checklist || {};
  const dateStr = new Date(session.end_time || session.created_at).toLocaleString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const checkLabels = { skin: 'ผิวหนัง', coat: 'ขน', ear: 'หู', nail: 'เล็บ', eye: 'ตา' };

  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const storeName = localStorage.getItem('fufu_store_name') || 'ร้าน';

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>รายงาน Grooming — ${esc(session.pet_name)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Sarabun','Tahoma',sans-serif; font-size:12pt; color:#111;
         padding:20mm; max-width:210mm; margin:auto; }
  h1  { font-size:18pt; text-align:center; }
  .sub{ text-align:center; font-size:10pt; color:#555; margin-bottom:6mm; }
  hr  { border:none; border-top:1px solid #ccc; margin:5mm 0; }
  h2  { font-size:13pt; border-left:4px solid #0D9488; padding-left:6px; margin:4mm 0 2mm; }
  .svc-row { display:flex; justify-content:space-between; font-size:11pt; padding:2px 0; }
  .total   { font-weight:bold; font-size:14pt; border-top:1px solid #ccc; padding-top:4px; margin-top:4px; }
  .check   { display:flex; justify-content:space-between; padding:3px 0; font-size:11pt; }
  .ok      { color:#0D9488; }
  .abnormal{ color:#dc2626; font-weight:bold; }
  .footer  { text-align:center; color:#aaa; font-size:10pt; margin-top:12mm; }
  .print-btn { display:block; margin:8mm auto; padding:8px 24px; background:#0D9488;
               color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-family:inherit; }
  @media print { .print-btn { display:none !important; } body { padding:10mm; } }
</style>
</head>
<body>
  <h1>${esc(storeName)}</h1>
  <p class="sub">ใบรายงานการ Grooming · ${dateStr}</p>
  <hr>

  <h2>ข้อมูลสัตว์เลี้ยง</h2>
  <div class="svc-row"><span>ชื่อ</span><span>${esc(session.pet_name)}</span></div>
  ${session.owner_name ? `<div class="svc-row"><span>เจ้าของ</span><span>${esc(session.owner_name)}</span></div>` : ''}
  ${session.groomer_name ? `<div class="svc-row"><span>ช่าง Grooming</span><span>${esc(session.groomer_name)}</span></div>` : ''}

  <h2>รายการบริการ</h2>
  ${svcs.length ? svcs.map(s => `<div class="svc-row"><span>${esc(s.icon||'')} ${esc(s.name)}</span><span>฿${(s.price||0).toLocaleString('th-TH')}</span></div>`).join('')
               : '<p style="color:#888">ไม่มีบริการ</p>'}
  <div class="svc-row total"><span>รวม</span><span>฿${total.toLocaleString('th-TH')}</span></div>

  ${Object.keys(checks).length ? `
  <h2>รายงานสุขภาพ</h2>
  ${Object.entries(checkLabels).map(([k, l]) =>
    `<div class="check"><span>${l}</span>
     <span class="${checks[k]==='abnormal'?'abnormal':'ok'}">${checks[k]==='abnormal'?'⚠ ผิดปกติ':'✓ ปกติ'}</span></div>`
  ).join('')}
  ${report.notes ? `<p style="margin-top:4px;font-size:10pt;color:#555;">หมายเหตุ: ${esc(report.notes)}</p>` : ''}
  ${report.referred_to_clinic ? `<p style="margin-top:4px;color:#dc2626;font-weight:bold;">⚠ แนะนำพาพบสัตวแพทย์</p>` : ''}` : ''}

  <div class="footer">ขอบคุณที่ใช้บริการ · Powered by FUFU Partner</div>
  <button class="print-btn" onclick="window.print()">🖨 พิมพ์ / บันทึก PDF</button>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const tab  = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (!tab) showToast('กรุณาอนุญาต Pop-up', 'error');
}
