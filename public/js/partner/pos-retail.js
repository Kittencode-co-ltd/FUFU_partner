// ขายหน้าร้าน · POS — one POS for every business type (clinic, shop, hotel, grooming).
// iPad-first: products/services on the left, the cart pinned on the right.
// Phones get a floating cart bar that opens the cart as a sheet.
// The catalogue comes from the store's own data: inventory (products), service items
// (clinic visits, vaccines, grooming, boarding…), hotel room rates, and the grooming menu.
// Each business sees its own categories first. Anything else can be added as a custom line.
// Checkout prefers the cashier flow (one transaction: payment + receipt number + FEFO stock deduction);
// if that isn't installed on this database yet it falls back to /api/pos/checkout.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS, CATEGORY_MAP } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { icon } from '../utils/icons.js';
import { getLang, locale } from './portal-i18n.js';

// ─── Text (th / en / zh / ja / ko) ────────────────────────────────────────────
const TEXT = {
  th: {
    region: 'สินค้าและบริการ', search: 'ค้นหา หรือสแกนบาร์โค้ด', custom: 'รายการอื่น', all: 'ทั้งหมด', loading: 'กำลังโหลด…',
    notFound: 'ไม่พบรายการที่ค้นหา', service: 'บริการ', out: 'หมด', left: n => `เหลือ ${n}`,
    cart: 'ตะกร้า', items: n => `${n} รายการ`, clear: 'ล้าง', closeCart: 'ปิดตะกร้า', tapToAdd: 'แตะรายการเพื่อเพิ่มลงตะกร้า',
    qtyOf: n => `จำนวน ${n}`, less: 'ลด', more: 'เพิ่ม', customer: 'ชื่อลูกค้า / สัตว์เลี้ยง (ไม่บังคับ)',
    discount: 'ส่วนลด', noVat: 'ไม่มี VAT', subtotal: 'รวม', due: 'ยอดชำระ', exact: 'พอดี', received: 'รับเงิน',
    short: v => `ขาด ${v}`, change: v => `เงินทอน ${v}`, saving: 'กำลังบันทึก…', pay: v => `ชำระเงิน ${v}`,
    cash: 'เงินสด', transfer: 'โอนเงิน', qr: 'QR', card: 'บัตร',
    onlyLeft: (n, c) => `${n} เหลือ ${c} ชิ้น`, noCode: c => `ไม่พบรายการ “${c}”`,
    drawerClosed: 'ยังไม่ได้เปิดกะเงินสด · เปิดกะที่หน้าแคชเชียร์ก่อนขาย', payFailed: 'ชำระเงินไม่สำเร็จ', notSaved: 'ยังไม่มีการบันทึก',
    walkIn: 'ลูกค้าหน้าร้าน', paid: 'ชำระเงินเรียบร้อย', changeDone: v => `ทอนเงิน ${v}`, receipt: 'ใบเสร็จ', next: 'ขายรายการต่อไป',
    customTitle: 'เพิ่มรายการอื่น', name: 'ชื่อรายการ', price: 'ราคา', qty: 'จำนวน', add: 'เพิ่มลงตะกร้า', cancel: 'ยกเลิก',
    needName: 'ใส่ชื่อรายการก่อน', room: t => `ค่าห้อง ${t}`,
    emptyShop: 'ยังไม่มีสินค้า · เพิ่มได้ที่หน้าคลังสินค้า หรือกด “รายการอื่น”',
    emptySvc: 'ยังไม่มีรายการบริการ · กด “รายการอื่น” เพื่อขายได้ทันที', seed: 'เพิ่มรายการบริการมาตรฐานของคลินิก', seeded: n => `เพิ่มแล้ว ${n} รายการ`,
  },
  en: {
    region: 'Products and services', search: 'Search or scan a barcode', custom: 'Custom item', all: 'All', loading: 'Loading…',
    notFound: 'Nothing matches your search', service: 'Service', out: 'Sold out', left: n => `${n} left`,
    cart: 'Cart', items: n => `${n} ${n === 1 ? 'item' : 'items'}`, clear: 'Clear', closeCart: 'Close cart', tapToAdd: 'Tap an item to add it to the cart',
    qtyOf: n => `Quantity of ${n}`, less: 'Decrease', more: 'Increase', customer: 'Customer / pet name (optional)',
    discount: 'Discount', noVat: 'No VAT', subtotal: 'Subtotal', due: 'Total due', exact: 'Exact', received: 'Received',
    short: v => `Short ${v}`, change: v => `Change ${v}`, saving: 'Saving…', pay: v => `Charge ${v}`,
    cash: 'Cash', transfer: 'Transfer', qr: 'QR', card: 'Card',
    onlyLeft: (n, c) => `Only ${c} of ${n} left`, noCode: c => `No item matches “${c}”`,
    drawerClosed: 'The cash drawer is not open · open a shift on the Cashier page first', payFailed: 'Payment failed', notSaved: 'nothing was saved',
    walkIn: 'Walk-in customer', paid: 'Payment complete', changeDone: v => `Change ${v}`, receipt: 'Receipt', next: 'Next sale',
    customTitle: 'Add a custom item', name: 'Item name', price: 'Price', qty: 'Qty', add: 'Add to cart', cancel: 'Cancel',
    needName: 'Enter an item name first', room: t => `${t} room`,
    emptyShop: 'No products yet · add them on the Inventory page, or use “Custom item”',
    emptySvc: 'No services yet · use “Custom item” to start selling now', seed: 'Add the standard clinic service list', seeded: n => `Added ${n} items`,
  },
  zh: {
    region: '商品与服务', search: '搜索或扫描条码', custom: '其他项目', all: '全部', loading: '加载中…',
    notFound: '没有找到相关项目', service: '服务', out: '售罄', left: n => `剩 ${n}`,
    cart: '购物车', items: n => `${n} 项`, clear: '清空', closeCart: '关闭购物车', tapToAdd: '点击项目加入购物车',
    qtyOf: n => `${n} 数量`, less: '减少', more: '增加', customer: '客户 / 宠物名（可选）',
    discount: '折扣', noVat: '不含税', subtotal: '小计', due: '应付', exact: '刚好', received: '实收',
    short: v => `差 ${v}`, change: v => `找零 ${v}`, saving: '保存中…', pay: v => `收款 ${v}`,
    cash: '现金', transfer: '转账', qr: '二维码', card: '刷卡',
    onlyLeft: (n, c) => `${n} 仅剩 ${c} 件`, noCode: c => `找不到“${c}”`,
    drawerClosed: '尚未开班 · 请先在收银页开班', payFailed: '收款失败', notSaved: '未保存任何记录',
    walkIn: '散客', paid: '收款成功', changeDone: v => `找零 ${v}`, receipt: '收据', next: '下一单',
    customTitle: '添加其他项目', name: '项目名称', price: '价格', qty: '数量', add: '加入购物车', cancel: '取消',
    needName: '请先输入项目名称', room: t => `${t} 房费`,
    emptyShop: '还没有商品 · 可在库存页添加，或使用“其他项目”',
    emptySvc: '还没有服务项目 · 使用“其他项目”即可开始收款', seed: '添加诊所标准服务项目', seeded: n => `已添加 ${n} 项`,
  },
  ja: {
    region: '商品とサービス', search: '検索またはバーコードをスキャン', custom: 'その他の項目', all: 'すべて', loading: '読み込み中…',
    notFound: '該当する項目がありません', service: 'サービス', out: '品切れ', left: n => `残り ${n}`,
    cart: 'カート', items: n => `${n} 点`, clear: 'クリア', closeCart: 'カートを閉じる', tapToAdd: '項目をタップしてカートに追加',
    qtyOf: n => `${n} の数量`, less: '減らす', more: '増やす', customer: 'お客様 / ペット名（任意）',
    discount: '割引', noVat: '税なし', subtotal: '小計', due: 'お支払い', exact: 'ちょうど', received: 'お預かり',
    short: v => `不足 ${v}`, change: v => `お釣り ${v}`, saving: '保存中…', pay: v => `会計 ${v}`,
    cash: '現金', transfer: '振込', qr: 'QR', card: 'カード',
    onlyLeft: (n, c) => `${n} は残り ${c} 点です`, noCode: c => `「${c}」が見つかりません`,
    drawerClosed: 'レジが開いていません · 会計ページでシフトを開始してください', payFailed: '会計に失敗しました', notSaved: '保存されていません',
    walkIn: '店頭のお客様', paid: '会計が完了しました', changeDone: v => `お釣り ${v}`, receipt: 'レシート', next: '次の会計',
    customTitle: 'その他の項目を追加', name: '項目名', price: '価格', qty: '数量', add: 'カートに追加', cancel: 'キャンセル',
    needName: '項目名を入力してください', room: t => `${t} 宿泊料`,
    emptyShop: '商品がまだありません · 在庫ページで追加するか「その他の項目」を使ってください',
    emptySvc: 'サービスがまだありません · 「その他の項目」ですぐに会計できます', seed: 'クリニックの標準サービスを追加', seeded: n => `${n} 件追加しました`,
  },
  ko: {
    region: '상품 및 서비스', search: '검색 또는 바코드 스캔', custom: '기타 항목', all: '전체', loading: '불러오는 중…',
    notFound: '검색 결과가 없습니다', service: '서비스', out: '품절', left: n => `${n}개 남음`,
    cart: '장바구니', items: n => `${n}개`, clear: '비우기', closeCart: '장바구니 닫기', tapToAdd: '항목을 눌러 장바구니에 담으세요',
    qtyOf: n => `${n} 수량`, less: '줄이기', more: '늘리기', customer: '고객 / 반려동물 이름 (선택)',
    discount: '할인', noVat: 'VAT 없음', subtotal: '소계', due: '결제 금액', exact: '딱 맞게', received: '받은 금액',
    short: v => `부족 ${v}`, change: v => `거스름돈 ${v}`, saving: '저장 중…', pay: v => `${v} 결제`,
    cash: '현금', transfer: '이체', qr: 'QR', card: '카드',
    onlyLeft: (n, c) => `${n} 재고가 ${c}개 남았습니다`, noCode: c => `“${c}” 항목을 찾을 수 없습니다`,
    drawerClosed: '현금 서랍이 열리지 않았습니다 · 수납 페이지에서 먼저 근무를 시작하세요', payFailed: '결제 실패', notSaved: '저장되지 않았습니다',
    walkIn: '방문 고객', paid: '결제 완료', changeDone: v => `거스름돈 ${v}`, receipt: '영수증', next: '다음 판매',
    customTitle: '기타 항목 추가', name: '항목 이름', price: '가격', qty: '수량', add: '장바구니에 담기', cancel: '취소',
    needName: '항목 이름을 먼저 입력하세요', room: t => `${t} 객실`,
    emptyShop: '아직 상품이 없습니다 · 재고 페이지에서 추가하거나 “기타 항목”을 사용하세요',
    emptySvc: '아직 서비스가 없습니다 · “기타 항목”으로 바로 판매할 수 있습니다', seed: '병원 기본 서비스 목록 추가', seeded: n => `${n}개 추가됨`,
  },
};

