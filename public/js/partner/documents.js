import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { logAudit }  from './audit.js';

const TEMPLATES = {
  consent:     { icon: '📋', title: 'หนังสือยินยอม',    color: '#0D9488' },
  lab_report:  { icon: '🔬', title: 'ผล Lab',            color: '#8B5CF6' },
  referral:    { icon: '📤', title: 'ใบส่งตัว',          color: '#F97316' },
  prescription:{ icon: '💊', title: 'ใบสั่งยา',          color: '#10B981' },
  receipt:     { icon: '🧾', title: 'ใบเสร็จ',           color: '#3B82F6' },
  certificate: { icon: '📜', title: 'ใบรับรองสุขภาพ',    color: '#EAB308' },
};

const STATUS_CFG = {
  draft:     { label: 'แบบร่าง',   bg: '#FFF8E1', color: '#F59E0B' },
  signed:    { label: 'เซ็นแล้ว', bg: '#E8F5E9', color: '#10B981' },
  finalized: { label: 'สมบูรณ์',  bg: '#E3F2FD', color: '#3B82F6' },
  voided:    { label: 'ยกเลิก',   bg: '#FFEBEE', color: '#EF4444' },
};

let _storeId = '';
let _docs    = [];
let _abort   = null;

export async function renderDocumentCenter(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  await _render(container);
}

async function _render(container) {
  if (_abort) _abort.abort();
  _abort = new AbortController();
  const sig = _abort.signal;

  const res = await apiFetch(`/api/documents?store_id=${_storeId}`);
  _docs = res?.data || [];

  container.innerHTML = `
    <div class="space-y-4 max-w-4xl">
      <div class="flex items-center justify-between">
        <h2 class="font-bold text-navy text-lg">📄 ศูนย์เอกสาร</h2>
      </div>

      <!-- Template shortcuts -->
      <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
        ${Object.entries(TEMPLATES).map(([k, v]) => `
          <button class="doc-tmpl card p-3 flex flex-col items-center gap-1.5 hover:shadow-md transition-shadow cursor-pointer" data-type="${k}">
            <span class="text-2xl">${v.icon}</span>
            <span class="text-xs font-semibold text-navy text-center leading-tight">${v.title}</span>
          </button>`).join('')}
      </div>

      <!-- Search + filter -->
      <div class="card p-4">
        <div class="flex gap-3 mb-4">
          <input id="doc-search" type="text" placeholder="ค้นหา..."
            class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary font-body">
          <select id="doc-filter" class="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary font-body">
            <option value="">ทุกประเภท</option>
            ${Object.entries(TEMPLATES).map(([k, v]) => `<option value="${k}">${v.title}</option>`).join('')}
          </select>
        </div>
        <div id="doc-list" class="space-y-2">
          ${_docs.length === 0
            ? `<div class="py-12 text-center text-slate-400 font-body text-sm">ยังไม่มีเอกสาร — กดที่ประเภทด้านบนเพื่อสร้าง</div>`
            : _docs.map(_docRow).join('')}
        </div>
      </div>
    </div>`;

  // Template click → create
  container.querySelectorAll('.doc-tmpl').forEach(btn => {
    btn.addEventListener('click', () => _openCreateModal(btn.dataset.type, container), { signal: sig });
  });

  // Search + filter
  const searchEl = container.querySelector('#doc-search');
  const filterEl = container.querySelector('#doc-filter');
  const listEl   = container.querySelector('#doc-list');

  const refilter = () => {
    const q  = searchEl.value.toLowerCase();
    const ft = filterEl.value;
    const visible = _docs.filter(d =>
      (!ft || d.doc_type === ft) && (!q || d.title.toLowerCase().includes(q) || (d.pet_name||'').toLowerCase().includes(q))
    );
    listEl.innerHTML = visible.length
      ? visible.map(_docRow).join('')
      : `<div class="py-8 text-center text-slate-400 font-body text-sm">ไม่พบเอกสาร</div>`;
    _bindActions(container, sig);
  };
  searchEl?.addEventListener('input', refilter, { signal: sig });
  filterEl?.addEventListener('change', refilter, { signal: sig });
  _bindActions(container, sig);
}

function _docRow(d) {
  const tmpl  = TEMPLATES[d.doc_type]  || {};
  const sCfg  = STATUS_CFG[d.status]   || STATUS_CFG.draft;
  const date  = new Date(d.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  return `
    <div class="doc-item flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors" data-id="${d.id}">
      <span class="text-2xl flex-shrink-0" style="color:${tmpl.color}">${tmpl.icon}</span>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm text-navy truncate">${d.title}</div>
        <div class="text-xs text-slate-400 font-body">
          ${tmpl.title}${d.pet_name ? ` · ${d.pet_name}` : ''} · ${d.created_by || ''} · ${date}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
          style="background:${sCfg.bg};color:${sCfg.color}">${sCfg.label}</span>
        ${d.doc_type === 'consent' ? `
          <button data-action="edit-consent" data-id="${d.id}" data-doc='${JSON.stringify(d).replace(/'/g,"&#39;")}'
            class="text-xs border border-slate-200 text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors">แก้ไข</button>` : ''}
        <button data-action="print" data-id="${d.id}" data-doc='${JSON.stringify(d).replace(/'/g,"&#39;")}'
          class="text-xs border border-slate-200 text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors">🖨</button>
        ${d.status === 'draft' ? `
          <button data-action="sign" data-id="${d.id}"
            class="text-xs px-2 py-1 rounded-lg font-semibold transition-colors"
            style="background:#E8F5E9;color:#10B981">เซ็น</button>` : ''}
        ${d.status !== 'voided' && d.status !== 'draft' ? `
          <button data-action="finalize" data-id="${d.id}"
            class="text-xs px-2 py-1 rounded-lg font-semibold transition-colors"
            style="background:#E3F2FD;color:#3B82F6">ยืนยัน</button>` : ''}
        <button data-action="delete" data-id="${d.id}"
          class="text-xs text-red-400 hover:text-red-600 transition-colors px-1">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`;
}

