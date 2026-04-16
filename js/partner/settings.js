/**
 * FUFU Partner – Settings & Configuration Module
 * Store profile, working hours, notification preferences, backup/export, connection test.
 * @module partner/settings
 * 
 * Acceptance Criteria:
 * - [x] Export data uses feature flags to toggle capability.
 * - [x] Connection test to Supabase operates safely.
 * - [x] Support profile & working hour updates (demo).
 */

import { showToast } from '../utils/notifications.js';
import { saveSupabaseConfig, getSupabaseConfig, APP_VERSION, FEATURE_FLAGS } from '../utils/config.js';

/**
 * Initialize settings page event handlers (enhanced).
 */
export function initSettings() {
  // Save store settings button
  const saveBtn = document.querySelector('[data-action="save-store-settings"]');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveStoreSettings);
  }

  // Save Supabase config button
  const configBtn = document.querySelector('[data-action="save-config"]');
  if (configBtn) {
    configBtn.addEventListener('click', saveConfig);
  }

  // Geolocation button
  const geoBtn = document.querySelector('[data-action="get-location"]');
  if (geoBtn) {
    geoBtn.addEventListener('click', getCurrentLocation);
  }

  // Render enhanced settings sections
  renderEnhancedSettings();
}

/**
 * Save store settings (demo — logs and shows toast).
 */
function saveStoreSettings() {
  const name = document.getElementById('set-name')?.value;
  const phone = document.getElementById('set-phone')?.value;
  const category = document.getElementById('set-category')?.value;
  const latlng = document.getElementById('set-latlng')?.value;

  // Save to localStorage as demo
  localStorage.setItem('fufu_store_name', name || '');
  localStorage.setItem('fufu_store_phone', phone || '');
  localStorage.setItem('fufu_store_category', category || '');
  localStorage.setItem('fufu_store_latlng', latlng || '');

  showToast('บันทึกการตั้งค่าร้านค้าสำเร็จ');
}

/**
 * Save Supabase configuration to localStorage.
 */
function saveConfig() {
  const url = document.getElementById('cfg-url')?.value;
  const key = document.getElementById('cfg-key')?.value;
  const pid = document.getElementById('cfg-pid')?.value;

  saveSupabaseConfig(url, key, pid);
  showToast('บันทึก Config เรียบร้อย — กำลังเชื่อมต่อ Supabase...');
}

/**
 * Get current GPS coordinates and fill into the lat/lng field.
 */
function getCurrentLocation() {
  if (!navigator.geolocation) {
    showToast('เบราว์เซอร์ไม่รองรับ Geolocation', 'error');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      const field = document.getElementById('set-latlng');
      if (field) field.value = `${lat}, ${lng}`;
      showToast('ดึงตำแหน่งปัจจุบันสำเร็จ');
    },
    () => {
      showToast('ไม่สามารถดึงตำแหน่งได้ กรุณาตรวจสอบสิทธิ์ Location', 'error');
    }
  );
}

/**
 * Render enhanced settings sections below existing settings.
 */
