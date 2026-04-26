/**
 * FUFU Partner – Kanban Task Board
 * Drag-and-drop task management: Todo → In Progress → Done
 * @module partner/kanban
 */

import { showToast } from '../utils/notifications.js';

let tasks = [];

function getDemoTasks() {
  return [
    { id: 't1', title: 'สั่งยา Amoxicillin เพิ่ม', status: 'todo', priority: 'high', assigned: 'น้องแนน', due: '2025-04-23', tags: ['inventory'] },
    { id: 't2', title: 'เตรียมกรง ICU สำหรับ Case ใหม่', status: 'todo', priority: 'urgent', assigned: 'พนักงาน A', due: '2025-04-22', tags: ['ipd'] },
    { id: 't3', title: 'ทำ Lab CBC — มิลค์', status: 'in_progress', priority: 'high', assigned: 'Lab Tech', due: '2025-04-22', tags: ['lab'] },
    { id: 't4', title: 'โทรนัด Follow-up บัดดี้', status: 'in_progress', priority: 'normal', assigned: 'น้องแนน', due: '2025-04-24', tags: ['opd'] },
    { id: 't5', title: 'ส่ง X-Ray ช็อคโก ให้ Specialist', status: 'done', priority: 'high', assigned: 'พญ.สมใจ', due: '2025-04-21', tags: ['referral'] },
    { id: 't6', title: 'อัปเดตราคาวัคซีน 2025', status: 'done', priority: 'low', assigned: 'Admin', due: '2025-04-20', tags: ['inventory'] },
  ];
}

const priorityConfig = {
  low: { color: '#6B7280', label: 'ต่ำ', icon: '⬇️' },
  normal: { color: '#3B82F6', label: 'ปกติ', icon: '➡️' },
  high: { color: '#F97316', label: 'สูง', icon: '⬆️' },
  urgent: { color: '#EF4444', label: 'ด่วน', icon: '🔥' },
};

const columns = [
  { id: 'todo', label: '📋 รอดำเนินการ', color: '#6B7280' },
  { id: 'in_progress', label: '🔄 กำลังทำ', color: '#F97316' },
  { id: 'done', label: '✅ เสร็จแล้ว', color: '#10B981' },
];

export function renderKanban(container) {
  tasks = getDemoTasks();

  container.innerHTML = `
    <div class="kanban-board">
      <div class="card-header" style="margin-bottom:12px;">
        <div class="card-title">📌 Task Board</div>
        <button class="btn-sm btn-primary" id="kanban-add"><i class="fas fa-plus"></i> เพิ่มงาน</button>
      </div>
      <div class="kanban-columns">
        ${columns.map(col => `
          <div class="kanban-col" data-status="${col.id}">
            <div class="kanban-col-header" style="--col-color:${col.color}">
              <span>${col.label}</span>
              <span class="kanban-count">${tasks.filter(t=>t.status===col.id).length}</span>
            </div>
            <div class="kanban-col-body" data-status="${col.id}">
              ${tasks.filter(t => t.status === col.id).map(t => renderTaskCard(t)).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;

  // Drag & drop
  container.querySelectorAll('.kanban-task').forEach(card => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.taskId);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  container.querySelectorAll('.kanban-col-body').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.status = col.dataset.status;
        renderKanban(container);
        showToast(`ย้าย "${task.title}" สำเร็จ`);
      }
    });
  });

  document.getElementById('kanban-add')?.addEventListener('click', () => showToast('เพิ่มงานใหม่'));
}

function renderTaskCard(task) {
  const p = priorityConfig[task.priority] || priorityConfig.normal;
  return `
    <div class="kanban-task" data-task-id="${task.id}" style="--pri-color:${p.color}">
      <div class="kt-header">
        <span class="kt-priority" title="${p.label}">${p.icon}</span>
        <span class="kt-due">${task.due ? new Date(task.due+'T00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : ''}</span>
      </div>
      <div class="kt-title">${task.title}</div>
      <div class="kt-footer">
        <span class="kt-assigned"><i class="fas fa-user"></i> ${task.assigned}</span>
        <div class="kt-tags">${(task.tags||[]).map(t=>`<span class="kt-tag">${t}</span>`).join('')}</div>
      </div>
    </div>`;
}