function _bindActions(container, sig) {
  container.querySelector('#doc-list')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'edit-consent') {
      const doc = JSON.parse(btn.dataset.doc);
      _openConsentModal(doc, container);
      return;
    }
    if (action === 'print') {
      const doc = JSON.parse(btn.dataset.doc);
      _printDocument(doc);
      return;
    }
    if (action === 'sign') {
      const res = await apiFetch(`/api/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'signed' }) });
      if (res?.success) { showToast('เซ็นเอกสารแล้ว'); logAudit('update', 'document', id, null, { status: 'signed' }, 'sign document'); await _render(container); }
      else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
    if (action === 'finalize') {
      const res = await apiFetch(`/api/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'finalized' }) });
      if (res?.success) { showToast('ยืนยันเอกสารแล้ว'); await _render(container); }
      else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
    if (action === 'delete') {
      if (btn.dataset.confirm !== 'true') {
        btn.dataset.confirm = 'true';
        btn.style.cssText = 'color:#EF4444;font-size:0.7rem;';
        btn.innerHTML = 'ยืนยันลบ?';
        setTimeout(() => { btn.dataset.confirm = 'false'; btn.style.cssText = ''; btn.innerHTML = '<i class="fas fa-trash"></i>'; }, 3000);
        return;
      }
      const res = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res?.success) { showToast('ลบเอกสารแล้ว', 'info'); await _render(container); }
      else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  }, { signal: sig });
}

