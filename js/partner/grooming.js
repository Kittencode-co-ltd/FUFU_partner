import { showToast } from '../utils/notifications.js';
import { formatBaht } from '../utils/formatters.js';
import { FEATURE_FLAGS } from '../utils/config.js';
import { fetchFromSupabase } from '../utils/supabase-client.js';

// ===== GROOMING DATA =====
const groomingQueue = [
  { id: 'g1', pet: 'มะม่วง', species: '🐈 แมว', owner: 'คุณอรนุช', service: 'Grooming Full Set', status: 'in-progress', progress: 65, startTime: '13:00', estEnd: '14:00', addOns: ['อาบน้ำ', 'ตัดขน', 'ทำเล็บ'] },
  { id: 'g2', pet: 'บัดดี้', species: '🐕 สุนัข', owner: 'คุณสมชาย', service: 'Spa + Grooming', status: 'waiting', progress: 0, startTime: '14:30', estEnd: '15:30', addOns: [] },
  { id: 'g3', pet: 'ลูน่า', species: '🐕 สุนัข', owner: 'คุณปวีณา', service: 'อาบน้ำ + แต่งเล็บ', status: 'done', progress: 100, startTime: '11:00', estEnd: '11:45', addOns: ['ทำความสะอาดหู'] },
];

const addOnServices = [
  { id: 'ao1', name: 'อาบน้ำ', icon: '🛁', price: 200 },
  { id: 'ao2', name: 'ตัดเล็บ', icon: '💅', price: 80 },
  { id: 'ao3', name: 'ทำความสะอาดหู', icon: '👂', price: 100 },
  { id: 'ao4', name: 'แปรงฟัน', icon: '🪥', price: 120 },
  { id: 'ao5', name: 'สปาผิว', icon: '💆', price: 350 },
  { id: 'ao6', name: 'ทำสีขน', icon: '🎨', price: 500 },
];

export async function renderGrooming(role) {
  if (role !== 'grooming') return;

  const page = document.getElementById('page-grooming');
  if (!page) return;

  let activeGrooming = groomingQueue;

  page.innerHTML = `
    <!-- Grooming Queue & Timer -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">✂️ คิว Grooming & Progress</div>
        <button class="btn-sm btn-primary" id="add-groom-btn"><i class="fas fa-plus" style="margin-right:4px"></i>เพิ่มคิว</button>
      </div>
      <div style="display:grid;gap:12px">
        ${activeGrooming.map(g => {
          const statusColor = g.status === 'in-progress' ? '#3B82F6' : g.status === 'done' ? '#10B981' : '#F59E0B';
          const statusLabel = g.status === 'in-progress' ? '🔧 กำลังทำ' : g.status === 'done' ? '✅ เสร็จ' : '⏳ รอ';

          return `
            <div style="display:flex;align-items:center;gap:16px;padding:14px;border:1px solid rgba(203,213,225,0.3);border-radius:12px;${g.status === 'in-progress' ? 'background:rgba(59,130,246,0.03);border-color:rgba(59,130,246,0.2)' : ''}">
              <!-- Pet Info -->
              <div style="flex-shrink:0;text-align:center;min-width:60px">
                <div style="font-size:1.5rem">${g.species.split(' ')[0]}</div>
                <div style="font-size:12px;font-weight:600">${g.pet}</div>
                <div style="font-size:10px;color:var(--text-muted)">${g.owner}</div>
              </div>
              <!-- Service & Progress -->
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span style="font-weight:500;font-size:13px">${g.service}</span>
                  <span style="font-size:11px;color:${statusColor};font-weight:600">${statusLabel}</span>
                </div>
                <!-- Progress Bar -->
                <div style="height:8px;background:#F1F5F9;border-radius:4px;overflow:hidden;margin-bottom:6px">
                  <div style="width:${g.progress}%;height:100%;background:${statusColor};border-radius:4px;transition:width 1s ease"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif">
                  <span>เริ่ม: ${g.startTime}</span>
                  <span>คาดว่าเสร็จ: ${g.estEnd}</span>
                  <span style="font-weight:600;color:${statusColor}">${g.progress}%</span>
                </div>
                ${g.addOns.length > 0 ? `
                  <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">
                    ${g.addOns.map(a => `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(13,148,136,0.06);color:var(--primary-dark)">${a}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
              <!-- Actions -->
              <div style="flex-shrink:0;display:flex;flex-direction:column;gap:4px">
                ${g.status === 'in-progress' ? `
                  <button class="btn-sm btn-primary" data-groom-action="complete" data-groom-id="${g.id}" style="font-size:10px"><i class="fas fa-check"></i></button>
                ` : ''}
                ${g.status === 'waiting' ? `
                  <button class="btn-sm btn-primary" data-groom-action="start" data-groom-id="${g.id}" style="font-size:10px"><i class="fas fa-play"></i></button>
                ` : ''}
                <button class="btn-sm btn-outline" data-groom-action="upsell" data-groom-id="${g.id}" style="font-size:10px" title="เพิ่มบริการ"><i class="fas fa-plus"></i></button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Add-on Upsell UI -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div class="card-title">🎁 บริการเสริม (Add-ons)</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">
        ${addOnServices.map(a => `
          <div style="padding:14px;border:1px solid rgba(203,213,225,0.3);border-radius:12px;text-align:center;cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='rgba(203,213,225,0.3)'" data-addon="${a.id}">
            <div style="font-size:1.5rem;margin-bottom:4px">${a.icon}</div>
            <div style="font-weight:500;font-size:13px">${a.name}</div>
            <div style="font-size:12px;color:var(--primary);font-weight:600;margin-top:2px">${formatBaht(a.price)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  setupGroomingEvents(page);
}

function setupGroomingEvents(page) {
  // Grooming actions
  page.querySelectorAll('[data-groom-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.groomAction;
      const id = btn.dataset.groomId;
      if (action === 'start') showToast(`เริ่มบริการ Grooming ${id}`);
      else if (action === 'complete') showToast(`Grooming ${id} เสร็จสิ้น`);
      else if (action === 'upsell') showToast('เลือกบริการเสริมที่ต้องการ (Demo)', 'info');
    });
  });

  // Add grooming
  page.querySelector('#add-groom-btn')?.addEventListener('click', () => showToast('เปิดฟอร์มเพิ่มคิว Grooming (Demo)', 'info'));

  // Add-on cards
  page.querySelectorAll('[data-addon]').forEach(card => {
    card.addEventListener('click', () => showToast('เพิ่มบริการเสริมสำเร็จ (Demo)'));
  });
}
