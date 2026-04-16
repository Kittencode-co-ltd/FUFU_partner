/**
 * FUFU Partner – Landing Page: Booking Module
 * Public booking form handler (placeholder for future implementation).
 * @module landing/booking
 */

import { showToast } from '../utils/notifications.js';
import { isValidEmail, isRequired, isValidThaiPhone } from '../utils/validators.js';

/**
 * Initialize the public booking form (if present on the page).
 * Currently a mock implementation — to be connected to Supabase later.
 */
export function initBooking() {
  const bookingForm = document.getElementById('booking-form');
  if (!bookingForm) return; // Form not on current page

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const petName = bookingForm.querySelector('#booking-pet-name')?.value;
    const ownerEmail = bookingForm.querySelector('#booking-email')?.value;
    const ownerPhone = bookingForm.querySelector('#booking-phone')?.value;
    const service = bookingForm.querySelector('#booking-service')?.value;

    // Validation
    if (!isRequired(petName)) {
      showToast('กรุณากรอกชื่อสัตว์เลี้ยง', 'error');
      return;
    }

    if (ownerEmail && !isValidEmail(ownerEmail)) {
      showToast('รูปแบบอีเมลไม่ถูกต้อง', 'error');
      return;
    }

    if (ownerPhone && !isValidThaiPhone(ownerPhone)) {
      showToast('เบอร์โทรไม่ถูกต้อง', 'error');
      return;
    }

    // Mock submission
    showToast('จองบริการสำเร็จ! เราจะติดต่อกลับเร็วๆ นี้', 'success');
    bookingForm.reset();
  });
}
