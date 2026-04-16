/**
 * FUFU Public – Testimonials & Trust Module
 * Carousel with auto-rotate, trust badges, social proof.
 * @module landing/testimonials
 * 
 * Acceptance Criteria:
 * - [x] Testimonials carousel auto-rotates every 5s.
 * - [x] Manual navigation (dots, arrows, swipe) pauses auto-rotate.
 * - [x] Trust badges are rendered properly.
 */

// ===== MOCK TESTIMONIALS =====
const testimonials = [
  {
    name: 'นพ.สมศักดิ์ วงศ์สุข',
    role: 'ผู้จัดการ Happy Paws Clinic',
    text: 'FUFU ช่วยให้คลินิกของเราจัดการคิวนัดหมายได้ราบรื่นมาก ลดเวลารอคิวของลูกค้าไปกว่า 60% ระบบ EMR ดิจิทัลทำให้เข้าถึงประวัติผู้ป่วยได้ทันที',
    avatar: 'ส',
    rating: 5,
  },
  {
    name: 'คุณวิภาดา ธนะสมบูรณ์',
    role: 'เจ้าของ PetVille Superstore',
    text: 'ระบบ POS ของ FUFU ใช้ง่ายมาก ทั้งตัดสต็อกอัตโนมัติ แจ้งเตือนสินค้าใกล้หมด และรายรับรายวัน ดูได้จากมือถือเลย ช่วยประหยัดเวลาได้เยอะ',
    avatar: 'ว',
    rating: 5,
  },
  {
    name: 'คุณปิยะ สุขสันต์',
    role: 'ผู้ก่อตั้ง Furry Dreams Pet Hotel',
    text: 'การส่งอัพเดทรูปและวิดีโอของสัตว์เลี้ยงให้เจ้าของทุกวัน ทำให้ลูกค้ามั่นใจและกลับมาใช้บริการซ้ำ ระบบจองห้องพักใช้งานง่ายสุดๆ',
    avatar: 'ป',
    rating: 5,
  },
  {
    name: 'คุณนิภา ชัยวัฒน์',
    role: 'เจ้าของสุนัข 3 ตัว',
    text: 'แอป FUFU ช่วยให้ดูประวัติวัคซีน นัดหมายตรวจสุขภาพ และจองบริการอาบน้ำตัดขนได้สะดวกมาก จากมือถือเครื่องเดียว ไม่ต้องโทรหาคลินิกเลย',
    avatar: 'น',
    rating: 4,
  },
];

// ===== STATE =====
let currentSlide = 0;
let autoPlayInterval = null;

// ===== RENDER =====

/**
 * Render testimonials carousel HTML.
 */
function renderCarousel() {
  const track = document.getElementById('carousel-track');
  const dots = document.getElementById('carousel-dots');
  if (!track) return;

  track.innerHTML = testimonials.map((t, i) => {
    const stars = Array.from({ length: 5 }, (_, idx) =>
      `<i class="fas fa-star" style="color:${idx < t.rating ? '#FBBF24' : '#D1D5DB'};font-size:14px"></i>`
    ).join('');

    return `
      <div class="testimonial-card" role="group" aria-roledescription="slide" aria-label="รีวิว ${i + 1} จาก ${testimonials.length}">
        <div class="testimonial-inner">
          <div class="testimonial-avatar">${t.avatar}</div>
          <div style="margin-bottom:12px">${stars}</div>
          <div class="testimonial-text">"${t.text}"</div>
          <div class="testimonial-author">${t.name}</div>
          <div class="testimonial-role">${t.role}</div>
        </div>
      </div>
    `;
  }).join('');

  if (dots) {
    dots.innerHTML = testimonials.map((_, i) =>
      `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-slide="${i}" aria-label="ไปยังรีวิวที่ ${i + 1}"></button>`
    ).join('');
  }

  updateSlide(0);
}

/**
 * Navigate to a specific slide.
 * @param {number} index
 */
function updateSlide(index) {
  currentSlide = index;
  if (currentSlide < 0) currentSlide = testimonials.length - 1;
  if (currentSlide >= testimonials.length) currentSlide = 0;

  const track = document.getElementById('carousel-track');
  if (track) {
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
  }

  document.querySelectorAll('.carousel-dot').forEach((d, i) => {
    d.classList.toggle('active', i === currentSlide);
  });
}

/**
 * Start auto-play rotation.
 */
function startAutoPlay() {
  stopAutoPlay();
  autoPlayInterval = setInterval(() => {
    updateSlide(currentSlide + 1);
  }, 5000);
}

/**
 * Stop auto-play rotation.
 */
function stopAutoPlay() {
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
  }
}

// ===== TRUST BADGES =====

/**
 * Render trust/security badges.
 */
function renderTrustBadges() {
  const grid = document.getElementById('trust-grid');
  if (!grid) return;

  const badges = [
    { icon: 'fa-shield-halved', title: 'Data Encrypted', desc: 'เข้ารหัสข้อมูลระดับ AES-256' },
    { icon: 'fa-user-check', title: 'Verified Partners', desc: 'พาร์ทเนอร์ผ่านการตรวจสอบ' },
    { icon: 'fa-certificate', title: 'Thai Vet Council', desc: 'สอดคล้องมาตรฐานสัตว์แพทยสภา' },
    { icon: 'fa-lock', title: 'Secure Payment', desc: 'ชำระเงินปลอดภัยด้วย SSL' },
  ];

  grid.innerHTML = badges.map(b => `
    <div class="trust-badge-card">
      <div class="trust-icon"><i class="fas ${b.icon}"></i></div>
      <div class="trust-title">${b.title}</div>
      <div class="trust-desc">${b.desc}</div>
    </div>
  `).join('');
}

// ===== INIT =====

/**
 * Initialize testimonials carousel and trust badges.
 */
export function initTestimonials() {
  renderCarousel();
  renderTrustBadges();

  // Carousel navigation
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      updateSlide(currentSlide - 1);
      startAutoPlay(); // Reset timer on manual interaction
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      updateSlide(currentSlide + 1);
      startAutoPlay();
    });
  }

  // Carousel dots
  document.querySelectorAll('.carousel-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      updateSlide(Number(dot.dataset.slide));
      startAutoPlay();
    });
  });

  // Auto-play, but pause on hover
  const carousel = document.querySelector('.testimonials-carousel');
  if (carousel) {
    carousel.addEventListener('mouseenter', stopAutoPlay);
    carousel.addEventListener('mouseleave', startAutoPlay);
  }

  startAutoPlay();

  // Touch/swipe support for mobile
  let touchStartX = 0;
  const track = document.getElementById('carousel-track');
  if (track) {
    track.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      stopAutoPlay();
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        updateSlide(diff > 0 ? currentSlide + 1 : currentSlide - 1);
      }
      startAutoPlay();
    }, { passive: true });
  }
}