// Category chips. Product categories come from inventory, service categories from service_items.
const CATS = {
  th: { room: 'ห้องพัก', boarding: 'ฝากเลี้ยง / พักรักษา', consultation: 'ค่าตรวจ', vaccination: 'วัคซีน', vaccine: 'วัคซีน', procedure: 'หัตถการ', medicine: 'ยา', laboratory: 'แลป', imaging: 'X-ray / Ultrasound', surgery: 'ผ่าตัด', grooming: 'อาบน้ำตัดขน', food: 'อาหาร', accessory: 'ของใช้', service: 'บริการ', other: 'อื่นๆ' },
  en: { room: 'Rooms', boarding: 'Boarding', consultation: 'Consultations', vaccination: 'Vaccines', vaccine: 'Vaccines', procedure: 'Procedures', medicine: 'Medicine', laboratory: 'Lab', imaging: 'X-ray / Ultrasound', surgery: 'Surgery', grooming: 'Grooming', food: 'Food', accessory: 'Supplies', service: 'Services', other: 'Other' },
  zh: { room: '房间', boarding: '寄养 / 住院', consultation: '诊疗费', vaccination: '疫苗', vaccine: '疫苗', procedure: '处置', medicine: '药品', laboratory: '化验', imaging: 'X光 / 超声', surgery: '手术', grooming: '美容', food: '食品', accessory: '用品', service: '服务', other: '其他' },
  ja: { room: '客室', boarding: '預かり / 入院', consultation: '診察料', vaccination: 'ワクチン', vaccine: 'ワクチン', procedure: '処置', medicine: '薬', laboratory: '検査', imaging: 'X線 / エコー', surgery: '手術', grooming: 'トリミング', food: 'フード', accessory: '用品', service: 'サービス', other: 'その他' },
  ko: { room: '객실', boarding: '위탁 / 입원', consultation: '진료비', vaccination: '백신', vaccine: '백신', procedure: '처치', medicine: '약품', laboratory: '검사', imaging: 'X-ray / 초음파', surgery: '수술', grooming: '미용', food: '사료', accessory: '용품', service: '서비스', other: '기타' },
};
const UNITS = {
  en: { 'คืน': 'night', 'วัน': 'day', 'ถุง': 'bag', 'ครั้ง': 'visit' },
  zh: { 'คืน': '晚', 'วัน': '天', 'ถุง': '袋', 'ครั้ง': '次' },
  ja: { 'คืน': '泊', 'วัน': '日', 'ถุง': '袋', 'ครั้ง': '回' },
  ko: { 'คืน': '박', 'วัน': '일', 'ถุง': '봉', 'ครั้ง': '회' },
};

