/**
 * FUFU Partner – Queue Management Module (Enhanced)
 * Renders queue previews, full queue tables, interactive calendar,
 * priority tags, auto-numbering, wait-time estimator, and TV display mode.
 * @module partner/queue
 * 
 * Acceptance Criteria:
 * - [x] Vanilla JS + CSS Grid calendar implementation (no external libs).
 * - [x] Priority tags correctly display colors.
 * - [x] TV Display mode toggles full screen UI.
 * - [x] Feature flags enforce calendar and TV mode availability.
 */

import { showToast } from '../utils/notifications.js';
import { formatThaiDate, formatThaiDateShort } from '../utils/formatters.js';
import { FEATURE_FLAGS, STORAGE_KEYS } from '../utils/config.js';
import { apiRequest } from '../utils/supabase-client.js';

// ===== CONSTANTS =====
const PRIORITY = {
  emergency: { label: '🔴 ฉุกเฉิน', class: 'priority-emergency', color: '#EF4444' },
  vip: { label: '⭐ VIP', class: 'priority-vip', color: '#F59E0B' },
  normal: { label: 'ปกติ', class: 'priority-normal', color: '#64748B' },
};

const STATUS = {
  waiting: { label: 'รอ', class: 'qs-waiting', color: '#F59E0B' },
  called: { label: 'เรียกแล้ว', class: 'qs-active', color: '#8B5CF6' },
  in_progress: { label: 'กำลังรักษา', class: 'qs-active', color: '#3B82F6' },
  completed: { label: 'เสร็จสิ้น', class: 'qs-done', color: '#10B981' },
  cancelled: { label: 'ยกเลิก', class: 'qs-cancelled', color: '#EF4444' },
  no_show: { label: 'ไม่มา', class: 'qs-noshow', color: '#64748B' },
};

// ===== QUEUE COUNTER =====
let queueCounter = 0;

/**
 * Generate the next auto-incrementing queue number.
 * @param {string} prefix - Queue prefix (e.g., 'A', 'G', 'H')
 * @returns {string}
 */
function nextQueueNumber(prefix = 'A') {
  queueCounter++;
  return `${prefix}${String(queueCounter).padStart(3, '0')}`;
}

/**
 * Estimate wait time based on position and avg service time.
 * @param {number} position - Position in queue (0-indexed)
 * @param {number} avgMinutes - Average service time in minutes
 * @returns {string}
 */
