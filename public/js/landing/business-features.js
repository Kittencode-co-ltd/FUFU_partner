/**
 * FUFU Partner – Business Features Module
 * Interactive tabbed feature showcase segmented by business type.
 * @module landing/business-features
 */

// ===== BUSINESS TYPE DEFINITIONS =====
const BUSINESS_TYPES = [
  { id: 'vet',      label: 'คลินิกสัตวแพทย์',     icon: 'fa-clinic-medical', color: '#3B82F6' },
  { id: 'shop',     label: 'ร้านค้าสัตว์เลี้ยง',   icon: 'fa-store',          color: '#10B981' },
  { id: 'hotel',    label: 'โรงแรมสัตว์เลี้ยง',    icon: 'fa-hotel',          color: '#8B5CF6' },
  { id: 'grooming', label: 'ร้านตัดแต่งขน',       icon: 'fa-scissors',       color: '#EC4899' },
];

// ===== FEATURE DATA =====
const FEATURES_DATA = {
  vet: [
    {
      title: 'เวชระเบียนและการรักษา',
      icon: 'fa-notes-medical',
      items: [
        'บันทึกประวัติสัตว์ป่วยแบบครบถ้วน',
        'แยกเคส OPD (นอก) และ IPD (ใน)',
        'บัตรวัคซีน + แจ้งเตือนนัดฉีด',
        'ฟอร์มทางการแพทย์ (ผ่าตัด, ส่งตัว, รับฝาก)',
        'แนบไฟล์รูป ผลแล็บ, X-Ray',
      ],
    },
    {
      title: 'ระบบคิวและนัดหมาย',
      icon: 'fa-calendar-check',
      items: [
        'ปฏิทินนัดหมายแบบ Day/Week view',
        'แจ้งเตือน SMS/Line อัตโนมัติ',
        'ระบบคิวหน้าเคาน์เตอร์',
        'จอแสดงคิวสำหรับทีวี',
      ],
    },
    {
      title: 'คลังสินค้าและยา',
      icon: 'fa-pills',
      items: [
        'จัดการสต๊อกยาและเวชภัณฑ์',
        'แจ้งเตือนยาใกล้หมด/หมดอายุ',
        'ระบุราคาทุน-ขาย + กำไร',
        'หน่วยย่อย (เม็ด, ซีซี, หลอด)',
      ],
    },
    {
      title: 'การเงินและรายงาน',
      icon: 'fa-chart-pie',
      items: [
        'ออกใบเสร็จ/ใบกำกับภาษี (รูปแบบไทย)',
        'รองรับหลายช่องทาง (เงินสด, โอน, QR PromptPay)',
        'รายงานรายได้แยกตามแพทย์/บริการ',
        'สถิติการรักษา รายวัน/เดือน',
      ],
    },
    {
      title: 'พิเศษสำหรับคลินิก',
      icon: 'fa-star',
      items: [
        'เชื่อมต่อผลแล็บ (IDEXX)',
        'ฟอร์มกรมปศุสัตว์อัตโนมัติ',
        'ระบบสั่งจ่ายยา + พิมพ์ฉลาก',
        'จัดการเวรแพทย์',
      ],
    },
  ],

  shop: [
    {
      title: 'ระบบขายหน้าร้าน (POS)',
      icon: 'fa-cash-register',
      items: [
        'ระบบคิดเงินรวดเร็ว',
        'พิมพ์บาร์โค้ดสินค้า',
        'รองรับหลายช่องทางชำระเงิน',
        'ใบเสร็จ/ใบกำกับภาษี',
      ],
    },
    {
      title: 'จัดการสินค้าและสต๊อก',
      icon: 'fa-boxes-stacked',
      items: [
        'จัดการสินค้าหลากหลายประเภท',
        'ดูสต๊อกแบบ Real-time',
        'แจ้งเตือนสินค้าใกล้หมด',
        'นับสต๊อกอัตโนมัติ',
      ],
    },
    {
      title: 'ระบบสมาชิกและโปรโมชั่น',
      icon: 'fa-user-group',
      items: [
        'ทำสมาชิกร้านค้า',
        'ระบบสะสมแต้ม',
        'ส่วนลด/คูปอง',
        'แจ้งเตือนโปรโมชั่นผ่าน SMS/Line',
      ],
    },
    {
      title: 'รายงานและวิเคราะห์',
      icon: 'fa-chart-line',
      items: [
        'รายงานยอดขายรายวัน/เดือน',
        'สินค้าขายดี',
        'วิเคราะห์ลูกค้าประจำ',
        'กำไร-ขาดทุน',
      ],
    },
  ],

  hotel: [
    {
      title: 'จัดการห้องพัก',
      icon: 'fa-bed',
      items: [
        'แผนผังห้องพักแบบ Visual Grid',
        'สถานะห้อง: ว่าง / มีผู้เข้าพัก / ปิดปรับปรุง',
        'ระบบจองห้องแบบปฏิทิน',
        'รองรับหลายประเภทห้อง (เล็ก/กลาง/ใหญ่)',
      ],
    },
    {
      title: 'Check-in / Check-out',
      icon: 'fa-right-to-bracket',
      items: [
        'ฟอร์มรับฝากแบบครบถ้วน',
        'อัปโหลดรูปสัตว์เลี้ยง',
        'บันทึกข้อมูลเฉพาะ (อาหาร, ยา, พฤติกรรม)',
        'คำนวณค่าที่พักอัตโนมัติ',
      ],
    },
    {
      title: 'ดูแลระหว่างพัก',
      icon: 'fa-heart',
      items: [
        'ตารางดูแลรายวัน',
        'บันทึกการให้ยา',
        'บันทึกการให้อาหาร',
        'ส่งรูปให้เจ้าของ (Line/SMS)',
      ],
    },
    {
      title: 'รายงานและบัญชี',
      icon: 'fa-file-invoice-dollar',
      items: [
        'คิดเงินค่าที่พัก + บริการเสริม',
        'รายงานอัตราการเข้าพัก (Occupancy Rate)',
        'รายได้แยกตามประเภทห้อง',
        'ประวัติการเข้าพักของสัตว์เลี้ยง',
      ],
    },
  ],

  grooming: [
    {
      title: 'ระบบนัดหมายและคิว',
      icon: 'fa-calendar-days',
      items: [
        'จองคิวนัดหมายออนไลน์',
        'ประมาณเวลาให้บริการ',
        'แจ้งเตือนนัดหมายล่วงหน้า',
        'ระบบคิวรอ',
      ],
    },
    {
      title: 'จัดการช่างและเวลา',
      icon: 'fa-user-gear',
      items: [
        'มอบหมายงานให้ช่าง',
        'ตารางงานรายวัน/สัปดาห์',
        'จับเวลาให้บริการ',
        'คำนวณค่าคอมมิชชันช่าง',
      ],
    },
    {
      title: 'ประวัติสัตว์เลี้ยง',
      icon: 'fa-paw',
      items: [
        'บันทึกสไตล์การตัดขนที่ชอบ',
        'รูปก่อน-หลัง',
        'หมายเหตุพิเศษ (แพ้, ก้าวร้าว)',
        'ประวัติบริการย้อนหลัง',
      ],
    },
    {
      title: 'การขายและรายงาน',
      icon: 'fa-receipt',
      items: [
        'ระบบคิดเงิน + ออกใบเสร็จ',
        'ขายสินค้าเสริม (แชมพู, อาหาร)',
        'รายงานรายได้รายช่าง',
        'บริการยอดนิยม',
      ],
    },
  ],
};

