import { apiFetch }  from '../utils/api-client.js';
import { storage }   from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { STORAGE_KEYS } from '../utils/config.js';

let _storeId = '';
let _tasks   = [];

const PRIORITY_CFG = {
  low:    { color: '#6B7280', label: 'ต่ำ',   icon: '⬇️' },
  normal: { color: '#3B82F6', label: 'ปกติ',  icon: '➡️' },
  high:   { color: '#F97316', label: 'สูง',   icon: '⬆️' },
  urgent: { color: '#EF4444', label: 'ด่วน',  icon: '🔥' },
};

const COLUMNS = [
  { id: 'todo',        label: '📋 รอดำเนินการ', color: '#6B7280' },
  { id: 'in_progress', label: '🔄 กำลังทำ',     color: '#F97316' },
  { id: 'done',        label: '✅ เสร็จแล้ว',    color: '#10B981' },
];

export async function renderKanban(container) {
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  await _render(container);
}

async function _render(container) {
  const res = await apiFetch(`/api/tasks?store_id=${_storeId}`);
  _tasks = res?.data || [];

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="font-bold text-navy text-lg">📌 Task Board</h2>
        <button id="kanban-add" class="btn-primary text-sm px-4 py-2">+ เพิ่มงาน</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${COLUMNS.map(col => `
          <div class="bg-slate-50 rounded-xl p-3" data-col="${col.id}">
            <div class="flex items-center justify-between mb-3 px-1">
              <span class="font-semibold text-sm" style="color:${col.color}">${col.label}</span>
              <span class="text-xs text-slate-400 font-body bg-white px-2 py-0.5 rounded-full border">
                ${_tasks.filter(t => t.status === col.id).length}
              </span>
            </div>
            <div class="space-y-2 kanban-col" data-status="${col.id}" style="min-height:4rem">
              ${_tasks.filter(t => t.status === col.id).map(_taskCard).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  container.querySelector('#kanban-add')?.addEventListener('click', () => _openAddModal(container));

  // Drag & drop
  container.querySelectorAll('.kanban-task').forEach(card => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.taskId);
      card.classList.add('opacity-50');
    });
    card.addEventListener('dragend', () => card.classList.remove('opacity-50'));
  });

  container.querySelectorAll('.kanban-col').forEach(col => {
    col.addEventListener('dragover',  e => { e.preventDefault(); col.style.background = 'rgba(13,148,136,0.05)'; });
    col.addEventListener('dragleave', () => col.style.background = '');
    col.addEventListener('drop', async e => {
      e.preventDefault(); col.style.background = '';
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = col.dataset.status;
      const task = _tasks.find(t => t.id === taskId);
      if (task && task.status !== newStatus) {
        const res = await apiFetch(`/api/tasks/${taskId}`, {
          method: 'PATCH', body: JSON.stringify({ status: newStatus }),
        });
        if (res?.success) { await _render(container); showToast(`ย้าย "${task.title}" แล้ว`); }
        else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
      }
    });
  });

  // Status move via dropdown
  container.addEventListener('change', async e => {
    const sel = e.target.closest('[data-move-task]');
    if (!sel) return;
    const taskId   = sel.dataset.moveTask;
    const newStatus = sel.value;
    const task = _tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH', body: JSON.stringify({ status: newStatus }),
      });
      if (res?.success) { await _render(container); showToast(`ย้าย "${task.title}" แล้ว`); }
      else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  });

  // Delete & edit
  container.addEventListener('click', async e => {
    const del = e.target.closest('[data-delete-task]');
    if (del) {
      if (del.dataset.confirm !== 'true') {
        del.dataset.confirm = 'true'; del.textContent = '?';
        setTimeout(() => { del.dataset.confirm = 'false'; del.textContent = '×'; }, 2000);
        return;
      }
      const res = await apiFetch(`/api/tasks/${del.dataset.deleteTask}`, { method: 'DELETE' });
      if (res?.success) await _render(container);
    }
  });
}

function _taskCard(task) {
  const p = PRIORITY_CFG[task.priority] || PRIORITY_CFG.normal;
  const due = task.due_date
    ? new Date(task.due_date + 'T00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    : '';
  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
  const colCfg = COLUMNS.find(c => c.id === task.status) || COLUMNS[0];
  return `
    <div class="kanban-task bg-white rounded-xl p-3 shadow-sm border border-slate-100 cursor-grab"
         data-task-id="${task.id}">
      <!-- Priority badge + delete -->
      <div class="flex items-start justify-between gap-1 mb-2">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full"
              style="background:${p.color}22;color:${p.color}">${p.icon} ${p.label}</span>
        <div class="flex items-center gap-1.5">
          ${due ? `<span class="text-xs font-body ${isOverdue ? 'text-red-500 font-semibold' : 'text-slate-400'}">${due}</span>` : ''}
          <button data-delete-task="${task.id}"
            class="text-slate-300 hover:text-red-400 transition-colors text-base leading-none w-4 flex-shrink-0">×</button>
        </div>
      </div>
      <!-- Title -->
      <div class="text-sm font-semibold text-navy leading-snug mb-1.5">${task.title}</div>
      ${task.description ? `<div class="text-xs text-slate-400 font-body mb-2 line-clamp-2">${task.description}</div>` : ''}
      <!-- Assignee -->
      ${task.assigned_to ? `<div class="text-xs text-slate-500 font-body mb-2 flex items-center gap-1">
        <i class="fas fa-user text-slate-300 text-[10px]"></i>${task.assigned_to}
      </div>` : ''}
      <!-- Tags -->
      ${(task.tags || []).length ? `<div class="flex gap-1 flex-wrap mb-2">
        ${(task.tags || []).map(t => `<span class="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-body">${t}</span>`).join('')}
      </div>` : ''}
      <!-- Status move dropdown -->
      <div class="border-t border-slate-50 pt-2 flex items-center justify-between gap-2">
        <span class="text-xs font-body px-2 py-0.5 rounded-full"
              style="background:${colCfg.color}22;color:${colCfg.color}">${colCfg.label}</span>
        <select data-move-task="${task.id}"
          class="text-xs border border-slate-200 rounded-lg px-2 py-1 font-body text-slate-600
                 focus:border-primary outline-none cursor-pointer">
          ${COLUMNS.map(c => `<option value="${c.id}" ${task.status === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

function _openAddModal(container) {
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4';
  m.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h3 class="font-bold text-navy text-lg">+ เพิ่มงานใหม่</h3>
      <div class="space-y-3">
        <div><label class="input-label">ชื่องาน *</label>
          <input id="tk-title" class="input-field" placeholder="สั่งยา Amoxicillin เพิ่ม"></div>
        <div><label class="input-label">รายละเอียด</label>
          <textarea id="tk-desc" class="input-field resize-none" rows="2" placeholder="รายละเอียดเพิ่มเติม..."></textarea></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="input-label">ความสำคัญ</label>
            <select id="tk-priority" class="input-field">
              <option value="normal">➡️ ปกติ</option>
              <option value="high">⬆️ สูง</option>
              <option value="urgent">🔥 ด่วน</option>
              <option value="low">⬇️ ต่ำ</option>
            </select></div>
          <div><label class="input-label">กำหนดส่ง</label>
            <input id="tk-due" class="input-field" type="date"></div>
          <div><label class="input-label">มอบหมายให้</label>
            <input id="tk-assigned" class="input-field" placeholder="ชื่อพนักงาน"></div>
          <div><label class="input-label">แท็ก (คั่นด้วย ,)</label>
            <input id="tk-tags" class="input-field" placeholder="lab, opd"></div>
        </div>
      </div>
      <div class="flex gap-3">
        <button id="tk-cancel" class="btn-outline flex-1">ยกเลิก</button>
        <button id="tk-confirm" class="btn-primary flex-1">เพิ่มงาน</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#tk-cancel').addEventListener('click', () => m.remove());
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });

  m.querySelector('#tk-confirm').addEventListener('click', async () => {
    const title = m.querySelector('#tk-title').value.trim();
    if (!title) { showToast('กรุณากรอกชื่องาน', 'error'); return; }
    const tagsRaw = m.querySelector('#tk-tags').value.trim();
    const res = await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify({
      store_id:    _storeId,
      title,
      description: m.querySelector('#tk-desc').value.trim() || null,
      priority:    m.querySelector('#tk-priority').value,
      due_date:    m.querySelector('#tk-due').value || null,
      assigned_to: m.querySelector('#tk-assigned').value.trim() || null,
      tags:        tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
    })});
    if (res?.success) { m.remove(); showToast(`เพิ่ม "${title}" แล้ว`); await _render(container); }
    else showToast(res?.error || 'เกิดข้อผิดพลาด', 'error');
  });
}
