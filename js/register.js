/**
 * FUFU Partner – Registration Module
 * @module register
 */

import { showToast } from './utils/notifications.js';
import { API_BASE } from './utils/config.js';

let currentRegType = 'user'; // 'user' or 'partner'

export function initRegister() {
  const tabUser = document.getElementById('tab-user');
  const tabPartner = document.getElementById('tab-partner');
  const submitBtn = document.getElementById('submit-btn');

  if (tabUser) tabUser.addEventListener('click', () => switchTab('user'));
  if (tabPartner) tabPartner.addEventListener('click', () => switchTab('partner'));
  if (submitBtn) submitBtn.addEventListener('click', doRegister);
}

function switchTab(type) {
  currentRegType = type;
  document.getElementById('tab-user')?.classList.toggle('active', type === 'user');
  document.getElementById('tab-partner')?.classList.toggle('active', type === 'partner');
  
  const partnerFields = document.getElementById('partner-fields');
  if (partnerFields) {
    partnerFields.style.display = type === 'partner' ? 'block' : 'none';
  }
}

async function doRegister() {
  const name = document.getElementById('name')?.value.trim();
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  const phone = document.getElementById('phone')?.value.trim();
  const partnerType = document.getElementById('partner-type')?.value;

  if (!name || !email || !password) {
    showToast('กรุณากรอกข้อมูล ชื่อ, อีเมล และรหัสผ่าน ให้ครบถ้วน', 'error');
    return;
  }
  if (password.length < 6) {
    showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
    return;
  }

  const btn = document.getElementById('submit-btn');
  const btnText = document.getElementById('btn-text');
  const spinner = document.getElementById('spinner');

  if (btn) btn.disabled = true;
  if (btnText) btnText.style.display = 'none';
  if (spinner) spinner.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: password,
        name: name,
        phone: phone,
        type: currentRegType,
        partnerType: partnerType
      })
    });

    const data = await res.json();

    if (!data.success) {
      showToast('เกิดข้อผิดพลาดในการสมัคร: ' + (data.error || 'อีเมลนี้อาจจะถูกใช้งานแล้ว'), 'error');
    } else {
      showToast('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    }
  } catch (e) {
    console.error('[Register] Error:', e);
    showToast('เกิดข้อผิดพลาดการเชื่อมต่อเซิร์ฟเวอร์ Backend', 'error');
  }

  if (btn) btn.disabled = false;
  if (btnText) btnText.style.display = 'block';
  if (spinner) spinner.style.display = 'none';
}