function estimateWaitTime(position, avgMinutes = 20) {
  if (position <= 0) return 'ตอนนี้';
  const mins = position * avgMinutes;
  if (mins < 60) return `~${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `~${hrs} ชม. ${rem > 0 ? rem + ' นาที' : ''}`;
}

// ===== RENDER FUNCTIONS =====

/**
 * Render the queue preview list on the dashboard.
 * @param {Array} queue - Array of queue items
 */
export function renderQueue(queue) {
  const ql = document.getElementById('queue-list');
  if (!ql || !queue) return;

  ql.innerHTML = queue.slice(0, 4).map((q, i) => {
    const priority = PRIORITY[q.priority] || PRIORITY.normal;
    const waitTime = estimateWaitTime(i);

    return `
      <div class="queue-item" role="listitem" aria-label="คิว ${q.num}">
        <div class="queue-num">${q.num}</div>
        <div class="queue-info">
          <div class="queue-pet">${q.pet}</div>
          <div class="queue-owner">${q.owner}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
          <div class="queue-time">${q.time}</div>
          ${q.priority && q.priority !== 'normal'
        ? `<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${priority.color}15;color:${priority.color}">${priority.label}</span>`
        : `<span style="font-size:10px;color:var(--text-muted)">${waitTime}</span>`
      }
        </div>
        <span class="queue-status qs-${q.status}">${q.statusLabel}</span>
      </div>`;
  }).join('');
}

/**
 * Render the full queue table on the queue page (enhanced).
 * @param {Object} demoData - Full demo data object for current role
 */
export async function renderFullQueue(demoData) {
  const container = document.getElementById('page-queue');
  if (!container) return;

  const fq = document.getElementById('full-queue-tbody');
  if (!fq) return;

  const storeId = localStorage.getItem(STORAGE_KEYS.STORE_ID);
  const today = new Date().toISOString().split('T')[0];

  let queueItems = [];

  // Try fetching real data from API
  if (storeId) {
    try {
      const apiData = await apiRequest(`/api/queue?store_id=${storeId}&date=${today}`);
      if (Array.isArray(apiData) && apiData.length > 0) {
        queueItems = apiData;
      }
    } catch (err) {
      console.error('[Queue] API error:', err);
    }
  }

  // Fallback to demo data if API returns nothing
  if (queueItems.length === 0 && demoData?.queue) {
    fq.innerHTML = demoData.queue.map((q, i) => {
      const priority = PRIORITY[q.priority] || PRIORITY.normal;
      const status = STATUS[q.status] || STATUS.waiting;
      const waitTime = estimateWaitTime(i);
      return `
        <tr data-queue-id="${q.num}" data-status="${q.status}">
          <td><strong>${q.num}</strong></td>
          <td><div style="font-weight:500">${q.pet}</div><div style="font-size:12px;color:var(--text-muted)">${q.owner}</div></td>
          <td>${q.time || '-'}</td>
          <td>${waitTime}</td>
          <td><span class="queue-status ${status.class}">${status.label}</span></td>
          <td>-</td>
        </tr>`;
    }).join('');
    return;
  }

  // Render real data from API
  fq.innerHTML = queueItems.map((q, i) => {
    const priority = PRIORITY[q.priority] || PRIORITY.normal;
    const status = STATUS[q.status] || STATUS.waiting;
    const waitTime = q.status === 'waiting' ? estimateWaitTime(i, q.estimated_time || 20) : '';
    const petName = (q.notes || '').split(' - ')[0] || `คิว ${q.queue_number}`;
    const ownerName = (q.notes || '').split(' - ')[1] || '';
    const num = `A${String(q.queue_number).padStart(3, '0')}`;
    const time = q.called_at ? new Date(q.called_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : q.created_at ? new Date(q.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';

    return `
      <tr data-queue-id="${q.id}" data-status="${q.status}" data-priority="${q.priority || 'normal'}">
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <strong>${num}</strong>
            ${q.priority && q.priority !== 'normal'
        ? `<span style="font-size:10px;padding:2px 8px;border-radius:6px;background:${priority.color}15;color:${priority.color};font-weight:600">${priority.label}</span>`
        : ''}
          </div>
        </td>
        <td>
          <div style="font-weight:500">${petName}</div>
          <div style="font-size:12px;color:var(--text-muted)">${ownerName}</div>
        </td>
        <td>${q.service_type || '-'}</td>
        <td style="font-family:'Sarabun',sans-serif;color:var(--text-muted)">
          ${time}
          <div style="font-size:11px;color:${status.color}">${waitTime}</div>
        </td>
        <td><span class="queue-status ${status.class}">${status.label}</span></td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${q.status === 'waiting' ? `
              <button class="btn-sm btn-primary" data-queue-action="start" data-queue-id="${q.id}" title="เริ่มให้บริการ">
                <i class="fas fa-play" style="margin-right:4px"></i>เริ่ม
              </button>
            ` : ''}
            ${q.status === 'in_progress' || q.status === 'called' ? `
              <button class="btn-sm btn-primary" data-queue-action="complete" data-queue-id="${q.id}" style="background:#10B981" title="เสร็จสิ้น">
                <i class="fas fa-check" style="margin-right:4px"></i>เสร็จ
              </button>
            ` : ''}
            ${q.status !== 'completed' && q.status !== 'cancelled' && q.status !== 'no_show' ? `
              <button class="btn-sm btn-outline" data-queue-action="cancel" data-queue-id="${q.id}" style="color:#EF4444;border-color:#EF4444" title="ยกเลิก">
                <i class="fas fa-times"></i>
              </button>
            ` : ''}
            ${q.status === 'completed' ? `
              <button class="btn-sm btn-outline" data-queue-action="receipt" data-queue-id="${q.id}" title="ออกใบเสร็จ">
                <i class="fas fa-receipt" style="margin-right:4px"></i>ใบเสร็จ
              </button>
            ` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  // Action handlers via delegation — real API calls
  fq.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-queue-action]');
    if (!btn) return;

    const action = btn.dataset.queueAction;
    const queueId = btn.dataset.queueId;

    try {
      switch (action) {
        case 'start': {
          const res = await apiRequest(`/api/queue/${queueId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'in_progress' }),
          });
          if (res?.success) {
            showToast(`✅ เริ่มให้บริการคิวแล้ว`);
            renderFullQueue(demoData); // Re-render
          } else {
            showToast(`❌ ${res?.error || 'เกิดข้อผิดพลาด'}`, 'error');
          }
          break;
        }
        case 'complete': {
          const res = await apiRequest(`/api/queue/${queueId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'completed' }),
          });
          if (res?.success) {
            showToast(`✅ คิวเสร็จสิ้น`);
            renderFullQueue(demoData);
          } else {
            showToast(`❌ ${res?.error || 'เกิดข้อผิดพลาด'}`, 'error');
          }
          break;
        }
        case 'cancel': {
          if (!confirm('ยืนยันยกเลิกคิวนี้?')) return;
          const res = await apiRequest(`/api/queue/${queueId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'cancelled' }),
          });
          if (res?.success) {
            showToast(`⚠️ ยกเลิกคิวแล้ว`);
            renderFullQueue(demoData);
          } else {
            showToast(`❌ ${res?.error || 'เกิดข้อผิดพลาด'}`, 'error');
          }
          break;
        }
        case 'receipt':
          showToast(`🧾 กำลังสร้างใบเสร็จ...`, 'info');
          break;
      }
    } catch (err) {
      console.error('[Queue Action]', err);
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  });

  // Wire up "Add Queue" form if exists
  wireAddQueueForm();
}

/** Wire up the Add Queue form */
function wireAddQueueForm() {
  const form = document.getElementById('add-queue-form');
  if (!form || form.dataset.wired) return;
  form.dataset.wired = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const storeId = localStorage.getItem(STORAGE_KEYS.STORE_ID);
    if (!storeId) { showToast('กรุณาเลือกร้านค้าก่อน', 'error'); return; }

    const petName = form.querySelector('[name="pet_name"]')?.value || '';
    const ownerName = form.querySelector('[name="owner_name"]')?.value || '';
    const serviceType = form.querySelector('[name="service_type"]')?.value || 'ตรวจทั่วไป';
    const priority = form.querySelector('[name="priority"]')?.value || 'normal';

    try {
      const res = await apiRequest('/api/queue', {
        method: 'POST',
        body: JSON.stringify({ store_id: storeId, pet_name: petName, owner_name: ownerName, service_type: serviceType, priority }),
      });

      if (res?.success) {
        showToast(`✅ เพิ่มคิวสำเร็จ (${res.data?.queue_number || ''})`);
        form.reset();
        renderFullQueue(null); // Re-render queue
      } else {
        showToast(`❌ ${res?.error || 'เพิ่มคิวไม่สำเร็จ'}`, 'error');
      }
    } catch (err) {
      console.error('[Add Queue]', err);
      showToast('เกิดข้อผิดพลาดในการเพิ่มคิว', 'error');
    }
  });
}

// ===== CALENDAR VIEW =====

/**
 * Render a mini calendar for appointment overview.
 * @param {HTMLElement} container
 * @param {Date} [baseDate] - Month to display
 */
export function renderCalendar(container, baseDate = new Date()) {
  if (!FEATURE_FLAGS.ENABLE_CALENDAR_VIEW) {
    container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; margin-bottom: 20px;">
      <i class="fas fa-calendar-times" style="font-size: 24px; margin-bottom: 10px;"></i>
      <div>โมดูลปฏิทินปิดใช้งานอยู่ (อยู่ระหว่างการพัฒนา)</div>
    </div>`;
    return;
  }
  if (!container) return;

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Mock: days with appointments
  const busyDays = [2, 5, 7, 8, 12, 14, 15, 19, 21, 23, 26, 28, 30];
  const emergencyDays = [8, 21];

  const monthName = baseDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  let html = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div class="card-title">📅 ปฏิทินนัดหมาย</div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-sm btn-outline" id="cal-prev" aria-label="เดือนก่อนหน้า"><i class="fas fa-chevron-left"></i></button>
          <span style="font-weight:600;min-width:140px;text-align:center">${monthName}</span>
          <button class="btn-sm btn-outline" id="cal-next" aria-label="เดือนถัดไป"><i class="fas fa-chevron-right"></i></button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center">
        ${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d =>
    `<div style="padding:8px;font-size:12px;font-weight:600;color:var(--text-muted)">${d}</div>`
  ).join('')}
  `;

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += `<div style="padding:8px"></div>`;
  }

  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const isBusy = busyDays.includes(d);
    const isEmergency = emergencyDays.includes(d);

    let style = 'padding:8px;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.2s;position:relative;';
    if (isToday) style += 'background:var(--primary);color:#fff;font-weight:700;';
    else if (isEmergency) style += 'background:#FEE2E2;color:#991B1B;font-weight:600;';
    else if (isBusy) style += 'background:rgba(13,148,136,0.08);color:var(--primary-dark);';

    html += `
      <div style="${style}" data-day="${d}" class="cal-day" tabindex="0" aria-label="วันที่ ${d}">
        ${d}
        ${isBusy ? `<div style="width:5px;height:5px;border-radius:50%;background:${isEmergency ? '#EF4444' : 'var(--primary)'};margin:2px auto 0"></div>` : ''}
      </div>`;
  }

  html += `</div>

    <!-- Legend -->
    <div style="display:flex;gap:16px;margin-top:12px;font-size:11px;color:var(--text-muted);justify-content:center">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--primary);margin-right:4px"></span>มีนัดหมาย</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#EF4444;margin-right:4px"></span>ฉุกเฉิน</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><div style="width:20px;height:8px;border-radius:4px;background:var(--primary)"></div>วันนี้</span>
    </div>
  </div>`;

  container.innerHTML = html;

  // Calendar navigation
  let calDate = new Date(year, month, 1);
  container.querySelector('#cal-prev')?.addEventListener('click', () => {
    calDate.setMonth(calDate.getMonth() - 1);
    renderCalendar(container, calDate);
  });
  container.querySelector('#cal-next')?.addEventListener('click', () => {
    calDate.setMonth(calDate.getMonth() + 1);
    renderCalendar(container, calDate);
  });

  // Day click
  container.querySelectorAll('.cal-day').forEach(day => {
    day.addEventListener('click', () => {
      showToast(`วันที่ ${day.dataset.day}: มี 3 นัดหมาย (Demo)`, 'info');
    });
  });
}

// ===== TV DISPLAY MODE =====

/**
 * Toggle full-screen TV display mode for queue.
 * Optimized for reception area monitors.
 * Acceptance Criteria:
 * - Must check FEATURE_FLAGS.ENABLE_TV_MODE.
 * - Must toggle CSS class and full-screen state.
 */
export function toggleTVMode() {
  if (!FEATURE_FLAGS.ENABLE_TV_MODE) {
    showToast('TV Mode แจ้งให้ทราบว่ากำลังปิดใช้งาน', 'error');
    return;
  }
  const dashboard = document.querySelector('.dashboard-container');
  const sidebar = document.querySelector('.sidebar');

  if (document.body.classList.contains('tv-mode')) {
    // Exit TV mode
    document.body.classList.remove('tv-mode');
    if (sidebar) sidebar.style.display = '';
    if (dashboard) dashboard.style.marginLeft = '';
    showToast('ออกจากโหมด TV Display');
  } else {
    // Enter TV mode
    document.body.classList.add('tv-mode');
    if (sidebar) sidebar.style.display = 'none';
    if (dashboard) dashboard.style.marginLeft = '0';
    showToast('เปิดโหมด TV Display — กด ESC เพื่อออก', 'info');

    // Full screen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => { });
    }
  }
}

// Listen for ESC to exit TV mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('tv-mode')) {
    toggleTVMode();
  }
});
