/**
 * FUFU Partner – Landing Page: Public Booking Form
 * Submits appointment requests to /api/appointments (public endpoint).
 */

import { showToast } from '../utils/toast.js';
import { isValidEmail, isRequired, isValidThaiPhone } from '../utils/validators.js';
import { API_BASE } from '../utils/config.js';

export function initBooking() {
  const bookingForm = document.getElementById('booking-form');
  if (!bookingForm) return;

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const petName    = bookingForm.querySelector('#booking-pet-name')?.value?.trim();
    const ownerName  = bookingForm.querySelector('#booking-owner-name')?.value?.trim();
    const ownerEmail = bookingForm.querySelector('#booking-email')?.value?.trim();
    const ownerPhone = bookingForm.querySelector('#booking-phone')?.value?.trim();
    const service    = bookingForm.querySelector('#booking-service')?.value?.trim();
    const apptDate   = bookingForm.querySelector('#booking-date')?.value;
    const notes      = bookingForm.querySelector('#booking-notes')?.value?.trim();
    const storeId    = bookingForm.dataset.storeId; // set via data-store-id on the form element

    if (!isRequired(petName)) {
      showToast('กรุณากรอกชื่อสัตว์เลี้ยง', 'error'); return;
    }
    if (!isRequired(ownerName)) {
      showToast('กรุณากรอกชื่อเจ้าของ', 'error'); return;
    }
    if (ownerEmail && !isValidEmail(ownerEmail)) {
      showToast('รูปแบบอีเมลไม่ถูกต้อง', 'error'); return;
    }
    if (ownerPhone && !isValidThaiPhone(ownerPhone)) {
      showToast('เบอร์โทรไม่ถูกต้อง', 'error'); return;
    }

    const submitBtn = bookingForm.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังส่ง...'; }

    try {
      const res = await fetch(`${API_BASE}/api/appointments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id:    storeId  || null,
          pet_name:    petName,
          owner_name:  ownerName,
          owner_email: ownerEmail || null,
          owner_phone: ownerPhone || null,
          service_type: service  || 'ตรวจทั่วไป',
          appt_date:   apptDate  || null,
          notes:       notes     || null,
          status:      'pending',
          source:      'landing_page',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast('จองบริการสำเร็จ! เราจะติดต่อกลับเร็วๆ นี้', 'success');
        bookingForm.reset();
      } else {
        showToast(data.error || 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่', 'error');
      }
    } catch {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่', 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'จองบริการ'; }
    }
  });
}