function renderEnhancedSettings() {
  const page = document.getElementById('page-settings');
  if (!page || page.querySelector('#enhanced-settings')) return;

  const extras = document.createElement('div');
  extras.id = 'enhanced-settings';
  extras.style.marginTop = '16px';
  extras.innerHTML = `
    <div class="two-col">
      <!-- Working Hours -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🕐 เวลาทำการ</div>
        </div>
        ${['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'].map((day, i) => {
          const isWeekend = i >= 5;
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(203,213,225,0.2);font-size:13px">
              <label style="min-width:60px;font-weight:500">${day}</label>
              <input type="time" value="${isWeekend && i === 6 ? '' : '09:00'}" style="padding:6px 10px;border:1px solid rgba(203,213,225,0.5);border-radius:8px;font-family:'Prompt',sans-serif;font-size:12px;${i === 6 ? 'opacity:0.4' : ''}" ${i === 6 ? 'disabled' : ''}>
              <span style="font-size:12px;color:var(--text-muted)">—</span>
              <input type="time" value="${isWeekend && i === 6 ? '' : (isWeekend ? '17:00' : '20:00')}" style="padding:6px 10px;border:1px solid rgba(203,213,225,0.5);border-radius:8px;font-family:'Prompt',sans-serif;font-size:12px;${i === 6 ? 'opacity:0.4' : ''}" ${i === 6 ? 'disabled' : ''}>
              <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-muted);cursor:pointer">
                <input type="checkbox" ${i === 6 ? 'checked' : ''} style="accent-color:var(--primary)"> ปิด
              </label>
            </div>`;
        }).join('')}
        <button class="btn-sm btn-primary" style="width:100%;margin-top:12px;padding:10px" id="save-hours-btn">บันทึกเวลาทำการ</button>
      </div>

      <!-- Notification Preferences -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔔 การแจ้งเตือน</div>
        </div>
        ${[
          { id: 'notif-sms', label: 'SMS แจ้งเตือนนัดหมาย', desc: 'ส่ง SMS ก่อนนัดหมาย 1 ชั่วโมง', checked: true },
          { id: 'notif-email', label: 'อีเมลสรุปรายวัน', desc: 'รายงานรายรับประจำวัน ส่งทุก 20:00', checked: true },
          { id: 'notif-line', label: 'Line Notify', desc: 'แจ้งเตือนผ่าน Line เมื่อมีการจองใหม่', checked: false },
          { id: 'notif-stock', label: 'แจ้งเตือนสต็อก', desc: 'เตือนเมื่อสินค้าเหลือน้อยกว่า 10 ชิ้น', checked: true },
          { id: 'notif-vaccine', label: 'แจ้งเตือนวัคซีน', desc: 'เตือนเมื่อถึงกำหนดฉีดวัคซีน', checked: true },
        ].map(n => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(203,213,225,0.2)">
            <div>
              <div style="font-weight:500;font-size:13px">${n.label}</div>
              <div style="font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif">${n.desc}</div>
            </div>
            <label class="toggle-switch" style="position:relative;display:inline-block;width:44px;height:24px">
              <input type="checkbox" ${n.checked ? 'checked' : ''} style="opacity:0;width:0;height:0" data-notif="${n.id}">
              <span style="position:absolute;cursor:pointer;inset:0;background:${n.checked ? 'var(--primary)' : '#CBD5E1'};border-radius:24px;transition:0.3s"></span>
              <span style="position:absolute;height:18px;width:18px;left:${n.checked ? '23px' : '3px'};bottom:3px;background:#fff;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.1)"></span>
            </label>
          </div>
        `).join('')}
        <div style="margin-top:12px">
          <div class="field-group">
            <label class="field-label">เวลาส่งแจ้งเตือนก่อนนัดหมาย</label>
            <select class="field-input" style="cursor:pointer">
              <option value="30">30 นาที</option>
              <option value="60" selected>1 ชั่วโมง</option>
              <option value="120">2 ชั่วโมง</option>
              <option value="1440">1 วัน</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="two-col" style="margin-top:16px">
      <!-- Backup & Export -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">💾 สำรองข้อมูล & Export</div>
        </div>
        <div style="display:grid;gap:10px">
          ${[
            { icon: 'fa-file-csv', label: 'Export ข้อมูลนัดหมาย', desc: 'CSV — appointments', action: 'export-appointments' },
            { icon: 'fa-file-csv', label: 'Export ข้อมูลรายรับ', desc: 'CSV — transactions', action: 'export-transactions' },
            { icon: 'fa-file-csv', label: 'Export ข้อมูลสินค้า', desc: 'CSV — products/inventory', action: 'export-products' },
            { icon: 'fa-database', label: 'สำรองข้อมูลทั้งหมด', desc: 'Full backup (JSON)', action: 'full-backup' },
          ].map(e => `
            <button class="export-btn" data-export="${e.action}" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid rgba(203,213,225,0.3);border-radius:10px;background:#fff;cursor:pointer;width:100%;text-align:left;transition:all 0.2s;font-family:'Prompt',sans-serif" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='rgba(203,213,225,0.3)'">
              <i class="fas ${e.icon}" style="color:var(--primary);font-size:16px;width:20px;text-align:center"></i>
              <div>
                <div style="font-weight:500;font-size:13px">${e.label}</div>
                <div style="font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif">${e.desc}</div>
              </div>
            </button>
          `).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px;background:rgba(13,148,136,0.04);border-radius:8px">
          <input type="checkbox" id="auto-backup" style="accent-color:var(--primary)">
          <label for="auto-backup" style="font-size:12px;cursor:pointer">เปิดใช้งาน Auto-backup ทุกวัน (ต้องเชื่อมต่อ Supabase)</label>
        </div>
      </div>

      <!-- Supabase Connection Test -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔌 สถานะการเชื่อมต่อ</div>
        </div>
        <div id="connection-status" style="padding:16px;border-radius:10px;background:#F8FAFC;text-align:center">
          <i class="fas fa-plug" style="font-size:2rem;color:var(--text-muted);opacity:0.4;margin-bottom:8px;display:block"></i>
          <div style="font-size:13px;font-weight:500;margin-bottom:4px">ยังไม่ได้เชื่อมต่อ Supabase</div>
          <div style="font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif;margin-bottom:12px">กรุณากรอก Config ด้านซ้ายก่อน</div>
          <button class="btn-sm btn-primary" id="test-connection-btn" style="padding:10px 24px">
            <i class="fas fa-bolt" style="margin-right:4px"></i>ทดสอบการเชื่อมต่อ
          </button>
        </div>

        <!-- Connection details (shown after test) -->
        <div id="connection-details" style="display:none;margin-top:12px">
          <div style="display:grid;gap:8px">
            <div style="display:flex;justify-content:space-between;padding:8px;background:#F8FAFC;border-radius:8px;font-size:12px">
              <span>Supabase URL</span>
              <span id="conn-url" style="font-family:'Sarabun',sans-serif;color:var(--text-muted)">—</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px;background:#F8FAFC;border-radius:8px;font-size:12px">
              <span>Anon Key</span>
              <span id="conn-key" style="font-family:'Sarabun',sans-serif;color:var(--text-muted)">—</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px;background:#F8FAFC;border-radius:8px;font-size:12px">
              <span>Latency</span>
              <span id="conn-latency" style="font-family:'Sarabun',sans-serif;font-weight:600">—</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px;background:#F8FAFC;border-radius:8px;font-size:12px">
              <span>RLS Status</span>
              <span id="conn-rls" style="font-family:'Sarabun',sans-serif">—</span>
            </div>
          </div>
        </div>

        <!-- App Info -->
        <div style="margin-top:16px;padding:12px;background:rgba(13,148,136,0.04);border-radius:10px;font-size:12px;font-family:'Sarabun',sans-serif;color:var(--text-muted)">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span>FUFU Partner Portal</span>
            <span style="font-weight:600;color:var(--primary)">${APP_VERSION}</span>
          </div>
          <div>Powered by Kitten Code Co., Ltd. © 2026</div>
        </div>
      </div>
    </div>
  `;

  page.appendChild(extras);

  // Event handlers
  setupSettingsEvents(extras);
}

/**
 * Set up settings event handlers.
 * @param {HTMLElement} container
 */
function setupSettingsEvents(container) {
  // Save hours
  container.querySelector('#save-hours-btn')?.addEventListener('click', () => {
    showToast('บันทึกเวลาทำการสำเร็จ');
  });

  // Notification toggles
  container.querySelectorAll('.toggle-switch input').forEach(input => {
    input.addEventListener('change', (e) => {
      const parent = e.target.closest('.toggle-switch');
      const slider = parent?.querySelectorAll('span');
      if (slider?.[0]) slider[0].style.background = e.target.checked ? 'var(--primary)' : '#CBD5E1';
      if (slider?.[1]) slider[1].style.left = e.target.checked ? '23px' : '3px';
      showToast(e.target.checked ? 'เปิดการแจ้งเตือน' : 'ปิดการแจ้งเตือน', 'info');
    });
  });

  // Export buttons
  container.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!FEATURE_FLAGS.ENABLE_FINANCE_EXPORT) {
        showToast('ฟีเจอร์ Export ยังไม่เปิดให้บริการในขณะนี้', 'error');
        return;
      }
      const action = btn.dataset.export;
      showToast(`เตรียมส่งออกข้อมูล: ${action} (Demo)`, 'info');
    });
  });

  // Connection test
  container.querySelector('#test-connection-btn')?.addEventListener('click', async () => {
    const btn = container.querySelector('#test-connection-btn');
    if (btn) {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:4px"></i>กำลังทดสอบ...';
      btn.disabled = true;
    }

    const config = getSupabaseConfig();
    const details = container.querySelector('#connection-details');
    const statusDiv = container.querySelector('#connection-status');

    // Simulate latency test
    const startTime = performance.now();

    try {
      if (config.url.includes('YOUR_PROJECT')) {
        throw new Error('ยังไม่ได้ตั้งค่า Supabase URL');
      }

      const res = await fetch(`${config.url}/rest/v1/`, {
        headers: { 'apikey': config.key },
        signal: AbortSignal.timeout(5000),
      });

      const latency = Math.round(performance.now() - startTime);

      if (details) {
        details.style.display = '';
        container.querySelector('#conn-url').textContent = config.url.replace(/https?:\/\//, '').slice(0, 20) + '...';
        container.querySelector('#conn-key').textContent = config.key.slice(0, 10) + '••••••••';
        container.querySelector('#conn-latency').textContent = `${latency}ms`;
        container.querySelector('#conn-latency').style.color = latency < 200 ? '#10B981' : latency < 500 ? '#F59E0B' : '#EF4444';
        container.querySelector('#conn-rls').innerHTML = '<span style="color:#F59E0B">⚠️ ตรวจสอบด้วยตนเอง</span>';
      }

      if (statusDiv) {
        statusDiv.innerHTML = `
          <div style="width:48px;height:48px;border-radius:50%;background:rgba(16,185,129,0.1);display:inline-flex;align-items:center;justify-content:center;margin-bottom:8px">
            <i class="fas fa-check" style="color:#10B981;font-size:1.2rem"></i>
          </div>
          <div style="font-size:13px;font-weight:500;color:#10B981;margin-bottom:4px">เชื่อมต่อสำเร็จ</div>
          <div style="font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif">Latency: ${latency}ms</div>
        `;
      }

      showToast(`เชื่อมต่อ Supabase สำเร็จ (${latency}ms)`);
    } catch (e) {
      if (details) details.style.display = 'none';
      if (statusDiv) {
        statusDiv.innerHTML = `
          <div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.1);display:inline-flex;align-items:center;justify-content:center;margin-bottom:8px">
            <i class="fas fa-times" style="color:#EF4444;font-size:1.2rem"></i>
          </div>
          <div style="font-size:13px;font-weight:500;color:#EF4444;margin-bottom:4px">เชื่อมต่อไม่สำเร็จ</div>
          <div style="font-size:11px;color:var(--text-muted);font-family:'Sarabun',sans-serif;margin-bottom:12px">${e.message || 'ตรวจสอบ URL และ Key'}</div>
          <button class="btn-sm btn-primary" id="test-connection-btn" style="padding:10px 24px">
            <i class="fas fa-redo" style="margin-right:4px"></i>ลองอีกครั้ง
          </button>
        `;
        // Re-attach handler
        statusDiv.querySelector('#test-connection-btn')?.addEventListener('click', () => {
          setupSettingsEvents(container);
        });
      }
      showToast('เชื่อมต่อ Supabase ไม่สำเร็จ: ' + (e.message || 'Unknown error'), 'error');
    }

    if (btn) {
      btn.innerHTML = '<i class="fas fa-bolt" style="margin-right:4px"></i>ทดสอบการเชื่อมต่อ';
      btn.disabled = false;
    }
  });
}
