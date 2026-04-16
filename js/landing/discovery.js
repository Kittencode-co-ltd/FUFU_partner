/**
 * FUFU Public – Service Discovery & Booking Module
 * Partner search, filter, geolocation, booking form flow.
 * @module landing/discovery
 * 
 * Acceptance Criteria:
 * - [x] Users can search partners by name or service.
 * - [x] Users can filter partners by category.
 * - [x] Geolocation sorting is supported.
 * - [x] Booking form auto-fills pet owner data if logged in.
 */

import { isOwnerAuthenticated, getOwnerData } from './pet-owner-auth.js';

// ===== MOCK PARTNER DATA =====
const mockPartners = [
  {
    id: 'p1', name: 'Happy Paws Clinic', category: 'vet_clinic',
    catLabel: 'คลินิกสัตว์แพทย์', icon: 'fa-stethoscope',
    rating: 4.9, reviews: 128, distance: 1.2,
    services: ['ตรวจสุขภาพ', 'วัคซีน', 'ผ่าตัด', 'ฉุกเฉิน 24 ชม.'],
    address: 'ซอยสุขุมวิท 31, กรุงเทพฯ',
    phone: '02-123-4567',
  },
  {
    id: 'p2', name: 'PetVille Superstore', category: 'pet_shop',
    catLabel: 'ร้านค้าสัตว์เลี้ยง', icon: 'fa-store',
    rating: 4.7, reviews: 89, distance: 2.5,
    services: ['อาหารพรีเมียม', 'ของเล่น', 'อุปกรณ์', 'ส่งทั่ว กทม.'],
    address: 'เมกาบางนา ชั้น 2, กรุงเทพฯ',
    phone: '02-987-6543',
  },
  {
    id: 'p3', name: 'Furry Dreams Hotel & Spa', category: 'pet_hotel',
    catLabel: 'โรงแรมสัตว์เลี้ยง', icon: 'fa-bed',
    rating: 4.8, reviews: 64, distance: 3.8,
    services: ['ห้องพักดีลักซ์', 'สปา', 'สระว่ายน้ำ', 'อัพเดทรายวัน'],
    address: 'รามอินทรา กม.8, กรุงเทพฯ',
    phone: '02-555-8888',
  },
  {
    id: 'p4', name: 'Glamour Groom Studio', category: 'pet_grooming',
    catLabel: 'ร้านตัดขนสัตว์เลี้ยง', icon: 'fa-scissors',
    rating: 4.6, reviews: 45, distance: 1.8,
    services: ['ตัดขน', 'อาบน้ำ', 'สปาเล็บ', 'ทำสีขน'],
    address: 'ลาดพร้าว 71, กรุงเทพฯ',
    phone: '02-777-3333',
  },
  {
    id: 'p5', name: 'Animal Care Center', category: 'vet_clinic',
    catLabel: 'โรงพยาบาลสัตว์', icon: 'fa-hospital',
    rating: 4.9, reviews: 210, distance: 4.2,
    services: ['ศัลยกรรม', 'ทันตกรรม', 'รังสีวินิจฉัย', 'ห้อง ICU'],
    address: 'พระราม 9, กรุงเทพฯ',
    phone: '02-111-2222',
  },
  {
    id: 'p6', name: 'Meow & Bow Shop', category: 'pet_shop',
    catLabel: 'ร้านค้าสัตว์เลี้ยง', icon: 'fa-store',
    rating: 4.5, reviews: 33, distance: 0.8,
    services: ['อาหารแมว', 'ทรายแมว', 'คอนโดแมว', 'ของเล่น'],
    address: 'อารีย์, กรุงเทพฯ',
    phone: '02-333-4444',
  },
];

// ===== STATE =====
let currentFilter = 'all';
let currentSearch = '';
let userLocation = null;

// ===== RENDER =====

/**
 * Render star rating HTML.
 * @param {number} rating - Rating value (0-5)
 * @returns {string} HTML string
 */
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  let html = '';
  for (let i = 0; i < full; i++) html += '<i class="fas fa-star"></i>';
  if (half) html += '<i class="fas fa-star-half-alt"></i>';
  for (let i = 0; i < empty; i++) html += '<i class="fas fa-star empty"></i>';
  return html;
}

/**
 * Generate gradient based on partner category.
 * @param {string} category
 * @returns {string} CSS gradient
 */
function getCategoryGradient(category) {
  const gradients = {
    vet_clinic: 'linear-gradient(135deg, #0D9488 0%, #065F46 100%)',
    pet_shop: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    pet_hotel: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    pet_grooming: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
  };
  return gradients[category] || gradients.vet_clinic;
}

