// Portal language (shell only for now: menu, page titles, profile menu).
// Shares the `fufu_lang` key with the login page and the landing page.
// Page contents are still Thai; translate them module by module using t().
const LANG_KEY = 'fufu_lang';

export const LANGS = [
  { code: 'th', label: 'ไทย', html: 'th', locale: 'th-TH' },
  { code: 'en', label: 'English', html: 'en', locale: 'en-GB' },
  { code: 'zh', label: '中文', html: 'zh-CN', locale: 'zh-CN' },
  { code: 'ja', label: '日本語', html: 'ja', locale: 'ja-JP' },
  { code: 'ko', label: '한국어', html: 'ko', locale: 'ko-KR' },
];

const PAGES = {
  en: { screenings: 'AI referrals', home: 'Overview', queue: 'Queue', cashier: 'Cashier', appointments: 'Appointments', calendar: 'Calendar', patients: 'Patients', opd: 'OPD · Exam room', ipd: 'IPD · Inpatients', medical: 'Medical records', inventory: 'Pharmacy & supplies', summaries: 'Visit summaries', clinic: 'Clinic profile', users: 'Users', settings: 'Settings', staff: 'Staff', pos: 'Point of sale', orders: 'Online orders', delivery: 'Delivery', income: 'Revenue', hotel: 'Rooms & care', grooming: 'Grooming jobs', pets: 'Pets & owners', documents: 'Documents', kanban: 'Tasks', 'pet-profile': 'Pet profile' },
  zh: { screenings: 'AI 转诊', home: '概览', queue: '排队', cashier: '收银', appointments: '预约', calendar: '日历', patients: '就诊动物', opd: '门诊 · 诊室', ipd: '住院', medical: '病历', inventory: '药品与耗材', summaries: '就诊小结', clinic: '诊所资料', users: '用户', settings: '设置', staff: '员工', pos: '收银台', orders: '线上订单', delivery: '配送', income: '收入', hotel: '房间与预订', grooming: '美容', pets: '宠物与主人', documents: '文件', kanban: '任务', 'pet-profile': '宠物资料' },
  ja: { screenings: 'AI 紹介', home: '概要', queue: '受付順番', cashier: '会計', appointments: '予約', calendar: 'カレンダー', patients: '来院動物', opd: '外来 · 診察室', ipd: '入院', medical: '診療記録', inventory: '薬品・資材', summaries: '診療サマリー', clinic: '病院情報', users: 'ユーザー', settings: '設定', staff: 'スタッフ', pos: 'レジ', orders: 'オンライン注文', delivery: '配送', income: '売上', hotel: '部屋と予約', grooming: 'トリミング', pets: 'ペットと飼い主', documents: '書類', kanban: 'タスク', 'pet-profile': 'ペット情報' },
  ko: { screenings: 'AI 의뢰', home: '개요', queue: '대기열', cashier: '수납', appointments: '예약', calendar: '캘린더', patients: '내원 동물', opd: '외래 · 진료실', ipd: '입원', medical: '진료 기록', inventory: '약품 및 소모품', summaries: '진료 요약', clinic: '병원 정보', users: '사용자', settings: '설정', staff: '직원', pos: '판매', orders: '온라인 주문', delivery: '배송', income: '매출', hotel: '객실 및 예약', grooming: '미용', pets: '반려동물과 보호자', documents: '문서', kanban: '할 일', 'pet-profile': '반려동물 정보' },
};

// Menu group headings (dashboard.js BUSINESS_NAV `group`)
const NAV_GROUPS = {
  th: { today: 'วันนี้', intake: 'รับนัดและเคส', care: 'ตรวจรักษา', payment: 'ชำระเงิน', records: 'ข้อมูลและประวัติ', stock: 'คลัง', sales: 'การขาย', money: 'การเงิน', booking: 'การจอง', stay: 'เข้าพัก', service: 'ให้บริการ' },
  en: { today: 'Today', intake: 'Bookings & cases', care: 'Treatment', payment: 'Payment', records: 'Records', stock: 'Stock', sales: 'Sales', money: 'Finance', booking: 'Bookings', stay: 'Stays', service: 'Service' },
  zh: { today: '今天', intake: '预约与病例', care: '诊疗', payment: '收款', records: '资料与记录', stock: '库存', sales: '销售', money: '财务', booking: '预订', stay: '入住', service: '服务' },
  ja: { today: '今日', intake: '予約・症例', care: '診療', payment: '会計', records: '記録', stock: '在庫', sales: '販売', money: '売上', booking: '予約', stay: '宿泊', service: 'サービス' },
  ko: { today: '오늘', intake: '예약 및 케이스', care: '진료', payment: '수납', records: '기록', stock: '재고', sales: '판매', money: '재무', booking: '예약', stay: '숙박', service: '서비스' },
};

