import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

const SERVICES = [
  { id: 'bath',    name: 'อาบน้ำ',             icon: '🛁', price: 200 },
  { id: 'nail',    name: 'ตัดเล็บ',             icon: '💅', price: 80  },
  { id: 'ear',     name: 'ทำความสะอาดหู',       icon: '👂', price: 100 },
  { id: 'teeth',   name: 'แปรงฟัน',             icon: '🪥', price: 120 },
  { id: 'spa',     name: 'สปาผิว',               icon: '💆', price: 350 },
  { id: 'haircut', name: 'ตัดขน',               icon: '✂️', price: 300 },
];

let _storeId = '';
let _refreshTimer = null;

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
    <div class="space-y-5 max-w-4xl">

      <!-- Walk-in bar -->
      <div class="card p-4">
        <form id="groom-add-form" class="flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-32"><label class="input-label">ชื่อสัตว์เลี้ยง</label><input id="ga-pet" class="input-field" placeholder="บัดดี้" required></div>
          <div class="flex-1 min-w-32"><label class="input-label">ชื่อเจ้าของ</label><input id="ga-owner" class="input-field" placeholder="คุณสมชาย"></div>
          <div class="flex-1 min-w-28"><label class="input-label">เวลาโดยประมาณ (นาที)</label><input id="ga-time" class="input-field" type="number" value="60" min="15"></div>
          <button type="submit" class="btn-primary whitespace-nowrap">+ รับลูกค้า</button>
        </form>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-3">
        ${[['⏳','รอ',waiting,'text-amber-500'],['✂️','กำลังทำ',inProg,'text-primary'],['✅','เสร็จ',done,'text-slate-400']]
          .map(([i,l,v,c])=>`<div class="card p-3 text-center"><div class="text-2xl">${i}</div><div class="text-xs text-slate-400 font-body mt-0.5">${l}</div><div class="text-2xl font-bold ${c} mt-1">${v}</div></div>`).join('')}
      </div>

      <!-- Sessions -->
      <div id="groom-sessions" class="space-y-3">
        ${sessions.length === 0
          ? `<div class="card p-10 text-center text-slate-400 font-body">ยังไม่มีลูกค้าในวันนี้</div>`
          : sessions.map(s => _sessionCard(s)).join('')}
      </div>
    </div>`;

  container.querySelector('#groom-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    const res = await apiFetch('/api/grooming', { method: 'POST', body: JSON.stringify({
      store_id: _storeId,
      pet_name: container.querySelector('#ga-pet').value.trim(),
      owner_name: container.querySelector('#ga-owner').value.trim(),
      estimated_minutes: parseInt(container.querySelector('#ga-time').value) || 60,
    })});
    btn.disabled = false;
    if (res?.success) { e.target.reset(); await _render(container); showToast('รับลูกค้าแล้ว'); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });

  container.querySelector('#groom-sessions')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const s  = sessions.find(x => x.id === id);
    if (btn.dataset.action === 'start')    _startSession(id, container);
    if (btn.dataset.action === 'services') _openServicesModal(s, container);
    if (btn.dataset.action === 'complete') _openCompleteModal(s, container);
    if (btn.dataset.action === 'progress') _updateProgress(id, parseInt(btn.dataset.pct), container);
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
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
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
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
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