// Which categories each business sees first (anything else follows in catalogue order)
const CAT_ORDER = {
  vet: ['consultation', 'vaccination', 'vaccine', 'procedure', 'medicine', 'laboratory', 'imaging', 'surgery', 'boarding', 'grooming', 'food', 'accessory'],
  shop: ['food', 'accessory', 'medicine', 'vaccine', 'grooming', 'service'],
  hotel: ['room', 'boarding', 'grooming', 'food', 'accessory'],
  grooming: ['grooming', 'accessory', 'food', 'medicine'],
};
const CAT_ICON = { room: 'bed', boarding: 'bed', consultation: 'stethoscope', vaccination: 'syringe', vaccine: 'syringe', procedure: 'tools', medicine: 'pills', laboratory: 'file-alt', imaging: 'file-alt', surgery: 'hospital', grooming: 'cut', food: 'bone', accessory: 'box', custom: 'pen' };
const ROOM_LABEL = { standard: 'Standard', deluxe: 'Deluxe', suite: 'Suite' };
const METHODS = [['cash', 'money-bill-wave'], ['transfer', 'exchange-alt'], ['qr', 'qrcode'], ['card', 'credit-card']];

const T = () => TEXT[getLang()] || TEXT.th;
const catLabel = c => CATS[getLang()]?.[c] || CATS.th[c] || c;
const unitLabel = u => (getLang() === 'th' ? u : UNITS[getLang()]?.[u] || u);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const r2 = n => Math.round(Number(n || 0) * 100) / 100;
const baht = n => `฿${r2(n).toLocaleString(locale(), { maximumFractionDigits: 2 })}`;