// ===== TESTIMONIALS BY TYPE =====
const TESTIMONIALS_BY_TYPE = {
  vet: {
    text: 'คลินิกเราจัดการง่ายขึ้น 80% หลังจากใช้ FUFU ระบบ EMR ช่วยให้ดูประวัติผู้ป่วยได้ทันที ลดเวลารอคิวไปเกินครึ่ง',
    author: 'สพ.ญ.สมศรี รักษ์สัตว์',
    role: 'Happy Paws Clinic',
    avatar: 'ส',
  },
  shop: {
    text: 'POS ของ FUFU ใช้ง่ายมาก ตัดสต๊อกอัตโนมัติ ไม่ต้องนับเองอีกต่อไป ยอดขายดูได้จากมือถือ สะดวกสุดๆ',
    author: 'คุณวิภาดา ธนะสมบูรณ์',
    role: 'PetVille Superstore',
    avatar: 'ว',
  },
  hotel: {
    text: 'การส่งรูปอัพเดทให้เจ้าของทุกวัน ทำให้ลูกค้ามั่นใจ กลับมาใช้บริการซ้ำทุกครั้ง รายได้เพิ่มขึ้น 40%',
    author: 'คุณปิยะ สุขสันต์',
    role: 'Furry Dreams Pet Hotel',
    avatar: 'ป',
  },
  grooming: {
    text: 'ระบบจองคิวออนไลน์ช่วยลดปัญหาลูกค้ารอนาน จัดตารางช่างได้เป็นระเบียบ คอมมิชชันคิดให้อัตโนมัติ',
    author: 'คุณนิดา สวัสดี',
    role: 'Fluffy Grooming Studio',
    avatar: 'น',
  },
};