/**
 * Filter and render partner cards.
 */
function renderPartnerCards() {
  const container = document.getElementById('partner-results');
  if (!container) return;

  let filtered = mockPartners;

  // Category filter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(p => p.category === currentFilter);
  }

  // Search text
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.catLabel.includes(q) ||
      p.services.some(s => s.toLowerCase().includes(q)) ||
      p.address.toLowerCase().includes(q)
    );
  }

  // Sort by distance if geolocation is available
  if (userLocation) {
    filtered.sort((a, b) => a.distance - b.distance);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">
        <i class="fas fa-search" style="font-size:2rem;margin-bottom:12px;display:block;opacity:0.4"></i>
        <div style="font-family:'Sarabun',sans-serif">ไม่พบร้านค้าที่ตรงกับเงื่อนไข ลองเปลี่ยนตัวกรองใหม่</div>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(p => `
    <div class="partner-card" data-partner-id="${p.id}" role="article" aria-label="${p.name}" tabindex="0">
      <div class="partner-card-img" style="background:${getCategoryGradient(p.category)}">
        <i class="fas ${p.icon}"></i>
        <div class="partner-card-badge"><i class="fas fa-check-circle" style="margin-right:4px;color:var(--primary)"></i>Verified</div>
      </div>
      <div class="partner-card-body">
        <div class="partner-card-name">${p.name}</div>
        <div class="partner-card-category"><i class="fas ${p.icon}" style="margin-right:4px"></i>${p.catLabel}</div>
        <div class="partner-card-meta">
          <span><i class="fas fa-map-marker-alt"></i>${p.distance} km</span>
          <span><i class="fas fa-comment-dots"></i>${p.reviews} รีวิว</span>
          <span><i class="fas fa-map-pin"></i>${p.address.split(',')[0]}</span>
        </div>
        <div class="partner-card-services">
          ${p.services.slice(0, 3).map(s => `<span class="service-tag">${s}</span>`).join('')}
          ${p.services.length > 3 ? `<span class="service-tag">+${p.services.length - 3}</span>` : ''}
        </div>
        <div class="partner-card-footer">
          <div class="star-rating" aria-label="Rating ${p.rating} out of 5">
            ${renderStars(p.rating)}
            <span>${p.rating}</span>
          </div>
          <button class="book-now-btn" data-partner-id="${p.id}" aria-label="จองกับ ${p.name}">
            <i class="fas fa-calendar-plus" style="margin-right:4px"></i>จองเลย
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ===== BOOKING FLOW =====
let bookingStep = 0;
let bookingData = {};
let selectedPartner = null;

/**
 * Open the booking modal for a partner.
 * @param {string} partnerId
 */
function openBooking(partnerId) {
  selectedPartner = mockPartners.find(p => p.id === partnerId);
  if (!selectedPartner) return;

  bookingStep = 0;
  bookingData = { partnerId, partnerName: selectedPartner.name };
  renderBookingStep();

  const overlay = document.getElementById('booking-overlay');
  if (overlay) overlay.classList.add('show');
}

/**
 * Close booking modal.
 */
function closeBooking() {
  const overlay = document.getElementById('booking-overlay');
  if (overlay) overlay.classList.remove('show');
  bookingStep = 0;
  bookingData = {};
}

/**
 * Render the current booking step.
 */
function renderBookingStep() {
  const body = document.getElementById('booking-body');
  const title = document.getElementById('booking-title');
  const footer = document.getElementById('booking-footer');
  if (!body || !title || !footer) return;

  // Update step indicators
  document.querySelectorAll('.booking-step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i === bookingStep) s.classList.add('active');
    else if (i < bookingStep) s.classList.add('done');
  });

  title.textContent = selectedPartner
    ? `จองบริการ — ${selectedPartner.name}`
    : 'จองบริการ';

  const steps = [renderStep1, renderStep2, renderStep3, renderConfirmation];
  steps[bookingStep](body);

  // Footer buttons
  if (bookingStep < 3) {
    footer.innerHTML = `
      ${bookingStep > 0 ? '<button class="booking-back-btn" id="booking-back"><i class="fas fa-arrow-left" style="margin-right:6px"></i>ย้อนกลับ</button>' : '<button class="booking-back-btn" id="booking-cancel">ยกเลิก</button>'}
      <button class="booking-next-btn" id="booking-next">${bookingStep === 2 ? '<i class="fas fa-check" style="margin-right:6px"></i>ยืนยันการจอง' : 'ถัดไป <i class="fas fa-arrow-right" style="margin-left:6px"></i>'}</button>
    `;
    document.getElementById('booking-back')?.addEventListener('click', () => { bookingStep--; renderBookingStep(); });
    document.getElementById('booking-cancel')?.addEventListener('click', closeBooking);
    document.getElementById('booking-next')?.addEventListener('click', nextBookingStep);
  } else {
    footer.innerHTML = `
      <button class="booking-next-btn" id="booking-done" style="width:100%"><i class="fas fa-home" style="margin-right:6px"></i>กลับหน้าหลัก</button>
    `;
    document.getElementById('booking-done')?.addEventListener('click', closeBooking);
  }
}

// Step 1: Choose service
function renderStep1(container) {
  if (!selectedPartner) return;
  container.innerHTML = `
    <div class="booking-form-section active">
      <div class="booking-field">
        <label>เลือกบริการ <span style="color:#EF4444">*</span></label>
        <select id="b-service" aria-required="true">
          <option value="">-- เลือกบริการ --</option>
          ${selectedPartner.services.map(s => `<option value="${s}" ${bookingData.service === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="booking-row">
        <div class="booking-field">
          <label>วันที่ <span style="color:#EF4444">*</span></label>
          <input type="date" id="b-date" value="${bookingData.date || ''}" min="${new Date().toISOString().split('T')[0]}" aria-required="true">
        </div>
        <div class="booking-field">
          <label>เวลา <span style="color:#EF4444">*</span></label>
          <select id="b-time" aria-required="true">
            <option value="">-- เลือกเวลา --</option>
            ${['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30']
              .map(t => `<option value="${t}" ${bookingData.time === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="booking-field">
        <label>หมายเหตุเพิ่มเติม</label>
        <textarea id="b-notes" placeholder="อาการ, ข้อมูลเพิ่มเติม...">${bookingData.notes || ''}</textarea>
      </div>
    </div>
  `;
}

// Step 2: Pet info
function renderStep2(container) {
  container.innerHTML = `
    <div class="booking-form-section active">
      <div class="booking-row">
        <div class="booking-field">
          <label>ชื่อสัตว์เลี้ยง <span style="color:#EF4444">*</span></label>
          <input type="text" id="b-petname" placeholder="เช่น บัดดี้" value="${bookingData.petName || ''}" aria-required="true">
        </div>
        <div class="booking-field">
          <label>ประเภท</label>
          <select id="b-pettype">
            <option value="dog" ${bookingData.petType === 'dog' ? 'selected' : ''}>🐕 สุนัข</option>
            <option value="cat" ${bookingData.petType === 'cat' ? 'selected' : ''}>🐈 แมว</option>
            <option value="rabbit" ${bookingData.petType === 'rabbit' ? 'selected' : ''}>🐇 กระต่าย</option>
            <option value="bird" ${bookingData.petType === 'bird' ? 'selected' : ''}>🐦 นก</option>
            <option value="other" ${bookingData.petType === 'other' ? 'selected' : ''}>🐾 อื่นๆ</option>
          </select>
        </div>
      </div>
      <div class="booking-row">
        <div class="booking-field">
          <label>สายพันธุ์</label>
          <input type="text" id="b-breed" placeholder="เช่น โกลเด้น รีทรีฟเวอร์" value="${bookingData.breed || ''}">
        </div>
        <div class="booking-field">
          <label>อายุ</label>
          <input type="text" id="b-age" placeholder="เช่น 3 ปี" value="${bookingData.age || ''}">
        </div>
      </div>
      <div class="booking-field">
        <label>น้ำหนัก (กก.)</label>
        <input type="number" id="b-weight" placeholder="เช่น 12" value="${bookingData.weight || ''}" step="0.1">
      </div>
    </div>
  `;
}

// Step 3: Owner contact
function renderStep3(container) {
  const isAuth = isOwnerAuthenticated();
  let defaultOwner = bookingData.ownerName || '';
  let defaultPhone = bookingData.phone || '';
  let defaultEmail = bookingData.email || '';
  
  if (isAuth && !bookingData.ownerName) {
    const ownerData = getOwnerData();
    if (ownerData) {
      defaultOwner = ownerData.name;
      defaultPhone = ownerData.phone;
      defaultEmail = ownerData.email;
      // Auto-save to bookingData
      bookingData.ownerName = defaultOwner;
      bookingData.phone = defaultPhone;
      bookingData.email = defaultEmail;
    }
  }

  container.innerHTML = `
    <div class="booking-form-section active">
      <div class="booking-field">
        <label>ชื่อเจ้าของ <span style="color:#EF4444">*</span></label>
        <input type="text" id="b-owner" placeholder="ชื่อ-นามสกุล" value="${defaultOwner}" aria-required="true">
      </div>
      <div class="booking-field">
        <label>เบอร์โทรศัพท์ <span style="color:#EF4444">*</span></label>
        <input type="tel" id="b-phone" placeholder="08x-xxx-xxxx" value="${bookingData.phone || ''}" aria-required="true">
      </div>
      <div class="booking-field">
        <label>อีเมล</label>
        <input type="email" id="b-email" placeholder="email@example.com" value="${bookingData.email || ''}">
      </div>
      <div style="background:#F0FDFA;border:1px solid rgba(13,148,136,0.15);border-radius:10px;padding:14px;margin-top:8px">
        <div style="font-size:12px;color:var(--text-muted);font-family:'Sarabun',sans-serif">
          <i class="fas fa-shield-halved" style="color:var(--primary);margin-right:6px"></i>
          ข้อมูลของคุณจะถูกส่งไปยังพาร์ทเนอร์เท่านั้น และเข้ารหัสด้วยมาตรฐาน SSL
        </div>
      </div>
    </div>
  `;
}

// Confirmation
function renderConfirmation(container) {
  const refNumber = 'FUFU-' + Date.now().toString(36).toUpperCase().slice(-6);
  const dateObj = bookingData.date ? new Date(bookingData.date) : new Date();
  const thaiDate = dateObj.toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  container.innerHTML = `
    <div class="booking-confirmation">
      <div class="confirm-icon"><i class="fas fa-check"></i></div>
      <h4>จองสำเร็จ! 🎉</h4>
      <p>การจองของคุณได้รับการบันทึกเรียบร้อยแล้ว</p>
      <div class="booking-ref">
        <div class="booking-ref-label">หมายเลขอ้างอิง</div>
        <div class="booking-ref-number">${refNumber}</div>
      </div>
      <div class="booking-detail-grid">
        <div class="booking-detail-item">
          <div class="detail-label">ร้าน / คลินิก</div>
          <div class="detail-value">${bookingData.partnerName}</div>
        </div>
        <div class="booking-detail-item">
          <div class="detail-label">บริการ</div>
          <div class="detail-value">${bookingData.service || '-'}</div>
        </div>
        <div class="booking-detail-item">
          <div class="detail-label">วันที่</div>
          <div class="detail-value">${thaiDate}</div>
        </div>
        <div class="booking-detail-item">
          <div class="detail-label">เวลา</div>
          <div class="detail-value">${bookingData.time || '-'}</div>
        </div>
        <div class="booking-detail-item">
          <div class="detail-label">สัตว์เลี้ยง</div>
          <div class="detail-value">${bookingData.petName || '-'}</div>
        </div>
        <div class="booking-detail-item">
          <div class="detail-label">เจ้าของ</div>
          <div class="detail-value">${bookingData.ownerName || '-'}</div>
        </div>
      </div>
      <div class="booking-action-btns">
        <a href="#" style="background:#F1F5F9;color:var(--text-main);border:1px solid rgba(203,213,225,0.5)">
          <i class="fas fa-calendar-plus" style="margin-right:4px"></i>เพิ่มลงปฏิทิน
        </a>
        <a href="#" style="background:var(--primary);color:#fff;border:none">
          <i class="fas fa-share-alt" style="margin-right:4px"></i>แชร์
        </a>
      </div>
      <div style="margin-top:16px;font-size:12px;color:var(--text-muted);font-family:'Sarabun',sans-serif">
        <i class="fas fa-envelope" style="margin-right:4px"></i>
        รายละเอียดการจองจะถูกส่งไปยัง ${bookingData.email || bookingData.phone || 'ช่องทางที่ระบุ'}
      </div>
    </div>
  `;
}

/**
 * Validate and advance to next booking step.
 */
function nextBookingStep() {
  // Collect data from current step
  if (bookingStep === 0) {
    const service = document.getElementById('b-service')?.value;
    const date = document.getElementById('b-date')?.value;
    const time = document.getElementById('b-time')?.value;
    const notes = document.getElementById('b-notes')?.value;

    if (!service || !date || !time) {
      showDiscoveryToast('กรุณาเลือกบริการ วันที่ และเวลา', 'error');
      return;
    }
    Object.assign(bookingData, { service, date, time, notes });
  } else if (bookingStep === 1) {
    const petName = document.getElementById('b-petname')?.value?.trim();
    const petType = document.getElementById('b-pettype')?.value;
    const breed = document.getElementById('b-breed')?.value?.trim();
    const age = document.getElementById('b-age')?.value?.trim();
    const weight = document.getElementById('b-weight')?.value;

    if (!petName) {
      showDiscoveryToast('กรุณากรอกชื่อสัตว์เลี้ยง', 'error');
      return;
    }
    Object.assign(bookingData, { petName, petType, breed, age, weight });
  } else if (bookingStep === 2) {
    const ownerName = document.getElementById('b-owner')?.value?.trim();
    const phone = document.getElementById('b-phone')?.value?.trim();
    const email = document.getElementById('b-email')?.value?.trim();

    if (!ownerName || !phone) {
      showDiscoveryToast('กรุณากรอกชื่อเจ้าของและเบอร์โทร', 'error');
      return;
    }
    // Validate Thai phone
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10 || !cleanPhone.startsWith('0')) {
      showDiscoveryToast('เบอร์โทรไม่ถูกต้อง (ต้อง 10 หลัก ขึ้นต้นด้วย 0)', 'error');
      return;
    }
    Object.assign(bookingData, { ownerName, phone, email });
  }

  bookingStep++;
  renderBookingStep();
}

/**
 * Simple toast for discovery page (uses landing page's toast if available).
 */
function showDiscoveryToast(message, type = 'success') {
  // Try to use global toast
  let toast = document.getElementById('toast');
  let toastText = document.getElementById('toast-text');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = 'toast';
    toast.innerHTML = '<i class="fas fa-check-circle toast-icon"></i><div class="toast-text" id="toast-text"></div>';
    document.body.appendChild(toast);
    toastText = toast.querySelector('.toast-text');
  }
  const icon = toast.querySelector('.toast-icon');
  if (icon) {
    icon.className = 'toast-icon fas';
    icon.classList.add(type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle');
    icon.style.color = type === 'error' ? '#EF4444' : '';
  }
  if (toastText) toastText.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== GEOLOCATION =====

/**
 * Prompt user for geolocation and update distance sorting.
 */
function requestGeolocation() {
  const btn = document.getElementById('geo-locate-btn');
  if (!navigator.geolocation) {
    showDiscoveryToast('เบราว์เซอร์ไม่รองรับ Geolocation', 'error');
    return;
  }

  if (btn) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>กำลังค้นหา...';
    btn.disabled = true;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      showDiscoveryToast('ค้นหาตำแหน่งสำเร็จ — เรียงตามระยะทาง');
      if (btn) {
        btn.innerHTML = '<i class="fas fa-location-dot" style="margin-right:6px"></i>ใกล้ฉัน ✓';
        btn.disabled = false;
      }
      renderPartnerCards();
    },
    () => {
      showDiscoveryToast('ไม่สามารถดึงตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง', 'error');
      if (btn) {
        btn.innerHTML = '<i class="fas fa-location-dot" style="margin-right:6px"></i>ค้นหาใกล้ฉัน';
        btn.disabled = false;
      }
    }
  );
}

// ===== INIT =====

/**
 * Initialize the service discovery section.
 */
export function initDiscovery() {
  renderPartnerCards();

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter || 'all';
      renderPartnerCards();
    });
  });

  // Search input
  const searchInput = document.getElementById('partner-search');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        currentSearch = e.target.value.trim();
        renderPartnerCards();
      }, 300);
    });
  }

  // Geolocation button
  const geoBtn = document.getElementById('geo-locate-btn');
  if (geoBtn) geoBtn.addEventListener('click', requestGeolocation);

  // Book Now buttons — delegate from partner results
  const results = document.getElementById('partner-results');
  if (results) {
    results.addEventListener('click', (e) => {
      const btn = e.target.closest('.book-now-btn');
      if (btn) {
        e.stopPropagation();
        openBooking(btn.dataset.partnerId);
        return;
      }
      // Card click also opens booking
      const card = e.target.closest('.partner-card');
      if (card) {
        openBooking(card.dataset.partnerId);
      }
    });

    // Keyboard accessibility
    results.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const card = e.target.closest('.partner-card');
        if (card) openBooking(card.dataset.partnerId);
      }
    });
  }

  // Booking modal close
  const bookingOverlay = document.getElementById('booking-overlay');
  if (bookingOverlay) {
    bookingOverlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeBooking();
    });
  }

  const closeBtn = document.getElementById('booking-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeBooking);

  // Escape key closes booking
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBooking();
  });
}