let S = null; // page state

export async function renderRetailPOS(container) {
  const t = T();
  S = {
    container, storeId: storage.get(STORAGE_KEYS.STORE_ID),
    biz: CATEGORY_MAP[storage.get(STORAGE_KEYS.STORE_CATEGORY)]?.role || 'shop',
    catalog: [], loaded: false, cat: 'all', query: '', cart: [], customer: '', discount: 0, vat: 0, method: 'cash', received: '', busy: false, sheet: false,
  };
  container.innerHTML = `
    <div class="pr" data-biz="${esc(S.biz)}">
      <section class="pr-products" aria-label="${esc(t.region)}">
        <div class="pr-toolbar">
          <label class="pr-search">${icon('search', 'w-4 h-4')}
            <input type="search" placeholder="${esc(t.search)}" aria-label="${esc(t.search)}" data-pr-search autocomplete="off" enterkeyhint="search">
          </label>
          <button type="button" class="pr-custom-btn" data-pr-custom title="${esc(t.custom)}">${icon('pen', 'w-4 h-4')}<span>${esc(t.custom)}</span></button>
        </div>
        <div class="pr-cats" data-pr-cats></div>
        <div class="pr-grid" data-pr-grid><div class="pr-empty">${esc(t.loading)}</div></div>
      </section>
      <aside class="pr-cart" data-pr-cart aria-label="${esc(t.cart)}"></aside>
      <button type="button" class="pr-cartbar" data-pr-open hidden></button>
      <div class="pr-scrim" data-pr-close hidden></div>
    </div>`;
  container.oninput = onInput;
  container.onclick = onClick;
  container.onkeydown = onKey;
  await loadCatalog();
  renderCart();
  // Phones: don't pop the keyboard over the catalogue on arrival
  if (window.matchMedia('(min-width: 768px)').matches) setTimeout(() => container.querySelector('[data-pr-search]')?.focus({ preventScroll: true }), 50);
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

async function loadCatalog() {
  const sid = encodeURIComponent(S.storeId);
  const [inv, svc, rooms, groom] = await Promise.allSettled([
    apiFetch(`/api/inventory?store_id=${sid}`),
    apiFetch(`/api/service-items?store_id=${sid}`),
    S.biz === 'hotel' ? apiFetch(`/api/hotel/rooms?store_id=${sid}`) : Promise.resolve(null),
    S.biz === 'grooming' ? import('./grooming.js') : Promise.resolve(null),
  ]);
  const rows = r => (r.status === 'fulfilled' && Array.isArray(r.value?.data) ? r.value.data : []);
  const services = rows(svc).filter(s => s.is_active !== false).map(s => ({
    kind: 'service', id: s.id, name: s.name, price: Number(s.price) || 0, stock: Infinity, cat: s.category || 'service', unit: s.unit || '', code: [], photo: '',
  }));
  const products = rows(inv).map(p => ({
    kind: 'product', id: p.id, name: p.name, price: Number(p.sell_price ?? p.price) || 0, stock: Number(p.stock ?? p.stock_qty ?? 0),
    cat: p.category || 'other', unit: '', code: [p.sku, p.barcode].filter(Boolean).map(String), photo: p.photo_url || '',
  }));
  const presets = [];
  // Hotel: one item per room type and nightly rate, so a stay is "room × nights"
  const seenRooms = new Set();
  for (const r of rows(rooms)) {
    const price = Number(r.price_per_night) || 0;
    const type = r.room_type || r.type || 'standard';
    const id = `room-${type}-${price}`;
    if (!price || seenRooms.has(id)) continue;
    seenRooms.add(id);
    presets.push({ kind: 'preset', id, name: T().room(ROOM_LABEL[type] || type), price, stock: Infinity, cat: 'room', unit: 'คืน', code: [], photo: '' });
  }
  // Grooming: the shop's grooming menu, unless it already keeps grooming prices as service items
  const menu = groom.status === 'fulfilled' && groom.value?.SERVICES;
  if (menu && !services.some(s => s.cat === 'grooming')) {
    for (const g of menu) presets.push({ kind: 'preset', id: `groom-${g.id}`, name: g.name, price: g.price, stock: Infinity, cat: 'grooming', unit: '', code: [], photo: '' });
  }
  // Shops lead with products; service businesses lead with their services
  const all = S.biz === 'shop' ? [...products, ...services, ...presets] : [...presets, ...services, ...products];
  const order = CAT_ORDER[S.biz] || CAT_ORDER.shop;
  const rank = c => { const i = order.indexOf(c); return i === -1 ? order.length : i; };
  S.catalog = all
    .map((c, i) => ({ ...c, key: `${c.kind}:${c.id}`, i }))
    .sort((a, b) => rank(a.cat) - rank(b.cat) || a.i - b.i);
  S.loaded = true;
  if (S.cat !== 'all' && !S.catalog.some(c => c.cat === S.cat)) S.cat = 'all';
  renderCats(); renderGrid();
}

function visible() {
  const q = S.query.trim().toLocaleLowerCase();
  return S.catalog.filter(c => (S.cat === 'all' || c.cat === S.cat) && (!q || c.name.toLocaleLowerCase().includes(q) || c.code.some(x => x.toLowerCase() === q)));
}

function renderCats() {
  const cats = ['all', ...new Set(S.catalog.map(c => c.cat))];
  S.container.querySelector('[data-pr-cats]').innerHTML = cats.length > 2 ? cats.map(c =>
    `<button type="button" data-pr-cat="${esc(c)}" class="${S.cat === c ? 'is-on' : ''}" aria-pressed="${S.cat === c}">${esc(c === 'all' ? T().all : catLabel(c))}</button>`).join('') : '';
}

function renderGrid() {
  const t = T();
  const list = visible();
  const inCart = key => S.cart.find(l => l.key === key)?.qty || 0;
  const grid = S.container.querySelector('[data-pr-grid]');
  if (!list.length) {
    const empty = S.catalog.length ? t.notFound : S.biz === 'shop' ? t.emptyShop : t.emptySvc;
    const seed = !S.catalog.length && S.biz === 'vet' ? `<button type="button" class="pr-empty__btn" data-pr-seed>${esc(t.seed)}</button>` : '';
    grid.innerHTML = `<div class="pr-empty"><p>${esc(empty)}</p>${seed}</div>`;
    return;
  }
  grid.innerHTML = list.map(c => {
    const isProduct = c.kind === 'product';
    const out = isProduct && c.stock <= 0;
    const low = isProduct && c.stock > 0 && c.stock <= 5;
    const qty = inCart(c.key);
    const unit = c.unit && c.unit !== 'ครั้ง' ? `<small>/${esc(unitLabel(c.unit))}</small>` : '';
    const art = c.photo ? `<img src="${esc(c.photo)}" alt="" loading="lazy">` : icon(CAT_ICON[c.cat] || (isProduct ? 'box' : 'paw'), 'w-5 h-5');
    const tag = isProduct ? (out ? `<i class="is-out">${esc(t.out)}</i>` : `<i class="${low ? 'is-low' : ''}">${esc(t.left(c.stock))}</i>`) : '';
    return `
      <button type="button" class="pr-item ${isProduct ? 'is-product' : 'is-svc'} ${qty ? 'is-in' : ''}" data-pr-add="${esc(c.key)}" ${out ? 'disabled' : ''}>
        <span class="pr-item__art ${c.photo ? 'has-photo' : ''}">${art}</span>
        <span class="pr-item__name">${esc(c.name)}</span>
        <span class="pr-item__foot"><b>${baht(c.price)}${unit}</b>${tag}</span>
        ${qty ? `<span class="pr-item__qty">${qty}</span>` : ''}
      </button>`;
  }).join('');
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

const totals = () => {
  const sub = r2(S.cart.reduce((s, l) => s + l.qty * l.price, 0));
  const disc = Math.min(Math.max(r2(S.discount), 0), sub);
  const vat = r2((sub - disc) * S.vat / 100);
  return { sub, disc, vat, total: r2(sub - disc + vat), count: S.cart.reduce((s, l) => s + l.qty, 0) };
};

function renderCart() {
  const t = T();
  const sum = totals();
  const change = S.method === 'cash' && S.received !== '' ? r2(Number(S.received) - sum.total) : null;
  const quick = [...new Set([sum.total, Math.ceil(sum.total / 100) * 100, Math.ceil(sum.total / 500) * 500, Math.ceil(sum.total / 1000) * 1000])].filter(v => v > 0).slice(0, 4);
  const cart = S.container.querySelector('[data-pr-cart]');
  cart.classList.toggle('is-open', S.sheet);
  cart.innerHTML = `
    <div class="pr-cart__head">
      <b>${esc(t.cart)}</b><span>${esc(t.items(sum.count))}</span>
      ${S.cart.length ? `<button type="button" class="pr-link" data-pr-clear>${esc(t.clear)}</button>` : ''}
      <button type="button" class="icon-btn pr-cart__x" data-pr-close aria-label="${esc(t.closeCart)}">${icon('times', 'w-5 h-5')}</button>
    </div>
    <div class="pr-lines">
      ${S.cart.length ? S.cart.map((l, i) => `
        <div class="pr-line">
          <div class="pr-line__main"><span>${esc(l.name)}</span><small>${baht(l.price)}${l.unit && l.unit !== 'ครั้ง' ? ` / ${esc(unitLabel(l.unit))}` : ''}</small></div>
          <div class="pr-step" role="group" aria-label="${esc(t.qtyOf(l.name))}">
            <button type="button" data-pr-dec="${i}" aria-label="${esc(t.less)}">−</button><b>${l.qty}</b><button type="button" data-pr-inc="${i}" aria-label="${esc(t.more)}">+</button>
          </div>
          <b class="pr-line__sum">${baht(l.qty * l.price)}</b>
        </div>`).join('') : `<div class="pr-empty is-cart">${esc(t.tapToAdd)}</div>`}
    </div>
    <div class="pr-cart__foot">
      ${S.cart.length ? `<label class="pr-customer">${icon('user', 'w-4 h-4')}<input type="text" maxlength="120" value="${esc(S.customer)}" placeholder="${esc(t.customer)}" aria-label="${esc(t.customer)}" data-pr-customer autocomplete="off"></label>` : ''}
      <div class="pr-adjust">
        <label>${esc(t.discount)}<input type="number" min="0" step="any" inputmode="decimal" value="${S.discount || ''}" placeholder="0" data-pr-discount></label>
        <div class="pr-seg"><button type="button" data-pr-vat="0" class="${S.vat === 0 ? 'is-on' : ''}">${esc(t.noVat)}</button><button type="button" data-pr-vat="7" class="${S.vat === 7 ? 'is-on' : ''}">VAT 7%</button></div>
      </div>
      <dl class="pr-sum">
        <div><dt>${esc(t.subtotal)}</dt><dd>${baht(sum.sub)}</dd></div>
        ${sum.disc ? `<div><dt>${esc(t.discount)}</dt><dd>−${baht(sum.disc)}</dd></div>` : ''}
        ${S.vat ? `<div><dt>VAT 7%</dt><dd>${baht(sum.vat)}</dd></div>` : ''}
        <div class="is-total"><dt>${esc(t.due)}</dt><dd>${baht(sum.total)}</dd></div>
      </dl>
      <div class="pr-methods">${METHODS.map(([k, ic]) => `<button type="button" data-pr-method="${k}" class="${S.method === k ? 'is-on' : ''}" aria-pressed="${S.method === k}">${icon(ic, 'w-4 h-4')}${esc(t[k])}</button>`).join('')}</div>
      ${S.method === 'cash' && sum.total > 0 ? `
        <div class="pr-cash">
          <div class="pr-quick">${quick.map(v => `<button type="button" data-pr-received="${v}">${v === sum.total ? esc(t.exact) : baht(v)}</button>`).join('')}</div>
          <label>${esc(t.received)}<input type="number" min="0" step="any" inputmode="decimal" value="${S.received}" data-pr-cash placeholder="0"></label>
          <p class="pr-change ${change !== null && change < 0 ? 'is-bad' : ''}" aria-live="polite">${change === null ? '' : esc(change < 0 ? t.short(baht(-change)) : t.change(baht(change)))}</p>
        </div>` : ''}
      <button type="button" class="pr-pay" data-pr-pay ${!S.cart.length || S.busy || (change !== null && change < 0) ? 'disabled' : ''}>${esc(S.busy ? t.saving : t.pay(baht(sum.total)))}</button>
    </div>`;
  const bar = S.container.querySelector('[data-pr-open]');
  bar.hidden = !S.cart.length;
  bar.innerHTML = `${icon('receipt', 'w-5 h-5')}<span>${esc(t.items(sum.count))}</span><b>${baht(sum.total)}</b>${icon('chevron-right', 'w-4 h-4')}`;
  S.container.querySelector('[data-pr-close].pr-scrim').hidden = !S.sheet;
}

function addLine(item) {
  const line = S.cart.find(l => l.key === item.key);
  if (item.kind === 'product' && (line?.qty || 0) >= item.stock) { showToast(T().onlyLeft(item.name, item.stock), 'error'); return; }
  if (line) line.qty += 1;
  else S.cart.push({ key: item.key, kind: item.kind, id: item.id, name: item.name, price: item.price, unit: item.unit || '', qty: 1 });
  navigator.vibrate?.(8);
  renderGrid(); renderCart();
}

function add(key) {
  const item = S.catalog.find(c => c.key === key) || S.cart.find(l => l.key === key);
  if (item) addLine(item);
}

// ─── Custom line (anything not in the catalogue) ─────────────────────────────

function openCustom() {
  const t = T();
  const wrap = document.createElement('div');
  wrap.className = 'pr-done';
  wrap.innerHTML = `
    <form class="pr-done__card pr-form" role="dialog" aria-modal="true" aria-labelledby="pr-custom-title" novalidate>
      <b id="pr-custom-title">${esc(t.customTitle)}</b>
      <label>${esc(t.name)}<input name="name" type="text" maxlength="200" required autocomplete="off"></label>
      <div class="pr-form__row">
        <label>${esc(t.price)}<input name="price" type="number" min="0" step="any" inputmode="decimal" placeholder="0" required></label>
        <label>${esc(t.qty)}<input name="qty" type="number" min="1" step="1" inputmode="numeric" value="1" required></label>
      </div>
      <div class="pr-done__actions">
        <button type="button" data-cancel>${esc(t.cancel)}</button>
        <button type="submit" class="is-primary">${esc(t.add)}</button>
      </div>
    </form>`;
  document.body.appendChild(wrap);
  const form = wrap.querySelector('form');
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onEsc); };
  const onEsc = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onEsc);
  wrap.onclick = e => { if (e.target === wrap || e.target.closest('[data-cancel]')) close(); };
  // form.name is the form's own name attribute, so read the inputs through form.elements
  const field = n => form.elements.namedItem(n);
  form.onsubmit = e => {
    e.preventDefault();
    const name = field('name').value.trim();
    const price = r2(field('price').value);
    const qty = Math.max(1, Math.round(Number(field('qty').value) || 1));
    if (!name) { showToast(t.needName, 'error'); field('name').focus(); return; }
    if (!(price >= 0)) { field('price').focus(); return; }
    const key = `custom:${Date.now()}`;
    S.cart.push({ key, kind: 'custom', id: key, name, price, unit: '', qty });
    close();
    renderGrid(); renderCart();
  };
  field('name').focus();
}