// ===== PRICING DATA =====
const PRICING_DATA = {
  vet:      { price: '1,490', unit: 'บาท/เดือน' },
  shop:     { price: '990',   unit: 'บาท/เดือน' },
  hotel:    { price: '1,290', unit: 'บาท/เดือน' },
  grooming: { price: '890',   unit: 'บาท/เดือน' },
};

// ===== STATE =====
let activeType = 'vet';

// ===== RENDER FUNCTIONS =====

/**
 * Get color for a business type.
 */
function getTypeColor(typeId) {
  return BUSINESS_TYPES.find(t => t.id === typeId)?.color || '#0D9488';
}

/**
 * Build the tab selector HTML.
 */
function renderTabs() {
  return BUSINESS_TYPES.map(type => `
    <button class="biz-tab ${type.id === activeType ? 'active' : ''}"
            data-type="${type.id}"
            aria-label="ดูฟีเจอร์สำหรับ${type.label}"
            style="--tab-color: ${type.color}">
      <i class="fas ${type.icon}"></i>
      <span class="biz-tab-label">${type.label}</span>
    </button>
  `).join('');
}

/**
 * Build the feature cards grid for a type.
 */
function renderFeatureCards(typeId) {
  const features = FEATURES_DATA[typeId];
  const color = getTypeColor(typeId);

  return features.map((group, idx) => `
    <div class="biz-feature-card biz-card-animate" style="--card-accent: ${color}; animation-delay: ${idx * 0.08}s">
      <div class="biz-feature-card-header">
        <div class="biz-feature-card-icon" style="background: ${color}15; color: ${color}">
          <i class="fas ${group.icon}"></i>
        </div>
        <h4>${group.title}</h4>
      </div>
      <ul class="biz-feature-list">
        ${group.items.map(item => `
          <li>
            <span class="biz-bullet" style="color: ${color}"><i class="fas fa-check"></i></span>
            <span>${item}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `).join('');
}

/**
 * Build testimonial for active type.
 */
function renderTypeTestimonial(typeId) {
  const t = TESTIMONIALS_BY_TYPE[typeId];
  const color = getTypeColor(typeId);
  return `
    <div class="biz-testimonial" style="--testimonial-accent: ${color}">
      <div class="biz-testimonial-quote">
        <i class="fas fa-quote-left"></i>
      </div>
      <p class="biz-testimonial-text">"${t.text}"</p>
      <div class="biz-testimonial-author">
        <div class="biz-testimonial-avatar" style="background: ${color}">${t.avatar}</div>
        <div>
          <div class="biz-testimonial-name">${t.author}</div>
          <div class="biz-testimonial-role">${t.role}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Build pricing preview.
 */
function renderPricingPreview(typeId) {
  const p = PRICING_DATA[typeId];
  const color = getTypeColor(typeId);
  const type = BUSINESS_TYPES.find(t => t.id === typeId);

  return `
    <div class="biz-pricing-preview" style="--pricing-accent: ${color}">
      <div class="biz-pricing-badge" style="background: ${color}15; color: ${color}">
        <i class="fas ${type.icon}"></i> ${type.label}
      </div>
      <div class="biz-pricing-amount">
        <span class="biz-pricing-currency">฿</span>
        <span class="biz-pricing-value">${p.price}</span>
      </div>
      <div class="biz-pricing-unit">${p.unit}</div>
      <div class="biz-pricing-note">ทดลองใช้ฟรี 14 วัน · ไม่ต้องผูกบัตรเครดิต</div>
    </div>
  `;
}

/**
 * Build the CTA buttons for a type.
 */
function renderCTA(typeId) {
  const color = getTypeColor(typeId);
  return `
    <div class="biz-cta-group">
      <a href="register.html" class="btn biz-cta-primary" style="background: ${color}; box-shadow: 0 8px 24px ${color}40">
        เริ่มใช้งานฟรี 14 วัน <i class="fas fa-arrow-right"></i>
      </a>
      <a href="#features" class="btn biz-cta-outline" style="border-color: ${color}; color: ${color}">
        ดูรายละเอียดเพิ่มเติม
      </a>
      <a href="#" class="btn biz-cta-ghost">
        <i class="fas fa-headset"></i> ติดต่อทีมขาย
      </a>
    </div>
  `;
}

/**
 * Render the entire feature panel for the active type.
 */
function renderActivePanel() {
  const container = document.getElementById('biz-features-content');
  if (!container) return;

  // Fade out
  container.classList.add('fading');

  setTimeout(() => {
    container.innerHTML = `
      <div class="biz-features-grid">
        ${renderFeatureCards(activeType)}
      </div>
      ${renderCTA(activeType)}
    `;

    // Fade in
    requestAnimationFrame(() => {
      container.classList.remove('fading');
    });

    // Re-trigger AOS for new elements
    if (typeof AOS !== 'undefined') {
      AOS.refresh();
    }
  }, 300);
}

/**
 * Render the "How it Works" section.
 */
function renderHowItWorks() {
  const container = document.getElementById('how-it-works-steps');
  if (!container) return;

  const steps = [
    { num: '01', icon: 'fa-hand-pointer', title: 'เลือกประเภทธุรกิจของคุณ', desc: 'ระบุประเภทธุรกิจ ฟีเจอร์จะปรับให้เหมาะกับการดำเนินงานของคุณโดยเฉพาะ' },
    { num: '02', icon: 'fa-gear',         title: 'สร้างบัญชีและตั้งค่าร้าน',  desc: 'กรอกข้อมูลร้าน เพิ่มบริการ ตั้งราคา และปรับแต่งทุกอย่างให้เข้ากับธุรกิจคุณ' },
    { num: '03', icon: 'fa-rocket',       title: 'เริ่มใช้งานทันที',          desc: 'เริ่มรับลูกค้า จัดการนัดหมาย และดูรายงานได้ทันที พร้อมทีมซัพพอร์ตตลอด 24 ชม.' },
  ];

  container.innerHTML = steps.map((s, i) => `
    <div class="hiw-step" data-aos="fade-up" data-aos-delay="${i * 150}">
      <div class="hiw-step-num">${s.num}</div>
      <div class="hiw-step-icon"><i class="fas ${s.icon}"></i></div>
      <h4>${s.title}</h4>
      <p>${s.desc}</p>
      ${i < steps.length - 1 ? '<div class="hiw-step-arrow"><i class="fas fa-chevron-right"></i></div>' : ''}
    </div>
  `).join('');
}

// ===== INIT =====

/**
 * Initialize business features section.
 */
export function initBusinessFeatures() {
  const tabContainer = document.getElementById('biz-tabs');
  if (!tabContainer) return;

  // Render tabs
  tabContainer.innerHTML = renderTabs();

  // Render initial panel
  renderActivePanel();

  // Render how-it-works
  renderHowItWorks();

  // Tab click handler
  tabContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.biz-tab');
    if (!btn || btn.dataset.type === activeType) return;

    activeType = btn.dataset.type;

    // Update tab states
    tabContainer.querySelectorAll('.biz-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.type === activeType);
    });

    renderActivePanel();
  });
}