function _openCreateModal(docType, container) {
  if (docType === 'consent') { _openConsentModal(null, container); return; }

  const tmpl = TEMPLATES[docType];
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">${tmpl.icon} สร้าง${tmpl.title}</h3>
      <div class="space-y-3">
        <div><label class="input-label">ชื่อเอกสาร *</label>
          <input id="dc-title" class="input-field" placeholder="${tmpl.title} — ชื่อสัตว์เลี้ยง"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="input-label">ชื่อสัตว์เลี้ยง</label>
            <input id="dc-pet" class="input-field" placeholder="บัดดี้"></div>
          <div><label class="input-label">ชื่อเจ้าของ</label>
            <input id="dc-owner" class="input-field" placeholder="คุณสมชาย"></div>
        </div>
      </div>
      <div class="flex gap-3">
        <button id="dc-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="dc-confirm" class="btn-primary flex-1">สร้าง</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#dc-cancel').addEventListener('click', () => m.remove());
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });

  m.querySelector('#dc-confirm').addEventListener('click', async () => {
    const title = m.querySelector('#dc-title').value.trim();
    if (!title) { showToast('กรุณากรอกชื่อเอกสาร', 'error'); return; }
    const res = await apiFetch('/api/documents', { method: 'POST', body: JSON.stringify({
      store_id:   _storeId,
      doc_type:   docType,
      title,
      pet_name:   m.querySelector('#dc-pet').value.trim()   || null,
      owner_name: m.querySelector('#dc-owner').value.trim() || null,
    })});
    if (res?.success) {
      m.remove(); showToast(`สร้าง${tmpl.title}แล้ว`);
      logAudit('create', 'document', res.data.id, null, { doc_type: docType }, 'create document');
      await _render(container);
    } else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}

// ─── Consent Form Modal ───────────────────────────────────────────────────────

function _openConsentModal(existingDoc, container) {
  const c = existingDoc?.content || {};
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 my-4">
      <h3 class="font-bold text-navy text-lg">📋 หนังสือยินยอมการรักษา</h3>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ชื่อสัตว์เลี้ยง *</label>
          <input id="cf-pet" class="input-field" value="${existingDoc?.pet_name || ''}" placeholder="บัดดี้">
        </div>
        <div>
          <label class="input-label">ชนิด / สายพันธุ์</label>
          <input id="cf-species" class="input-field" value="${c.species || ''}" placeholder="สุนัข Golden Retriever">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="input-label">ชื่อเจ้าของ *</label>
          <input id="cf-owner" class="input-field" value="${existingDoc?.owner_name || ''}" placeholder="คุณสมชาย">
        </div>
        <div>
          <label class="input-label">เบอร์โทรเจ้าของ</label>
          <input id="cf-phone" class="input-field" value="${c.owner_phone || ''}" placeholder="0812345678">
        </div>
      </div>

      <div>
        <label class="input-label">หัตถการ / การรักษา *</label>
        <input id="cf-procedure" class="input-field" value="${c.procedure || ''}"
          placeholder="ผ่าตัดทำหมัน (Ovariohysterectomy)">
      </div>

      <div>
        <label class="input-label">รายละเอียดและเหตุผล</label>
        <textarea id="cf-reason" rows="3" class="input-field resize-none"
          placeholder="เหตุผลที่แนะนำให้ทำหัตถการนี้...">${c.reason || ''}</textarea>
      </div>

      <div>
        <label class="input-label">ความเสี่ยงที่อาจเกิดขึ้น</label>
        <textarea id="cf-risks" rows="3" class="input-field resize-none"
          placeholder="- เสี่ยงต่อการแพ้ยาสลบ&#10;- เสี่ยงต่อการติดเชื้อหลังผ่าตัด&#10;- ...">${c.risks || '- เสี่ยงต่อการแพ้ยาสลบ\n- เสี่ยงต่อการติดเชื้อหลังผ่าตัด'}</textarea>
      </div>

      <div>
        <label class="input-label">ชื่อสัตวแพทย์ผู้รับผิดชอบ</label>
        <input id="cf-vet" class="input-field" value="${c.vet_name || ''}" placeholder="สพ.ญ. สมหญิง">
      </div>

      <div class="flex gap-3">
        <button id="cf-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="cf-print"  class="btn-outline flex-1">🖨 พิมพ์</button>
        <button id="cf-save"   class="btn-primary flex-1">บันทึก</button>
      </div>
    </div>`;

  document.body.appendChild(m);
  m.querySelector('#cf-cancel').addEventListener('click', () => m.remove());
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });

  const _collect = () => ({
    pet_name:   m.querySelector('#cf-pet').value.trim(),
    owner_name: m.querySelector('#cf-owner').value.trim(),
    content: {
      species:     m.querySelector('#cf-species').value.trim() || null,
      owner_phone: m.querySelector('#cf-phone').value.trim()   || null,
      procedure:   m.querySelector('#cf-procedure').value.trim(),
      reason:      m.querySelector('#cf-reason').value.trim()  || null,
      risks:       m.querySelector('#cf-risks').value.trim()   || null,
      vet_name:    m.querySelector('#cf-vet').value.trim()     || null,
    },
  });

  m.querySelector('#cf-print')?.addEventListener('click', () => {
    const d = _collect();
    if (!d.pet_name || !d.content.procedure) { showToast('กรุณากรอกชื่อสัตว์และหัตถการก่อน', 'error'); return; }
    import('../utils/print-docs.js').then(({ printConsentForm }) => {
      const si = (() => { try { return JSON.parse(localStorage.getItem('fufu_store_info') || '{}'); } catch { return {}; } })();
      printConsentForm({ storeName: si.name, storePhone: si.phone, storeAddr: si.address, ...d.content, petName: d.pet_name, ownerName: d.owner_name, date: new Date().toISOString() });
    });
  });

  m.querySelector('#cf-save')?.addEventListener('click', async () => {
    const d = _collect();
    if (!d.pet_name || !d.content.procedure) { showToast('กรุณากรอกชื่อสัตว์และหัตถการ', 'error'); return; }
    const btn = m.querySelector('#cf-save');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    const body = {
      store_id:   _storeId,
      doc_type:   'consent',
      title:      `ยินยอม: ${d.content.procedure} — ${d.pet_name}`,
      pet_name:   d.pet_name,
      owner_name: d.owner_name,
      content:    d.content,
    };

    const res = existingDoc
      ? await apiFetch(`/api/documents/${existingDoc.id}`, { method: 'PATCH', body: JSON.stringify({ content: d.content, pet_name: d.pet_name, owner_name: d.owner_name }) })
      : await apiFetch('/api/documents', { method: 'POST', body: JSON.stringify(body) });

    if (res?.success) {
      m.remove(); showToast('บันทึกหนังสือยินยอมแล้ว');
      logAudit('create', 'document', res.data?.id, null, { doc_type: 'consent' }, 'consent form');
      await _render(container);
    } else {
      showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });

  setTimeout(() => m.querySelector('#cf-pet')?.focus(), 50);
}

// ─── Generic print dispatcher ─────────────────────────────────────────────────

function _printDocument(doc) {
  const si = (() => { try { return JSON.parse(localStorage.getItem('fufu_store_info') || '{}'); } catch { return {}; } })();
  const c  = doc.content || {};

  if (doc.doc_type === 'consent') {
    import('../utils/print-docs.js').then(({ printConsentForm }) => {
      printConsentForm({
        storeName: si.name, storePhone: si.phone, storeAddr: si.address,
        petName: doc.pet_name, ownerName: doc.owner_name,
        species: c.species, owner_phone: c.owner_phone,
        procedure: c.procedure, reason: c.reason, risks: c.risks,
        vet_name: c.vet_name, date: doc.created_at,
      });
    });
    return;
  }
  showToast('ยังไม่รองรับ print ประเภทนี้', 'error');
}