async function seedServices() {
  const res = await apiFetch('/api/service-items/seed', { method: 'POST', body: JSON.stringify({ store_id: S.storeId }) });
  if (res?.success) { showToast(T().seeded(res.inserted || 0)); await loadCatalog(); }
  else showToast(res?.error || T().payFailed, 'error');
}

// ─── Events ───────────────────────────────────────────────────────────────────

function onKey(e) {
  // Barcode scanners type the code and press Enter
  if (e.key !== 'Enter' || !e.target.matches('[data-pr-search]')) return;
  const code = e.target.value.trim();
  if (!code) return;
  const hit = S.catalog.find(c => c.code.some(x => x.toLowerCase() === code.toLowerCase())) || (visible().length === 1 ? visible()[0] : null);
  if (hit) { addLine(hit); e.target.value = ''; S.query = ''; renderGrid(); }
  else showToast(T().noCode(code), 'error');
}

function onInput(e) {
  const el = e.target;
  if (el.matches('[data-pr-search]')) { S.query = el.value; renderGrid(); return; }
  if (el.matches('[data-pr-customer]')) { S.customer = el.value; return; }
  if (el.matches('[data-pr-discount]')) S.discount = Number(el.value) || 0;
  else if (el.matches('[data-pr-cash]')) S.received = el.value;
  else return;
  const key = el.matches('[data-pr-discount]') ? '[data-pr-discount]' : '[data-pr-cash]';
  const pos = el.selectionStart;
  renderCart();
  const next = S.container.querySelector(key);
  if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch { /* number input */ } }
}