const UI = {
  th: { menu: 'เมนู', account: 'บัญชีของฉัน', theme: 'ธีม', light: 'สว่าง', dark: 'มืด', auto: 'ตามเครื่อง', textSize: 'ขนาดตัวอักษร', sm: 'เล็ก', md: 'ปกติ', lg: 'ใหญ่', xl: 'ใหญ่มาก', language: 'ภาษา', logout: 'ออกจากระบบ', partialNote: 'เนื้อหาในแต่ละหน้ายังเป็นภาษาไทย', owner: 'เจ้าของร้าน', vet: 'สัตวแพทย์', reception: 'ต้อนรับ', staff: 'พนักงาน', accountant: 'บัญชี', counter: 'เคาน์เตอร์', admin: 'ผู้ดูแลระบบ', user: 'ผู้ใช้งาน' },
  en: { menu: 'Menu', account: 'My account', theme: 'Theme', light: 'Light', dark: 'Dark', auto: 'System', textSize: 'Text size', sm: 'Small', md: 'Normal', lg: 'Large', xl: 'Extra large', language: 'Language', logout: 'Log out', partialNote: 'Page contents are still in Thai', owner: 'Owner', vet: 'Veterinarian', reception: 'Reception', staff: 'Staff', accountant: 'Accounting', counter: 'Counter', admin: 'Administrator', user: 'User' },
  zh: { menu: '菜单', account: '我的账户', theme: '主题', light: '浅色', dark: '深色', auto: '跟随系统', textSize: '字体大小', sm: '小', md: '标准', lg: '大', xl: '特大', language: '语言', logout: '退出登录', partialNote: '页面内容暂为泰语', owner: '店主', vet: '兽医', reception: '前台', staff: '员工', accountant: '财务', counter: '柜台', admin: '管理员', user: '用户' },
  ja: { menu: 'メニュー', account: 'マイアカウント', theme: 'テーマ', light: 'ライト', dark: 'ダーク', auto: 'システム', textSize: '文字サイズ', sm: '小', md: '標準', lg: '大', xl: '特大', language: '言語', logout: 'ログアウト', partialNote: 'ページ内容はまだタイ語です', owner: 'オーナー', vet: '獣医師', reception: '受付', staff: 'スタッフ', accountant: '経理', counter: 'カウンター', admin: '管理者', user: 'ユーザー' },
  ko: { menu: '메뉴', account: '내 계정', theme: '테마', light: '라이트', dark: '다크', auto: '시스템', textSize: '글자 크기', sm: '작게', md: '보통', lg: '크게', xl: '아주 크게', language: '언어', logout: '로그아웃', partialNote: '페이지 내용은 아직 태국어입니다', owner: '대표', vet: '수의사', reception: '접수', staff: '직원', accountant: '회계', counter: '카운터', admin: '관리자', user: '사용자' },
};

export function getLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return LANGS.some(l => l.code === saved) ? saved : 'th';
  } catch { return 'th'; }
}

export function setLang(code) {
  if (!LANGS.some(l => l.code === code)) return;
  try { localStorage.setItem(LANG_KEY, code); } catch { /* storage blocked */ }
  // Every module renders its own markup, so a reload is the reliable way to switch everything at once
  location.reload();
}

export function applyLangAttr() {
  const lang = LANGS.find(l => l.code === getLang()) || LANGS[0];
  document.documentElement.lang = lang.html;
  document.documentElement.dataset.lang = lang.code;
}

export const locale = () => (LANGS.find(l => l.code === getLang()) || LANGS[0]).locale;

/** UI string for the current language (Thai fallback). */
export function t(key) {
  const lang = getLang();
  return UI[lang]?.[key] ?? UI.th[key] ?? key;
}

/** Page name for the menu / title bar; Thai keeps each workspace's own wording. */
export function pageLabel(id, thai) {
  const lang = getLang();
  return lang === 'th' ? thai : (PAGES[lang]?.[id] || thai);
}

/** Menu group heading for the current language. */
export function groupLabel(key) {
  const lang = getLang();
  return NAV_GROUPS[lang]?.[key] || NAV_GROUPS.th[key] || key;
}