async function onClick(e) {
  const q = s => e.target.closest(s);
  let b;
  if ((b = q('[data-pr-add]'))) return add(b.dataset.prAdd);
  if ((b = q('[data-pr-cat]'))) { S.cat = b.dataset.prCat; renderCats(); return renderGrid(); }
  if (q('[data-pr-custom]')) return openCustom();
  if ((b = q('[data-pr-seed]'))) { b.disabled = true; return seedServices(); }
  if ((b = q('[data-pr-inc]'))) { const l = S.cart[b.dataset.prInc]; return add(l.key); }
  if ((b = q('[data-pr-dec]'))) { const i = Number(b.dataset.prDec); S.cart[i].qty -= 1; if (S.cart[i].qty <= 0) S.cart.splice(i, 1); renderGrid(); return renderCart(); }
  if (q('[data-pr-clear]')) { S.cart = []; S.discount = 0; S.received = ''; S.customer = ''; renderGrid(); return renderCart(); }
  if ((b = q('[data-pr-vat]'))) { S.vat = Number(b.dataset.prVat); return renderCart(); }
  if ((b = q('[data-pr-method]'))) { S.method = b.dataset.prMethod; S.received = ''; return renderCart(); }
  if ((b = q('[data-pr-received]'))) { S.received = b.dataset.prReceived; return renderCart(); }
  if (q('[data-pr-open]')) { S.sheet = true; return renderCart(); }
  if (q('[data-pr-close]')) { S.sheet = false; return renderCart(); }
  if (q('[data-pr-pay]')) return pay();
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

async function pay() {
  if (!S.cart.length || S.busy) return;
  const t = T();
  const sum = totals();
  S.busy = true; renderCart();
  const lines = S.cart.map(l => ({
    name: l.name, qty: l.qty, unit_price: l.price,
    ...(l.kind === 'product' ? { product_id: l.id } : l.kind === 'service' ? { service_item_id: l.id } : {}),
  }));
  const method = S.method;
  const ownerName = S.customer.trim() || t.walkIn;
  let result = null;
  let error = null;

  // 1) Cashier flow: atomic payment + receipt number + FEFO stock deduction.
  //    Check the drawer first so a closed drawer never leaves a half-made bill behind.
  const drawer = await apiFetch(`/api/cashier/session?store_id=${encodeURIComponent(S.storeId)}`);
  if (drawer?.success && !drawer.data) {
    S.busy = false; renderCart();
    showToast(t.drawerClosed, 'error');
    return;
  }
  const open = await apiFetch('/api/cashier/invoices', { method: 'POST', body: JSON.stringify({ store_id: S.storeId, line_items: lines, pet_name: null, owner_name: ownerName }) });
  if (open?.success) {
    const settle = await apiFetch(`/api/cashier/invoices/${open.data.id}/settle`, { method: 'POST', body: JSON.stringify({ discount: sum.disc, vat_rate: S.vat, payments: [{ method, amount: sum.total }] }) });
    if (settle?.success) result = settle.data;
    else {
      error = settle?.code === 'drawer_closed' ? t.drawerClosed : (settle?.error || t.payFailed);
      // Nothing was charged: cancel the bill we just opened so it doesn't wait at the cashier
      await apiFetch(`/api/cashier/invoices/${open.data.id}/return`, { method: 'POST', body: '{}' });
    }
  } else if (open?.code === 'cashier_not_ready') {
    // 2) Older databases: legacy POS checkout
    const res = await apiFetch('/api/pos/checkout', { method: 'POST', body: JSON.stringify({ store_id: S.storeId, line_items: lines, discount: sum.disc, vat_rate: S.vat, payment_method: method === 'qr' ? 'promptpay' : method, owner_name: ownerName }) });
    if (res?.success) result = { ...res.data.invoice, invoice_number: res.data.invoice_number, total: res.data.total };
    else error = res?.error || t.payFailed;
  } else {
    error = open?.error || t.payFailed;
  }

  S.busy = false;
  if (!result) { renderCart(); showToast(`${error} · ${t.notSaved}`, 'error'); return; }
  const change = method === 'cash' && S.received !== '' ? r2(Number(S.received) - sum.total) : 0;
  // Frequently sold services float to the top next time (service items are ordered by use_count)
  for (const l of S.cart) if (l.kind === 'service') apiFetch(`/api/service-items/${encodeURIComponent(l.id)}/use`, { method: 'POST', body: '{}' }).catch(() => {});
  S.cart = []; S.discount = 0; S.received = ''; S.customer = ''; S.sheet = false;
  renderGrid(); renderCart();
  showDone(result, change);
  loadCatalog(); // stock may have changed
}

function showDone(inv, change) {
  const t = T();
  const wrap = document.createElement('div');
  wrap.className = 'pr-done';
  wrap.innerHTML = `
    <div class="pr-done__card" role="dialog" aria-modal="true" aria-labelledby="pr-done-title">
      <span class="pr-done__ic">${icon('check-circle', 'w-8 h-8')}</span>
      <b id="pr-done-title">${esc(t.paid)}</b>
      <span>${esc(inv.invoice_number || '')} · ${baht(inv.total)}</span>
      ${change > 0 ? `<strong>${esc(t.changeDone(baht(change)))}</strong>` : ''}
      <div class="pr-done__actions">
        ${inv.id ? `<button type="button" data-print="slip">${icon('printer', 'w-4 h-4')}${esc(t.receipt)}</button>` : ''}
        <button type="button" data-next class="is-primary">${esc(t.next)}</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); S.container.querySelector('[data-pr-search]')?.focus({ preventScroll: true }); };
  wrap.onclick = e => {
    if (e.target === wrap || e.target.closest('[data-next]')) return close();
    if (e.target.closest('[data-print]')) window.open(`/receipt?id=${encodeURIComponent(inv.id)}&format=slip`, '_blank');
  };
  wrap.querySelector('[data-next]').focus();
}
