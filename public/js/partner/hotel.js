// Pet Hotel: today's desk (arrivals, departures, in-house, App requests), room availability calendar,
// all bookings and room setup. Each pet has its own booking + care sheet; rooms can hold several pets (max_pets).
// API: server/routes/hotel.js. Styles: .st-* in src/css/input.css.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { openSheet } from './sheet.js';
import {
  T, addStrings, esc, baht, todayBkk, addDays, nightsBetween, fmtDay, speciesEmoji, speciesLabel,
  petPicker, petFacts, askReason, apiError,
} from './stay-kit.js';

addStrings({
  title: ['โรงแรมสัตว์เลี้ยง', 'Pet hotel', '宠物酒店', 'ペットホテル', '펫호텔'],
  sub: ['จองห้อง เช็กอิน–เอาต์ และดูแลน้องที่เข้าพัก', 'Bookings, check-in/out and care for every guest', '预订、入住/退房与住宿照护', '予約・チェックイン/アウト・お世話', '예약, 체크인·아웃, 투숙 케어'],
  newBooking: ['จองห้อง', 'New booking', '新预订', '予約する', '예약하기'],
  tabToday: ['วันนี้', 'Today', '今天', '今日', '오늘'], tabCal: ['ห้องว่าง', 'Availability', '空房', '空室', '빈 방'],
  tabBookings: ['การจองทั้งหมด', 'All bookings', '全部预订', 'すべての予約', '전체 예약'], tabRooms: ['ห้องพัก', 'Rooms', '房间', '部屋', '객실'],
  sTonight: ['เข้าพักคืนนี้', 'Staying tonight', '今晚入住', '今夜の宿泊', '오늘 밤 투숙'], sArrive: ['มาถึงวันนี้', 'Arriving', '今日到达', '本日到着', '오늘 도착'],
  sDepart: ['กลับบ้านวันนี้', 'Going home', '今日离店', '本日お帰り', '오늘 퇴실'], sClean: ['รอทำความสะอาด', 'To clean', '待清洁', '清掃待ち', '청소 대기'],
  ofCapacity: ['จาก {n} ที่', 'of {n} places', '共 {n} 位', '{n} 枠中', '{n}자리 중'],
  requests: ['คำขอจองจากแอป', 'Requests from the app', '应用预订请求', 'アプリからの予約リクエスト', '앱 예약 요청'],
  requestsHint: ['เลือกห้องให้ แล้วลูกค้าจะได้รับแจ้งว่ายืนยันแล้ว', 'Pick a room and the customer is told it is confirmed', '分配房间后顾客会收到确认', '部屋を割り当てるとお客様に確定が通知されます', '방을 배정하면 고객에게 확정 알림이 가요'],
  assignRoom: ['จัดห้อง', 'Assign room', '分配房间', '部屋を割り当て', '방 배정'],
  arrivals: ['มาถึงวันนี้', 'Arriving today', '今日到达', '本日到着', '오늘 도착'], departures: ['กลับบ้านวันนี้', 'Going home today', '今日离店', '本日お帰り', '오늘 퇴실'],
  inHouse: ['กำลังเข้าพัก', 'Staying now', '在住', '宿泊中', '투숙 중'], upcoming: ['จองล่วงหน้า', 'Coming up', '即将到来', '今後の予約', '예정'],
  nothingToday: ['วันนี้ยังไม่มีรายการ', 'Nothing scheduled today', '今天没有安排', '本日の予定はありません', '오늘 일정이 없어요'],
  checkIn: ['เช็กอิน', 'Check in', '入住', 'チェックイン', '체크인'], checkOut: ['เช็กเอาต์', 'Check out', '退房', 'チェックアウト', '체크아웃'],
  checkInNow: ['เช็กอินเลย (มาถึงแล้ว)', 'Check in now (arrived)', '立即入住（已到达）', '今すぐチェックイン', '지금 체크인'],
  details: ['รายละเอียด', 'Details', '详情', '詳細', '상세'], careLog: ['บันทึกการดูแล', 'Care log', '照护记录', 'お世話記録', '케어 기록'],
  overdue: ['เลยกำหนดกลับ', 'Past check-out', '已超过退房日', 'チェックアウト超過', '퇴실일 지남'],
  room: ['ห้อง', 'Room', '房间', '部屋', '객실'], nights: ['{n} คืน', '{n} nights', '{n} 晚', '{n} 泊', '{n}박'],
  checkInDate: ['วันเข้าพัก', 'Check-in', '入住日期', 'チェックイン日', '체크인 날짜'], checkOutDate: ['วันกลับ', 'Check-out', '退房日期', 'チェックアウト日', '체크아웃 날짜'],
  stay: ['ช่วงเข้าพัก', 'Stay', '住宿期间', '宿泊期間', '숙박 기간'], chooseRoom: ['เลือกห้อง', 'Choose a room', '选择房间', '部屋を選ぶ', '방 선택'],
  noFreeRoom: ['ไม่มีห้องว่างครบทุกคืนในช่วงนี้ ลองเปลี่ยนวัน', 'No room is free for every night. Try other dates', '此期间没有可用房间', 'この期間に空室がありません', '이 기간에 빈 방이 없어요'],
  perNight: ['/คืน', '/night', '/晚', '/泊', '/박'], upTo: ['รับได้ {n} ตัว', 'Up to {n} pets', '最多 {n} 只', '最大 {n} 匹', '최대 {n}마리'],
  addPet: ['+ เพิ่มน้องอีกตัว (เจ้าของเดียวกัน)', '+ Add another pet (same owner)', '+ 再添加一只', '+ もう1匹追加', '+ 한 마리 더 추가'],
  petN: ['น้องตัวที่ {n}', 'Pet {n}', '宠物 {n}', 'ペット {n}', '반려동물 {n}'],
  careSheet: ['ข้อมูลการดูแล', 'Care sheet', '照护信息', 'お世話シート', '케어 정보'],
  feeding: ['อาหารและเวลาให้อาหาร', 'Food & feeding times', '饮食与喂食时间', '食事と時間', '식사와 시간'],
  feedTime: ['เวลา', 'Time', '时间', '時間', '시간'], food: ['อาหาร', 'Food', '食物', 'フード', '음식'], amount: ['ปริมาณ', 'Amount', '份量', '量', '양'],
  addFeed: ['+ เพิ่มมื้อ', '+ Add meal', '+ 添加餐次', '+ 食事を追加', '+ 식사 추가'],
  medications: ['ยาที่ต้องให้ (ชื่อยา / ขนาด / เวลา)', 'Medication (name / dose / time)', '用药（名称/剂量/时间）', '投薬（薬名・量・時間）', '투약 (약 이름/용량/시간)'],
  temperament: ['นิสัย / ข้อควรระวัง', 'Temperament / cautions', '性格 / 注意事项', '性格・注意点', '성격 / 주의사항'],
  healthNotes: ['สุขภาพ โรคประจำตัว', 'Health conditions', '健康状况', '健康状態・持病', '건강 / 지병'],
  vaccinesChecked: ['ตรวจสมุดวัคซีนแล้ว', 'Vaccine record checked', '已检查疫苗本', 'ワクチン記録を確認済み', '예방접종 수첩 확인'],
  vaccineExpiry: ['วัคซีนหมดอายุ', 'Vaccines valid until', '疫苗有效期至', 'ワクチン有効期限', '백신 유효기간'],
  fleaChecked: ['ตรวจเห็บหมัดแล้ว', 'Checked for fleas/ticks', '已检查跳蚤蜱虫', 'ノミ・ダニ確認済み', '벼룩·진드기 확인'],
  canShare: ['อยู่ห้องร่วมกับตัวอื่นได้', 'Can share a room', '可同住', '同室可', '합사 가능'],
  photoUpdates: ['ส่งรูปอัปเดตให้เจ้าของ', 'Send photo updates to owner', '给主人发照片', '飼い主に写真を送る', '보호자에게 사진 전송'],
  vetName: ['สัตวแพทย์ประจำตัว', 'Regular vet', '常用兽医', 'かかりつけ獣医', '주치의'], vetPhone: ['เบอร์สัตวแพทย์', 'Vet phone', '兽医电话', '獣医の電話', '수의사 전화'],
  emergencyName: ['ผู้ติดต่อฉุกเฉิน', 'Emergency contact', '紧急联系人', '緊急連絡先', '비상 연락처'], emergencyPhone: ['เบอร์ฉุกเฉิน', 'Emergency phone', '紧急电话', '緊急電話', '비상 전화'],
  belongings: ['ของที่นำมาฝาก', 'Belongings', '随身物品', '持ち物', '소지품'], item: ['รายการ', 'Item', '物品', '品目', '물품'], qty: ['จำนวน', 'Qty', '数量', '数', '수량'],
  addItem: ['+ เพิ่มของ', '+ Add item', '+ 添加物品', '+ 追加', '+ 추가'],
  special: ['คำขอพิเศษ', 'Special requests', '特殊要求', '特別なご要望', '특별 요청'], deposit: ['มัดจำ', 'Deposit', '定金', 'デポジット', '보증금'],
  addOns: ['บริการเสริม', 'Add-on services', '附加服务', 'オプション', '추가 서비스'],
  total: ['รวม', 'Total', '合计', '合計', '합계'], balance: ['คงเหลือชำระ', 'Balance due', '待付余额', '残金', '잔액'],
  reserve: ['ยืนยันการจอง', 'Confirm booking', '确认预订', '予約を確定', '예약 확정'], bookedN: ['จองแล้ว {n} รายการ', '{n} booking(s) saved', '已保存 {n} 个预订', '{n} 件予約しました', '{n}건 예약했어요'],
  room_full: ['ห้องนี้เต็มในบางคืน เลือกห้องอื่นหรือเปลี่ยนวัน', 'That room is full on some nights. Pick another room or dates', '该房间部分日期已满', 'その部屋は一部の日程で満室です', '일부 날짜에 방이 가득 찼어요'],
  room_maintenance: ['ห้องนี้ปิดซ่อมบำรุง', 'Room is under maintenance', '房间维修中', 'メンテナンス中', '점검 중인 방'],
  invalid_dates: ['วันกลับต้องหลังวันเข้าพัก', 'Check-out must be after check-in', '退房必须晚于入住', 'チェックアウトはチェックイン以降', '체크아웃은 체크인 이후여야 해요'],
  stay_too_long: ['จองได้ไม่เกิน 90 คืน', 'Up to 90 nights', '最多 90 晚', '最大 90 泊', '최대 90박'],
  too_early: ['ยังไม่ถึงวันเข้าพัก', 'Check-in date has not arrived yet', '还未到入住日期', 'まだチェックイン日ではありません', '아직 체크인 날짜가 아니에요'],
  already_assigned: ['คำขอนี้จัดห้องไปแล้ว', 'This request already has a room', '该请求已分配房间', 'この予約は割り当て済みです', '이미 방이 배정된 요청이에요'],
  room_in_use: ['ห้องนี้ยังมีการจองอยู่ ลบไม่ได้', 'Room has bookings, cannot delete', '房间有预订，无法删除', '予約があるため削除できません', '예약이 있어 삭제할 수 없어요'],
  duplicate_room: ['มีเลขห้องนี้แล้ว', 'Room number already exists', '房号已存在', 'その部屋番号は既にあります', '이미 있는 방 번호예요'],
  pet_required: ['กรอกชื่อน้องก่อน', 'Enter the pet name', '请输入宠物名', 'ペット名を入力', '반려동물 이름을 입력하세요'],
  st_reserved: ['จองแล้ว', 'Reserved', '已预订', '予約済み', '예약됨'], st_checked_in: ['เข้าพักอยู่', 'Staying', '在住', '宿泊中', '투숙 중'],
  st_checked_out: ['กลับบ้านแล้ว', 'Checked out', '已退房', 'チェックアウト済み', '퇴실'], st_cancelled: ['ยกเลิก', 'Cancelled', '已取消', 'キャンセル', '취소'], st_no_show: ['ไม่มา', 'No-show', '未到', '無断キャンセル', '노쇼'],
  noShow: ['ไม่มาตามนัด', 'Mark no-show', '标记未到', '来店なし', '노쇼 처리'], cancelBooking: ['ยกเลิกการจอง', 'Cancel booking', '取消预订', '予約をキャンセル', '예약 취소'],
  moveStay: ['ย้ายห้อง / เปลี่ยนวัน', 'Change room / dates', '更换房间/日期', '部屋・日程変更', '방/날짜 변경'],
  cancelPresets: [['ลูกค้าขอยกเลิก', 'น้องไม่สบาย', 'ติดต่อลูกค้าไม่ได้'], ['Customer cancelled', 'Pet is unwell', 'Could not reach customer'], ['顾客取消', '宠物生病', '联系不上顾客'], ['お客様都合', 'ペットの体調不良', '連絡がとれない'], ['고객 취소', '반려동물 아픔', '연락 불가']],
  addNote: ['เพิ่มบันทึก เช่น กินหมด เดินเล่น 20 นาที', 'Add a note, e.g. ate everything, walked 20 min', '添加记录', '記録を追加', '기록 추가'],
  noNotes: ['ยังไม่มีบันทึก', 'No notes yet', '暂无记录', 'まだ記録はありません', '아직 기록이 없어요'],
  bill: ['สรุปค่าใช้จ่าย', 'Bill', '费用汇总', 'お会計', '정산'], payAtCashier: ['เก็บเงินที่แคชเชียร์หรือ POS', 'Collect payment at the cashier or POS', '请在收银台收款', 'レジで精算してください', '계산대에서 결제하세요'],
  checkedOutMsg: ['เช็กเอาต์แล้ว ห้องเปลี่ยนเป็นรอทำความสะอาด', 'Checked out. Room set to cleaning', '已退房，房间待清洁', 'チェックアウトしました', '체크아웃했어요'],
  addRoom: ['+ เพิ่มห้อง', '+ Add room', '+ 添加房间', '+ 部屋を追加', '+ 객실 추가'], noRooms: ['ยังไม่มีห้องพัก เพิ่มห้องแรกเพื่อเริ่มรับจอง', 'No rooms yet. Add your first room to start taking bookings', '还没有房间', 'まだ部屋がありません', '아직 객실이 없어요'],
  roomNumber: ['เลขห้อง / ชื่อห้อง', 'Room number / name', '房号/名称', '部屋番号・名前', '방 번호/이름'], roomType: ['ประเภท', 'Type', '类型', 'タイプ', '유형'],
  rate: ['ราคาต่อคืน', 'Price per night', '每晚价格', '1泊料金', '1박 요금'], maxPets: ['รับได้สูงสุด (ตัว)', 'Max pets', '最多宠物数', '最大頭数', '최대 마리'], floor: ['ชั้น', 'Floor', '楼层', '階', '층'],
  rt_standard: ['มาตรฐาน', 'Standard', '标准', 'スタンダード', '스탠다드'], rt_deluxe: ['ดีลักซ์', 'Deluxe', '豪华', 'デラックス', '디럭스'], rt_suite: ['สวีท', 'Suite', '套房', 'スイート', '스위트'],
  rt_cat: ['ห้องแมว', 'Cat room', '猫房', '猫部屋', '고양이 방'], rt_small: ['ห้องเล็ก', 'Small', '小房', 'スモール', '소형'], rt_large: ['ห้องใหญ่', 'Large', '大房', 'ラージ', '대형'], rt_vip: ['VIP', 'VIP', 'VIP', 'VIP', 'VIP'],
  rs_available: ['ว่าง', 'Ready', '可用', '空室', '이용 가능'], rs_occupied: ['มีผู้เข้าพัก', 'Occupied', '有入住', '使用中', '사용 중'], rs_cleaning: ['รอทำความสะอาด', 'Cleaning', '待清洁', '清掃中', '청소 중'], rs_maintenance: ['ปิดซ่อม', 'Maintenance', '维修', 'メンテナンス', '점검'],
  markClean: ['ทำความสะอาดเสร็จ', 'Mark clean', '清洁完成', '清掃完了', '청소 완료'], markMaint: ['ปิดซ่อม', 'Close for repair', '维修', 'メンテナンス', '점검'], reopen: ['เปิดใช้งาน', 'Reopen', '重新开放', '再開', '다시 열기'],
  deleteRoom: ['ลบห้อง', 'Delete room', '删除房间', '部屋を削除', '객실 삭제'], editRoom: ['แก้ไขห้อง', 'Edit room', '编辑房间', '部屋を編集', '객실 수정'],
  prev: ['ก่อนหน้า', 'Previous', '上一页', '前へ', '이전'], next: ['ถัดไป', 'Next', '下一页', '次へ', '다음'], thisWeek: ['วันนี้', 'Today', '今天', '今日', '오늘'],
  calHint: ['แตะช่องว่างเพื่อจอง แตะชื่อน้องเพื่อดูรายละเอียด', 'Tap an empty cell to book, a name to open it', '点空格预订，点名字查看', '空欄をタップして予約', '빈 칸을 눌러 예약'],
  search: ['ค้นหาชื่อน้อง เจ้าของ เบอร์โทร', 'Search pet, owner, phone', '搜索宠物、主人、电话', 'ペット・飼い主・電話で検索', '반려동물, 보호자, 전화 검색'],
  fActive: ['กำลังใช้งาน', 'Active', '进行中', '進行中', '진행 중'], fDone: ['เสร็จสิ้น', 'Finished', '已结束', '完了', '완료'], fAll: ['ทั้งหมด', 'All', '全部', 'すべて', '전체'],
  noBookings: ['ไม่พบการจอง', 'No bookings', '没有预订', '予約はありません', '예약이 없어요'],
  ownerOnly: ['เฉพาะเจ้าของร้านแก้ไขห้องได้', 'Only the owner can edit rooms', '仅店主可编辑房间', 'オーナーのみ編集可能', '점주만 수정할 수 있어요'],
});

let _storeId = null;
let _isOwner = false;
let _tab = 'today';
let _calFrom = null;
let _bookingFilter = 'active';
let _bookingQuery = '';
let _container = null;
let _addOnCatalog = null;

export async function renderHotel(container) {
  _container = container;
  _storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const staffRole = storage.get(STORAGE_KEYS.STAFF_ROLE);
  _isOwner = !staffRole || staffRole === 'owner';
  _calFrom = _calFrom || todayBkk();
  container.innerHTML = `
    <div class="st-page">
      <header class="so-head">
        <div class="min-w-0"><h1 class="so-title">${esc(T('title'))}</h1><p class="so-sub">${esc(T('sub'))}</p></div>
        <button type="button" class="ph-btn is-primary" data-new>${esc(T('newBooking'))}</button>
      </header>
      <nav class="so-tabs" aria-label="${esc(T('title'))}">
        ${[['today', 'tabToday'], ['cal', 'tabCal'], ['bookings', 'tabBookings'], ['rooms', 'tabRooms']].map(([id, k]) => `<button type="button" class="so-tab" data-tab="${id}" aria-pressed="${_tab === id}">${esc(T(k))}</button>`).join('')}
      </nav>
      <div data-view></div>
    </div>`;
  container.querySelector('[data-new]').onclick = () => openBookingSheet({});
  container.querySelectorAll('[data-tab]').forEach(b => {
    b.onclick = () => { _tab = b.dataset.tab; container.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); loadView(); };
  });
  await loadView();
}

const view = () => _container.querySelector('[data-view]');
const refresh = () => loadView();

async function loadView() {
  const el = view();
  el.innerHTML = `<div class="st-skeleton"></div><div class="st-skeleton"></div>`;
  try {
    if (_tab === 'today') await renderToday(el);
    else if (_tab === 'cal') await renderCalendar(el);
    else if (_tab === 'bookings') await renderBookings(el);
    else await renderRooms(el);
  } catch {
    el.innerHTML = `<div class="st-empty"><p>${esc(T('loadFail'))}</p><button type="button" class="ph-btn" data-retry>${esc(T('retry'))}</button></div>`;
    el.querySelector('[data-retry]').onclick = refresh;
  }
}

// ── Today ────────────────────────────────────────────────────────────────────
async function renderToday(el) {
  const res = await apiFetch(`/api/hotel/overview?store_id=${_storeId}`);
  if (!res?.success) throw new Error('load');
  const s = res.stats;
  const pct = s.capacity ? Math.round((s.tonight / s.capacity) * 100) : 0;
  const section = (title, list, render, hint = '') => list.length ? `
    <section class="st-section"><h2 class="st-h2">${esc(title)} <span class="st-count">${list.length}</span></h2>${hint ? `<p class="st-muted st-hint">${esc(hint)}</p>` : ''}
      <div class="st-list">${list.map(render).join('')}</div></section>` : '';

  el.innerHTML = `
    <div class="st-stats">
      <div class="st-stat is-main"><span>${esc(T('sTonight'))}</span><b>${s.tonight}</b><small>${esc(T('ofCapacity', { n: s.capacity }))}</small><i class="st-meter"><i style="width:${Math.min(100, pct)}%"></i></i></div>
      <div class="st-stat"><span>${esc(T('sArrive'))}</span><b>${res.arrivals.length}</b></div>
      <div class="st-stat"><span>${esc(T('sDepart'))}</span><b>${res.departures.length}</b></div>
      <div class="st-stat"><span>${esc(T('sClean'))}</span><b>${s.cleaning}</b></div>
    </div>
    ${!s.rooms ? `<div class="st-empty"><p>${esc(T('noRooms'))}</p>${_isOwner ? `<button type="button" class="ph-btn is-primary" data-add-room>${esc(T('addRoom'))}</button>` : ''}</div>` : ''}
    ${section(T('requests'), res.requests, requestCard, T('requestsHint'))}
    ${section(T('arrivals'), res.arrivals, b => bookingCard(b, 'arrive'))}
    ${section(T('departures'), res.departures, b => bookingCard(b, 'depart'))}
    ${section(T('inHouse'), res.in_house.filter(b => !res.departures.some(d => d.id === b.id)), b => bookingCard(b, 'stay'))}
    ${section(T('upcoming'), res.upcoming.slice(0, 12), b => bookingCard(b, 'future'))}
    ${s.rooms && !res.requests.length && !res.arrivals.length && !res.departures.length && !res.in_house.length && !res.upcoming.length ? `<div class="st-empty"><p>${esc(T('nothingToday'))}</p></div>` : ''}`;

  el.querySelector('[data-add-room]')?.addEventListener('click', () => openRoomSheet());
  bindCards(el, [...res.arrivals, ...res.departures, ...res.in_house, ...res.upcoming], res.requests);
}

function requestCard(a) {
  const nights = a.check_in_date && a.check_out_date ? nightsBetween(a.check_in_date, a.check_out_date) : 0;
  const pet = a.pets || {};
  return `
    <article class="st-card is-request">
      <span class="st-avatar">${speciesEmoji(pet.species)}</span>
      <div class="min-w-0 flex-1">
        <p class="st-strong">${esc(pet.name || a.pet_name)} <span class="st-chip is-app">${esc(T('fromApp'))}</span></p>
        <p class="st-muted">${esc(fmtDay(a.check_in_date))} → ${esc(fmtDay(a.check_out_date))} · ${esc(T('nights', { n: nights }))}${pet.breed ? ` · ${esc(pet.breed)}` : ''}</p>
        ${a.customer_notes ? `<p class="st-note">“${esc(a.customer_notes)}”</p>` : ''}
      </div>
      <button type="button" class="ph-btn is-primary" data-request="${a.id}">${esc(T('assignRoom'))}</button>
    </article>`;
}

function bookingCard(b, mode) {
  const room = b.hotel_rooms?.room_number || '—';
  const nights = nightsBetween(b.check_in_date, b.check_out_date);
  const late = b.status === 'checked_in' && b.check_out_date < todayBkk();
  const action = mode === 'arrive' ? `<button type="button" class="ph-btn is-primary" data-checkin="${b.id}">${esc(T('checkIn'))}</button>`
    : mode === 'depart' ? `<button type="button" class="ph-btn is-primary" data-checkout="${b.id}">${esc(T('checkOut'))}</button>`
    : mode === 'stay' ? `<button type="button" class="ph-btn" data-log="${b.id}">${esc(T('careLog'))}</button>` : '';
  const care = b.care_profile || {};
  return `
    <article class="st-card" data-open="${b.id}" tabindex="0" role="button">
      <span class="st-avatar">${speciesEmoji(b.species)}</span>
      <div class="min-w-0 flex-1">
        <p class="st-strong">${esc(b.pet_name)} <span class="st-room">${esc(T('room'))} ${esc(room)}</span>${b.appointment_id ? ` <span class="st-chip is-app">${esc(T('fromApp'))}</span>` : ''}${late ? ` <span class="st-chip is-bad">${esc(T('overdue'))}</span>` : ''}</p>
        <p class="st-muted">${esc(fmtDay(b.check_in_date))} → ${esc(fmtDay(b.check_out_date))} · ${esc(T('nights', { n: nights }))}${b.owner_name ? ` · ${esc(b.owner_name)}` : ''}</p>
        ${care.medications || care.temperament ? `<p class="st-flags">${care.medications ? `<span class="st-chip is-warn">💊 ${esc(care.medications)}</span>` : ''}${care.temperament ? `<span class="st-chip">${esc(care.temperament)}</span>` : ''}</p>` : ''}
      </div>
      ${action}
    </article>`;
}

function bindCards(el, bookings, requests = []) {
  const byId = Object.fromEntries(bookings.map(b => [b.id, b]));
  el.querySelectorAll('[data-request]').forEach(btn => {
    btn.onclick = () => {
      const a = requests.find(r => r.id === btn.dataset.request);
      const pet = a.pets || {};
      openBookingSheet({
        from: a.check_in_date, to: a.check_out_date, appointmentId: a.id, note: a.customer_notes,
        pets: [{ pet_id: a.pet_id, pet_name: pet.name || a.pet_name, species: pet.species || 'dog', owner_name: '', owner_phone: '', pet }],
      });
    };
  });
  el.querySelectorAll('[data-checkin]').forEach(btn => { btn.onclick = e => { e.stopPropagation(); doCheckIn(btn.dataset.checkin); }; });
  el.querySelectorAll('[data-checkout]').forEach(btn => { btn.onclick = e => { e.stopPropagation(); openCheckout(byId[btn.dataset.checkout]); }; });
  el.querySelectorAll('[data-log]').forEach(btn => { btn.onclick = e => { e.stopPropagation(); openBookingDetail(btn.dataset.log, { focusLog: true }); }; });
  el.querySelectorAll('[data-open]').forEach(card => {
    const open = () => openBookingDetail(card.dataset.open);
    card.onclick = open;
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
}

// ── Availability calendar ────────────────────────────────────────────────────
async function renderCalendar(el) {
  const to = addDays(_calFrom, 13);
  const res = await apiFetch(`/api/hotel/availability?store_id=${_storeId}&from=${_calFrom}&to=${to}`);
  if (!res?.success) throw new Error('load');
  const today = todayBkk();
  if (!res.data.length) {
    el.innerHTML = `<div class="st-empty"><p>${esc(T('noRooms'))}</p>${_isOwner ? `<button type="button" class="ph-btn is-primary" data-add-room>${esc(T('addRoom'))}</button>` : ''}</div>`;
    el.querySelector('[data-add-room]')?.addEventListener('click', () => openRoomSheet());
    return;
  }
  const head = res.dates.map(d => {
    const wd = new Date(`${d}T12:00:00+07:00`).getDay();
    return `<th class="${d === today ? 'is-today' : ''} ${wd === 0 || wd === 6 ? 'is-weekend' : ''}"><span>${esc(fmtDay(d, { weekday: 'short' }))}</span><b>${esc(fmtDay(d, { day: 'numeric' }))}</b></th>`;
  }).join('');
  const rows = res.data.map(r => {
    const cells = res.dates.map(d => {
      const here = r.bookings.filter(b => b.check_in_date <= d && b.check_out_date > d);
      const full = here.length >= r.max_pets;
      if (r.status === 'maintenance') return `<td class="is-maint" title="${esc(T('rs_maintenance'))}"></td>`;
      const names = here.map(b => `<button type="button" class="st-cal-pet is-${b.status}" data-open="${b.id}" title="${esc(`${b.pet_name} · ${b.owner_name || ''}`)}">${b.check_in_date === d || d === res.dates[0] ? esc(b.pet_name) : '&nbsp;'}</button>`).join('');
      return `<td class="${full ? 'is-full' : ''} ${d === today ? 'is-today' : ''}">${names}${!full && d >= today ? `<button type="button" class="st-cal-free" data-book="${r.id}" data-day="${d}" aria-label="${esc(`${T('newBooking')} ${r.room_number} ${d}`)}">+</button>` : ''}</td>`;
    }).join('');
    return `<tr><th class="st-cal-room"><b>${esc(r.room_number)}</b><span>${esc(T(`rt_${r.room_type}`))} · ${esc(T('upTo', { n: r.max_pets }))}</span></th>${cells}</tr>`;
  }).join('');
  el.innerHTML = `
    <div class="st-cal-bar">
      <div class="flex gap-2"><button type="button" class="ph-btn" data-shift="-14" aria-label="${esc(T('prev'))}">‹</button><button type="button" class="ph-btn" data-shift="0">${esc(T('thisWeek'))}</button><button type="button" class="ph-btn" data-shift="14" aria-label="${esc(T('next'))}">›</button></div>
      <p class="st-muted">${esc(fmtDay(_calFrom, { day: 'numeric', month: 'short', year: 'numeric' }))} – ${esc(fmtDay(to, { day: 'numeric', month: 'short', year: 'numeric' }))}</p>
    </div>
    <p class="st-muted st-hint">${esc(T('calHint'))}</p>
    <div class="st-cal-wrap"><table class="st-cal"><thead><tr><th class="st-cal-room"></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  el.querySelectorAll('[data-shift]').forEach(b => { b.onclick = () => { const n = Number(b.dataset.shift); _calFrom = n ? addDays(_calFrom, n) : todayBkk(); loadView(); }; });
  el.querySelectorAll('[data-book]').forEach(b => { b.onclick = () => openBookingSheet({ from: b.dataset.day, to: addDays(b.dataset.day, 1), roomId: b.dataset.book }); });
  el.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => openBookingDetail(b.dataset.open); });
}

// ── All bookings ─────────────────────────────────────────────────────────────
async function renderBookings(el) {
  const statuses = { active: 'reserved,checked_in', done: 'checked_out,cancelled,no_show', all: '' }[_bookingFilter];
  const res = await apiFetch(`/api/hotel/bookings?store_id=${_storeId}${statuses ? `&status=${statuses}` : ''}${_bookingQuery ? `&q=${encodeURIComponent(_bookingQuery)}` : ''}`);
  if (!res?.success) throw new Error('load');
  el.innerHTML = `
    <div class="st-toolbar">
      <input class="cx-search" type="search" data-q value="${esc(_bookingQuery)}" placeholder="${esc(T('search'))}">
      <div class="so-tabs">${[['active', 'fActive'], ['done', 'fDone'], ['all', 'fAll']].map(([id, k]) => `<button type="button" class="so-tab" data-f="${id}" aria-pressed="${_bookingFilter === id}">${esc(T(k))}</button>`).join('')}</div>
    </div>
    <div class="st-list">${res.data.length ? res.data.map(b => `
      <article class="st-card" data-open="${b.id}" tabindex="0" role="button">
        <span class="st-avatar">${speciesEmoji(b.species)}</span>
        <div class="min-w-0 flex-1">
          <p class="st-strong">${esc(b.pet_name)} <span class="st-room">${esc(T('room'))} ${esc(b.hotel_rooms?.room_number || '—')}</span></p>
          <p class="st-muted">${esc(fmtDay(b.check_in_date))} → ${esc(fmtDay(b.check_out_date))} · ${esc(T('nights', { n: b.nights || nightsBetween(b.check_in_date, b.check_out_date) }))}${b.owner_name ? ` · ${esc(b.owner_name)}` : ''}${b.owner_phone ? ` · ${esc(b.owner_phone)}` : ''}</p>
        </div>
        <span class="st-status is-${b.status}">${esc(T(`st_${b.status}`))}</span>
      </article>`).join('') : `<div class="st-empty"><p>${esc(T('noBookings'))}</p></div>`}</div>`;
  let t = null;
  const q = el.querySelector('[data-q]');
  q.oninput = () => { clearTimeout(t); t = setTimeout(() => { _bookingQuery = q.value.trim(); loadView().then(() => { const n = view().querySelector('[data-q]'); n?.focus(); n?.setSelectionRange(n.value.length, n.value.length); }); }, 350); };
  el.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => { _bookingFilter = b.dataset.f; loadView(); }; });
  bindCards(el, res.data);
}

// ── Rooms ────────────────────────────────────────────────────────────────────
async function renderRooms(el) {
  const res = await apiFetch(`/api/hotel/rooms?store_id=${_storeId}`);
  if (!res?.success) throw new Error('load');
  const rooms = res.data;
  el.innerHTML = `
    <div class="st-toolbar is-end">${_isOwner ? `<button type="button" class="ph-btn" data-add-room>${esc(T('addRoom'))}</button>` : `<p class="st-muted">${esc(T('ownerOnly'))}</p>`}</div>
    ${rooms.length ? `<div class="st-rooms">${rooms.map(r => `
      <article class="st-room-card is-${r.status}">
        <div class="flex items-start justify-between gap-2">
          <div><p class="st-room-no">${esc(r.room_number)}</p><p class="st-muted">${esc(T(`rt_${r.room_type}`))} · ${esc(T('upTo', { n: r.max_pets }))}</p></div>
          <span class="st-status is-room-${r.status}">${esc(T(`rs_${r.status}`))}</span>
        </div>
        <p class="st-price">${esc(baht(r.daily_rate))}<small>${esc(T('perNight'))}</small></p>
        <div class="st-tonight">${r.tonight.length ? r.tonight.map(s => `<button type="button" class="st-chip" data-open="${s.id}">${speciesEmoji(s.species)} ${esc(s.pet_name)}</button>`).join('') : '<span class="st-muted">—</span>'}</div>
        <div class="st-room-actions">
          ${r.status === 'cleaning' ? `<button type="button" class="ph-btn is-primary" data-status="available" data-room="${r.id}">${esc(T('markClean'))}</button>` : ''}
          ${r.status === 'maintenance' ? `<button type="button" class="ph-btn" data-status="available" data-room="${r.id}">${esc(T('reopen'))}</button>` : ''}
          ${r.status === 'available' && !r.tonight.length ? `<button type="button" class="ph-btn" data-status="maintenance" data-room="${r.id}">${esc(T('markMaint'))}</button>` : ''}
          ${_isOwner ? `<button type="button" class="ph-btn" data-edit-room="${r.id}">${esc(T('edit'))}</button>` : ''}
        </div>
      </article>`).join('')}</div>` : `<div class="st-empty"><p>${esc(T('noRooms'))}</p></div>`}`;
  el.querySelector('[data-add-room]')?.addEventListener('click', () => openRoomSheet());
  el.querySelectorAll('[data-edit-room]').forEach(b => { b.onclick = () => openRoomSheet(rooms.find(r => r.id === b.dataset.editRoom)); });
  el.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => openBookingDetail(b.dataset.open); });
  el.querySelectorAll('[data-status]').forEach(b => {
    b.onclick = async () => {
      b.disabled = true;
      const r = await apiFetch(`/api/hotel/rooms/${b.dataset.room}`, { method: 'PATCH', body: JSON.stringify({ store_id: _storeId, status: b.dataset.status }) }).catch(() => null);
      if (r?.success) { showToast(T('saved')); loadView(); } else { showToast(apiError(r), 'error'); b.disabled = false; }
    };
  });
}

function openRoomSheet(room = null) {
  const sheet = openSheet({ title: room ? T('editRoom') : T('addRoom').replace('+ ', '') });
  const types = ['standard', 'deluxe', 'suite', 'cat', 'small', 'large', 'vip'];
  sheet.body.innerHTML = `
    <div class="st-grid2">
      <label class="cx-field"><span>${esc(T('roomNumber'))} *</span><input data-f="room_number" maxlength="20" value="${esc(room?.room_number || '')}" required></label>
      <label class="cx-field"><span>${esc(T('roomType'))}</span><select class="st-select" data-f="room_type">${types.map(t => `<option value="${t}" ${room?.room_type === t ? 'selected' : ''}>${esc(T(`rt_${t}`))}</option>`).join('')}</select></label>
      <label class="cx-field"><span>${esc(T('rate'))}</span><input data-f="daily_rate" type="number" min="0" step="10" inputmode="decimal" value="${room ? Number(room.daily_rate) : ''}" placeholder="500"></label>
      <label class="cx-field"><span>${esc(T('maxPets'))}</span><input data-f="max_pets" type="number" min="1" max="20" value="${room?.max_pets || 1}"></label>
      <label class="cx-field"><span>${esc(T('floor'))}</span><input data-f="floor" type="number" min="-5" max="200" value="${room?.floor ?? 1}"></label>
    </div>`;
  sheet.foot.innerHTML = `${room ? `<button type="button" class="ph-btn is-danger" data-del>${esc(T('deleteRoom'))}</button>` : ''}<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('cancel'))}</button><button type="button" class="ph-btn is-primary" data-save>${esc(T('save'))}</button>`;
  const v = k => sheet.body.querySelector(`[data-f="${k}"]`).value.trim();
  sheet.foot.querySelector('[data-save]').onclick = async e => {
    if (!v('room_number')) { sheet.body.querySelector('[data-f="room_number"]').focus(); return; }
    e.target.disabled = true;
    const body = { store_id: _storeId, room_number: v('room_number'), room_type: v('room_type'), daily_rate: Number(v('daily_rate') || 0), max_pets: Number(v('max_pets') || 1), floor: Number(v('floor') || 1) };
    const r = await apiFetch(room ? `/api/hotel/rooms/${room.id}` : '/api/hotel/rooms', { method: room ? 'PATCH' : 'POST', body: JSON.stringify(body) }).catch(() => null);
    if (r?.success) { showToast(T('saved')); sheet.close(); loadView(); } else { showToast(apiError(r), 'error'); e.target.disabled = false; }
  };
  sheet.foot.querySelector('[data-del]')?.addEventListener('click', async e => {
    e.target.disabled = true;
    const r = await apiFetch(`/api/hotel/rooms/${room.id}?store_id=${_storeId}`, { method: 'DELETE', body: JSON.stringify({ store_id: _storeId }) }).catch(() => null);
    if (r?.success) { showToast(T('saved')); sheet.close(); loadView(); } else { showToast(apiError(r), 'error'); e.target.disabled = false; }
  });
}

// ── New booking (one or more pets) ───────────────────────────────────────────
async function addOnCatalog() {
  if (_addOnCatalog) return _addOnCatalog;
  const r = await apiFetch(`/api/service-items?store_id=${_storeId}`).catch(() => null);
  _addOnCatalog = (r?.data || []).filter(s => ['boarding', 'grooming', 'hotel'].includes(s.category)).slice(0, 12);
  return _addOnCatalog;
}

function careFields(prefix, v = {}) {
  const c = v.care_profile || {};
  const feeds = (v.feeding_schedule?.length ? v.feeding_schedule : [{ time: '08:00' }, { time: '18:00' }]);
  const items = v.belongings_log?.length ? v.belongings_log : [];
  return `
    <div class="st-care" data-care="${prefix}">
      <p class="st-label">${esc(T('feeding'))}</p>
      <div class="st-rows" data-feeds>${feeds.map(f => feedRow(f)).join('')}</div>
      <button type="button" class="st-link" data-add-feed>${esc(T('addFeed'))}</button>
      <div class="st-grid2">
        <label class="cx-field"><span>${esc(T('medications'))}</span><textarea rows="2" data-c="medications" maxlength="1000">${esc(c.medications || '')}</textarea></label>
        <label class="cx-field"><span>${esc(T('temperament'))}</span><textarea rows="2" data-c="temperament" maxlength="1000">${esc(c.temperament || '')}</textarea></label>
        <label class="cx-field"><span>${esc(T('healthNotes'))}</span><textarea rows="2" data-c="health_notes" maxlength="1000">${esc(c.health_notes || '')}</textarea></label>
        <label class="cx-field"><span>${esc(T('vaccineExpiry'))}</span><input type="date" data-c="vaccine_expiry" value="${esc(c.vaccine_expiry || '')}"></label>
      </div>
      <div class="st-checks">
        ${[['vaccines_checked', 'vaccinesChecked'], ['flea_tick_checked', 'fleaChecked'], ['can_share_room', 'canShare'], ['photo_updates', 'photoUpdates']].map(([k, l]) => `<label><input type="checkbox" data-c="${k}" ${c[k] ? 'checked' : ''}> ${esc(T(l))}</label>`).join('')}
      </div>
      <div class="st-grid2">
        <label class="cx-field"><span>${esc(T('vetName'))}</span><input data-c="vet_name" maxlength="120" value="${esc(c.vet_name || '')}"></label>
        <label class="cx-field"><span>${esc(T('vetPhone'))}</span><input data-c="vet_phone" inputmode="tel" maxlength="30" value="${esc(c.vet_phone || '')}"></label>
        <label class="cx-field"><span>${esc(T('emergencyName'))}</span><input data-c="emergency_name" maxlength="120" value="${esc(c.emergency_name || '')}"></label>
        <label class="cx-field"><span>${esc(T('emergencyPhone'))}</span><input data-c="emergency_phone" inputmode="tel" maxlength="30" value="${esc(c.emergency_phone || '')}"></label>
      </div>
      <p class="st-label">${esc(T('belongings'))}</p>
      <div class="st-rows" data-items>${items.map(i => itemRow(i)).join('')}</div>
      <button type="button" class="st-link" data-add-item>${esc(T('addItem'))}</button>
      <label class="cx-field"><span>${esc(T('special'))}</span><textarea rows="2" data-x="special_instructions" maxlength="2000">${esc(v.special_instructions || '')}</textarea></label>
    </div>`;
}
const feedRow = f => `<div class="st-row"><input type="time" data-r="time" value="${esc(f.time || '')}" aria-label="${esc(T('feedTime'))}"><input data-r="food" placeholder="${esc(T('food'))}" value="${esc(f.food || '')}" maxlength="200"><input data-r="amount" placeholder="${esc(T('amount'))}" value="${esc(f.amount || '')}" maxlength="60"><button type="button" class="icon-btn" data-del-row aria-label="${esc(T('remove'))}">×</button></div>`;
const itemRow = i => `<div class="st-row is-item"><input data-r="item" placeholder="${esc(T('item'))}" value="${esc(i.item || '')}" maxlength="120"><input data-r="qty" type="number" min="1" max="99" value="${i.qty || 1}" aria-label="${esc(T('qty'))}"><button type="button" class="icon-btn" data-del-row aria-label="${esc(T('remove'))}">×</button></div>`;

function bindCare(root) {
  root.querySelectorAll('[data-add-feed]').forEach(b => { b.onclick = () => b.previousElementSibling.insertAdjacentHTML('beforeend', feedRow({})); });
  root.querySelectorAll('[data-add-item]').forEach(b => { b.onclick = () => b.previousElementSibling.insertAdjacentHTML('beforeend', itemRow({})); });
  root.addEventListener('click', e => { const d = e.target.closest('[data-del-row]'); if (d) d.closest('.st-row').remove(); });
}

function readCare(box) {
  const care = {};
  box.querySelectorAll('[data-c]').forEach(i => { care[i.dataset.c] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
  const rows = sel => [...box.querySelectorAll(`${sel} .st-row`)].map(r => Object.fromEntries([...r.querySelectorAll('[data-r]')].map(i => [i.dataset.r, i.value.trim()])));
  return {
    care_profile: care,
    feeding_schedule: rows('[data-feeds]').filter(f => f.time || f.food),
    belongings_log: rows('[data-items]').filter(i => i.item).map(i => ({ item: i.item, qty: Number(i.qty) || 1 })),
    special_instructions: box.querySelector('[data-x="special_instructions"]')?.value.trim() || '',
  };
}

async function openBookingSheet({ from = todayBkk(), to = null, roomId = null, appointmentId = null, pets = [null], note = '' }) {
  to = to || addDays(from, 1);
  const sheet = openSheet({ title: appointmentId ? T('assignRoom') : T('newBooking'), subtitle: appointmentId ? T('requestsHint') : '', wide: true });
  const catalog = await addOnCatalog();
  const petBlocks = [];

  sheet.body.innerHTML = `
    <section class="st-block">
      <p class="st-label">${esc(T('stay'))}</p>
      <div class="st-grid2">
        <label class="cx-field"><span>${esc(T('checkInDate'))}</span><input type="date" data-in value="${from}" min="${todayBkk()}" ${appointmentId ? 'readonly' : ''}></label>
        <label class="cx-field"><span>${esc(T('checkOutDate'))}</span><input type="date" data-out value="${to}" ${appointmentId ? 'readonly' : ''}></label>
      </div>
      <p class="st-nights" data-nights></p>
    </section>
    <section class="st-block"><p class="st-label">${esc(T('chooseRoom'))}</p><div class="st-room-pick" data-rooms></div></section>
    <div data-pets></div>
    ${appointmentId ? '' : `<button type="button" class="ph-btn st-add-pet" data-add-pet>${esc(T('addPet'))}</button>`}
    ${catalog.length ? `<section class="st-block"><p class="st-label">${esc(T('addOns'))}</p><div class="st-checks">${catalog.map(s => `<label><input type="checkbox" data-addon="${esc(s.id)}"> ${esc(s.name)} <span class="st-muted">${esc(baht(s.price))}${s.category === 'boarding' ? esc(T('perNight')) : ''}</span></label>`).join('')}</div></section>` : ''}
    <section class="st-block st-grid2">
      <label class="cx-field"><span>${esc(T('deposit'))}</span><input type="number" min="0" step="50" inputmode="decimal" data-deposit placeholder="0"></label>
      <label class="cx-field"><span>${esc(T('notes'))}</span><input data-notes maxlength="500" value="${esc(note || '')}"></label>
    </section>
    <label class="st-walkin" data-walkin-wrap hidden><input type="checkbox" data-walkin> ${esc(T('checkInNow'))}</label>`;
  sheet.foot.innerHTML = `<p class="st-total" data-total></p><span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('cancel'))}</button><button type="button" class="ph-btn is-primary" data-save>${esc(T('reserve'))}</button>`;

  const $ = s => sheet.body.querySelector(s);
  let freeRooms = [];
  let chosenRoom = roomId;

  const addPetBlock = initial => {
    const n = petBlocks.length + 1;
    const wrap = document.createElement('section');
    wrap.className = 'st-block st-pet-block';
    wrap.innerHTML = `<div class="flex items-center justify-between"><p class="st-label">${esc(T('petN', { n }))}</p>${n > 1 ? `<button type="button" class="st-link" data-remove-pet>${esc(T('remove'))}</button>` : ''}</div>`;
    const picker = petPicker({ storeId: _storeId, initial, onChange: updateTotal });
    wrap.appendChild(picker.el);
    const care = document.createElement('details');
    care.className = 'st-details';
    care.open = Boolean(initial);
    care.innerHTML = `<summary>${esc(T('careSheet'))}</summary>${careFields(`p${n}`)}`;
    wrap.appendChild(care);
    bindCare(care);
    $('[data-pets]').appendChild(wrap);
    const block = { wrap, picker, care };
    petBlocks.push(block);
    wrap.querySelector('[data-remove-pet]')?.addEventListener('click', () => { wrap.remove(); petBlocks.splice(petBlocks.indexOf(block), 1); updateTotal(); });
  };
  pets.forEach(p => addPetBlock(p));
  $('[data-add-pet]')?.addEventListener('click', () => addPetBlock(null));

  function updateTotal() {
    const nights = Math.max(0, nightsBetween($('[data-in]').value, $('[data-out]').value));
    $('[data-nights]').textContent = nights > 0 ? T('nights', { n: nights }) : T('invalid_dates');
    const room = freeRooms.find(r => r.id === chosenRoom);
    const addOns = catalog.filter(s => $(`[data-addon="${CSS.escape(s.id)}"]`)?.checked);
    const per = addOns.reduce((n, s) => n + Number(s.price || 0) * (s.category === 'boarding' ? nights : 1), 0);
    const count = Math.max(1, petBlocks.length);
    const total = room ? (Number(room.daily_rate) * nights + per) * count : 0;
    $('[data-walkin-wrap]').hidden = $('[data-in]').value !== todayBkk();
    sheet.foot.querySelector('[data-total]').innerHTML = room ? `${esc(T('total'))} <b>${esc(baht(total))}</b>` : '';
  }

  async function loadRooms() {
    const a = $('[data-in]').value, b = $('[data-out]').value;
    const box = $('[data-rooms]');
    if (!a || !b || b <= a) { box.innerHTML = `<p class="st-muted">${esc(T('invalid_dates'))}</p>`; updateTotal(); return; }
    box.innerHTML = `<p class="st-muted">${esc(T('loading'))}</p>`;
    const r = await apiFetch(`/api/hotel/free-rooms?store_id=${_storeId}&from=${a}&to=${b}`).catch(() => null);
    freeRooms = r?.data || [];
    if (!freeRooms.some(x => x.id === chosenRoom)) chosenRoom = freeRooms[0]?.id || null;
    box.innerHTML = freeRooms.length ? freeRooms.map(x => `
      <label class="st-room-opt"><input type="radio" name="st-room" value="${x.id}" ${x.id === chosenRoom ? 'checked' : ''}>
        <span><b>${esc(x.room_number)}</b> <small>${esc(T(`rt_${x.room_type}`))} · ${esc(T('upTo', { n: x.max_pets }))}</small><em>${esc(baht(x.daily_rate))}${esc(T('perNight'))}</em></span></label>`).join('')
      : `<p class="st-muted">${esc(T('noFreeRoom'))}</p>`;
    box.querySelectorAll('input[name="st-room"]').forEach(i => { i.onchange = () => { chosenRoom = i.value; updateTotal(); }; });
    updateTotal();
  }
  $('[data-in]').onchange = () => { if ($('[data-out]').value <= $('[data-in]').value) $('[data-out]').value = addDays($('[data-in]').value, 1); loadRooms(); };
  $('[data-out]').onchange = loadRooms;
  sheet.body.addEventListener('change', e => { if (e.target.matches('[data-addon]')) updateTotal(); });
  loadRooms();

  sheet.foot.querySelector('[data-save]').onclick = async e => {
    if (!chosenRoom) { showToast(T('noFreeRoom'), 'error'); return; }
    const chosen = petBlocks.map(b => ({ b, pet: b.picker.get() }));
    const missing = chosen.find(c => !c.pet);
    if (missing) { showToast(T('pet_required'), 'error'); missing.b.wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    e.target.disabled = true;
    const addOns = catalog.filter(s => $(`[data-addon="${CSS.escape(s.id)}"]`)?.checked).map(s => ({ name: s.name, price: Number(s.price || 0), per: s.category === 'boarding' ? 'night' : 'stay' }));
    let saved = 0;
    let syncWarn = false;
    for (const { b, pet } of chosen) {
      const care = readCare(b.care);
      const r = await apiFetch('/api/hotel/bookings', {
        method: 'POST',
        body: JSON.stringify({
          store_id: _storeId, room_id: chosenRoom, check_in_date: $('[data-in]').value, check_out_date: $('[data-out]').value,
          appointment_id: appointmentId, check_in_now: $('[data-walkin]').checked,
          pet_id: pet.pet_id, pet_name: pet.pet_name, species: pet.species, owner_name: pet.owner_name || chosen[0].pet.owner_name, owner_phone: pet.owner_phone || chosen[0].pet.owner_phone,
          deposit_amount: saved === 0 ? Number($('[data-deposit]').value || 0) : 0, notes: $('[data-notes]').value,
          add_on_services: addOns, ...care,
        }),
      }).catch(() => null);
      if (!r?.success) { showToast(apiError(r), 'error'); e.target.disabled = false; if (saved) loadView(); return; }
      if (r.appointment_sync_error) syncWarn = true;
      saved += 1;
    }
    showToast(syncWarn ? T('appSyncFail') : T('bookedN', { n: saved }), syncWarn ? 'info' : 'success');
    sheet.close();
    loadView();
  };
}

// ── Booking detail ───────────────────────────────────────────────────────────
async function openBookingDetail(id, { focusLog = false } = {}) {
  const sheet = openSheet({ title: T('details'), wide: true });
  sheet.body.innerHTML = `<div class="st-skeleton"></div>`;
  const r = await apiFetch(`/api/hotel/bookings/${id}?store_id=${_storeId}`).catch(() => null);
  if (!r?.success) { sheet.body.innerHTML = `<p class="st-muted">${esc(T('loadFail'))}</p>`; return; }
  const b = r.data;
  const c = b.care_profile || {};
  const nights = b.nights || nightsBetween(b.check_in_date, b.check_out_date);
  const addOns = (b.add_on_services || []).reduce((n, a) => n + Number(a.price || 0) * (a.per === 'night' ? nights : 1), 0);
  const total = Number(b.total_amount || 0) + addOns;
  const field = (label, value) => value ? `<div class="st-kv"><span>${esc(label)}</span><p>${esc(value)}</p></div>` : '';
  const open = ['reserved', 'checked_in'].includes(b.status);

  sheet.root.querySelector('.sh-title').textContent = `${b.pet_name} · ${T('room')} ${b.hotel_rooms?.room_number || '—'}`;
  sheet.body.innerHTML = `
    <div class="st-detail-head">
      <span class="st-avatar is-lg">${b.pets?.avatar_url ? `<img src="${esc(b.pets.avatar_url)}" alt="">` : speciesEmoji(b.species)}</span>
      <div class="min-w-0 flex-1">
        <p class="st-strong">${esc(b.pet_name)} <span class="st-muted">· ${esc(speciesLabel(b.species))}</span> <span class="st-status is-${b.status}">${esc(T(`st_${b.status}`))}</span></p>
        <p class="st-muted">${esc([b.owner_name, b.owner_phone].filter(Boolean).join(' · ') || '—')}${b.owner_phone ? ` · <a class="st-link" href="tel:${esc(b.owner_phone.replace(/[^\d+]/g, ''))}">${esc(T('phone'))}</a>` : ''}</p>
        ${petFacts(b.pets)}
      </div>
    </div>
    <div class="st-summary">
      <div><span>${esc(T('checkInDate'))}</span><b>${esc(fmtDay(b.check_in_date, { weekday: 'short', day: 'numeric', month: 'short' }))}</b></div>
      <div><span>${esc(T('checkOutDate'))}</span><b>${esc(fmtDay(b.check_out_date, { weekday: 'short', day: 'numeric', month: 'short' }))}</b></div>
      <div><span>${esc(T('total'))}</span><b>${esc(baht(total))}</b><small>${esc(T('nights', { n: nights }))} × ${esc(baht(b.room_rate))}${addOns ? ` + ${esc(baht(addOns))}` : ''}</small></div>
      <div><span>${esc(T('balance'))}</span><b>${esc(baht(Math.max(0, total - Number(b.deposit_amount || 0))))}</b>${Number(b.deposit_amount) ? `<small>${esc(T('deposit'))} ${esc(baht(b.deposit_amount))}</small>` : ''}</div>
    </div>
    <section class="st-block">
      <div class="flex items-center justify-between"><p class="st-label">${esc(T('careSheet'))}</p>${open ? `<button type="button" class="st-link" data-edit>${esc(T('edit'))}</button>` : ''}</div>
      <div data-care-view>
        ${(b.feeding_schedule || []).length ? `<div class="st-kv"><span>${esc(T('feeding'))}</span><ul class="st-feed">${b.feeding_schedule.map(f => `<li><b>${esc(f.time || '')}</b> ${esc(f.food || '')} ${f.amount ? `· ${esc(f.amount)}` : ''}</li>`).join('')}</ul></div>` : ''}
        ${field(T('medications'), c.medications)}${field(T('temperament'), c.temperament)}${field(T('healthNotes'), c.health_notes)}
        <div class="st-flags">${c.vaccines_checked ? `<span class="st-chip is-ok">✓ ${esc(T('vaccinesChecked'))}${c.vaccine_expiry ? ` · ${esc(fmtDay(c.vaccine_expiry, { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}</span>` : `<span class="st-chip is-warn">${esc(T('vaccinesChecked'))}?</span>`}${c.flea_tick_checked ? `<span class="st-chip is-ok">✓ ${esc(T('fleaChecked'))}</span>` : ''}${c.can_share_room ? `<span class="st-chip">${esc(T('canShare'))}</span>` : ''}${c.photo_updates ? `<span class="st-chip">📷 ${esc(T('photoUpdates'))}</span>` : ''}</div>
        ${field(T('vetName'), [c.vet_name, c.vet_phone].filter(Boolean).join(' · '))}${field(T('emergencyName'), [c.emergency_name, c.emergency_phone].filter(Boolean).join(' · '))}
        ${(b.belongings_log || []).length ? `<div class="st-kv"><span>${esc(T('belongings'))}</span><p>${b.belongings_log.map(i => `${esc(i.item)} ×${i.qty}`).join(', ')}</p></div>` : ''}
        ${field(T('special'), b.special_instructions)}${field(T('notes'), b.notes)}
        ${(b.add_on_services || []).length ? field(T('addOns'), b.add_on_services.map(a => a.name).join(', ')) : ''}
      </div>
    </section>
    <section class="st-block">
      <p class="st-label">${esc(T('careLog'))}</p>
      ${b.status === 'checked_in' ? `<div class="st-log-add"><input class="cx-search" data-note maxlength="500" placeholder="${esc(T('addNote'))}"><button type="button" class="ph-btn is-primary" data-add-note>${esc(T('add'))}</button></div>` : ''}
      <ol class="st-log">${(b.daily_notes || []).slice().reverse().map(n => { const [t, ...rest] = n.split(' · '); return `<li><time>${esc(t)}</time><p>${esc(rest.join(' · '))}</p></li>`; }).join('') || `<li class="st-muted">${esc(T('noNotes'))}</li>`}</ol>
    </section>
    ${b.cancelled_reason ? field(T('reason'), b.cancelled_reason) : ''}`;

  const actions = [];
  if (b.status === 'reserved') {
    actions.push(`<button type="button" class="ph-btn is-danger" data-act="cancel">${esc(T('cancelBooking'))}</button>`);
    if (b.check_in_date <= todayBkk()) actions.push(`<button type="button" class="ph-btn" data-act="no-show">${esc(T('noShow'))}</button>`);
    actions.push('<span class="flex-1"></span>', `<button type="button" class="ph-btn" data-act="move">${esc(T('moveStay'))}</button>`);
    if (b.check_in_date <= todayBkk()) actions.push(`<button type="button" class="ph-btn is-primary" data-act="checkin">${esc(T('checkIn'))}</button>`);
  } else if (b.status === 'checked_in') {
    actions.push('<span class="flex-1"></span>', `<button type="button" class="ph-btn" data-act="move">${esc(T('moveStay'))}</button>`, `<button type="button" class="ph-btn is-primary" data-act="checkout">${esc(T('checkOut'))}</button>`);
  } else actions.push('<span class="flex-1"></span>', `<button type="button" class="ph-btn" data-sh-close>${esc(T('close'))}</button>`);
  sheet.foot.innerHTML = actions.join('');

  const act = async (path, body = {}) => {
    const res = await apiFetch(`/api/hotel/bookings/${b.id}/${path}`, { method: 'POST', body: JSON.stringify({ store_id: _storeId, ...body }) }).catch(() => null);
    if (!res?.success) { showToast(apiError(res), 'error'); return false; }
    showToast(res.appointment_sync_error ? T('appSyncFail') : T('saved'), res.appointment_sync_error ? 'info' : 'success');
    sheet.close(); loadView(); return true;
  };
  sheet.foot.querySelector('[data-act="checkin"]')?.addEventListener('click', e => { e.target.disabled = true; act('checkin').then(ok => { if (!ok) e.target.disabled = false; }); });
  sheet.foot.querySelector('[data-act="checkout"]')?.addEventListener('click', () => { sheet.close(); openCheckout(b); });
  sheet.foot.querySelector('[data-act="no-show"]')?.addEventListener('click', e => { e.target.disabled = true; act('no-show').then(ok => { if (!ok) e.target.disabled = false; }); });
  sheet.foot.querySelector('[data-act="cancel"]')?.addEventListener('click', async () => {
    const reason = await askReason(openSheet, { title: T('cancelBooking'), presets: T('cancelPresets').split(',') });
    if (reason) act('cancel', { reason });
  });
  sheet.foot.querySelector('[data-act="move"]')?.addEventListener('click', () => { sheet.close(); openMoveSheet(b); });
  sheet.body.querySelector('[data-edit]')?.addEventListener('click', () => {
    const box = sheet.body.querySelector('[data-care-view]');
    box.innerHTML = `${careFields('edit', b)}<div class="st-grid2"><label class="cx-field"><span>${esc(T('ownerName'))}</span><input data-o="owner_name" value="${esc(b.owner_name || '')}"></label><label class="cx-field"><span>${esc(T('phone'))}</span><input data-o="owner_phone" inputmode="tel" value="${esc(b.owner_phone || '')}"></label><label class="cx-field"><span>${esc(T('deposit'))}</span><input type="number" min="0" data-o="deposit_amount" value="${Number(b.deposit_amount || 0)}"></label><label class="cx-field"><span>${esc(T('notes'))}</span><input data-o="notes" value="${esc(b.notes || '')}"></label></div><div class="flex justify-end gap-2 mt-3"><button type="button" class="ph-btn is-primary" data-save-care>${esc(T('save'))}</button></div>`;
    bindCare(box);
    box.querySelector('[data-save-care]').onclick = async e => {
      e.target.disabled = true;
      const owner = Object.fromEntries([...box.querySelectorAll('[data-o]')].map(i => [i.dataset.o, i.type === 'number' ? Number(i.value || 0) : i.value.trim()]));
      const res = await apiFetch(`/api/hotel/bookings/${b.id}`, { method: 'PATCH', body: JSON.stringify({ store_id: _storeId, ...readCare(box), ...owner }) }).catch(() => null);
      if (res?.success) { showToast(T('saved')); sheet.close(); openBookingDetail(b.id); } else { showToast(apiError(res), 'error'); e.target.disabled = false; }
    };
  });
  const noteInput = sheet.body.querySelector('[data-note]');
  const addNote = async () => {
    const note = noteInput.value.trim();
    if (!note) return;
    const res = await apiFetch(`/api/hotel/bookings/${b.id}/notes`, { method: 'POST', body: JSON.stringify({ store_id: _storeId, note }) }).catch(() => null);
    if (res?.success) { sheet.close(); openBookingDetail(b.id, { focusLog: true }); } else showToast(apiError(res), 'error');
  };
  sheet.body.querySelector('[data-add-note]')?.addEventListener('click', addNote);
  noteInput?.addEventListener('keydown', e => { if (e.key === 'Enter') addNote(); });
  if (focusLog) setTimeout(() => noteInput?.focus(), 120);
}

async function doCheckIn(id) {
  const res = await apiFetch(`/api/hotel/bookings/${id}/checkin`, { method: 'POST', body: JSON.stringify({ store_id: _storeId }) }).catch(() => null);
  if (!res?.success) { showToast(apiError(res), 'error'); return; }
  showToast(res.appointment_sync_error ? T('appSyncFail') : T('saved'), res.appointment_sync_error ? 'info' : 'success');
  loadView();
}

function openCheckout(b) {
  const nights = b.nights || nightsBetween(b.check_in_date, b.check_out_date);
  const addOns = (b.add_on_services || []).map(a => ({ ...a, sum: Number(a.price || 0) * (a.per === 'night' ? nights : 1) }));
  const total = Number(b.total_amount || 0) + addOns.reduce((n, a) => n + a.sum, 0);
  const sheet = openSheet({ title: `${T('checkOut')} · ${b.pet_name}` });
  sheet.body.innerHTML = `
    <p class="st-label">${esc(T('bill'))}</p>
    <dl class="st-bill">
      <div><dt>${esc(T('room'))} ${esc(b.hotel_rooms?.room_number || '')} · ${esc(T('nights', { n: nights }))} × ${esc(baht(b.room_rate))}</dt><dd>${esc(baht(b.total_amount))}</dd></div>
      ${addOns.map(a => `<div><dt>${esc(a.name)}</dt><dd>${esc(baht(a.sum))}</dd></div>`).join('')}
      ${Number(b.deposit_amount) ? `<div><dt>${esc(T('deposit'))}</dt><dd>−${esc(baht(b.deposit_amount))}</dd></div>` : ''}
      <div class="is-total"><dt>${esc(T('balance'))}</dt><dd>${esc(baht(Math.max(0, total - Number(b.deposit_amount || 0))))}</dd></div>
    </dl>
    ${(b.belongings_log || []).length ? `<p class="st-label">${esc(T('belongings'))}</p><div class="st-checks">${b.belongings_log.map(i => `<label><input type="checkbox"> ${esc(i.item)} ×${i.qty}</label>`).join('')}</div>` : ''}
    <p class="st-muted st-hint">${esc(T('payAtCashier'))}</p>`;
  sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('cancel'))}</button><button type="button" class="ph-btn is-primary" data-ok>${esc(T('checkOut'))}</button>`;
  sheet.foot.querySelector('[data-ok]').onclick = async e => {
    e.target.disabled = true;
    const res = await apiFetch(`/api/hotel/bookings/${b.id}/checkout`, { method: 'POST', body: JSON.stringify({ store_id: _storeId }) }).catch(() => null);
    if (!res?.success) { showToast(apiError(res), 'error'); e.target.disabled = false; return; }
    showToast(res.appointment_sync_error ? T('appSyncFail') : T('checkedOutMsg'), res.appointment_sync_error ? 'info' : 'success');
    sheet.close(); loadView();
  };
}

function openMoveSheet(b) {
  const sheet = openSheet({ title: `${T('moveStay')} · ${b.pet_name}` });
  const locked = b.status === 'checked_in';
  sheet.body.innerHTML = `
    <div class="st-grid2">
      <label class="cx-field"><span>${esc(T('checkInDate'))}</span><input type="date" data-in value="${b.check_in_date}" ${locked ? 'disabled' : `min="${todayBkk()}"`}></label>
      <label class="cx-field"><span>${esc(T('checkOutDate'))}</span><input type="date" data-out value="${b.check_out_date}"></label>
    </div>
    <p class="st-label">${esc(T('chooseRoom'))}</p><div class="st-room-pick" data-rooms></div>`;
  sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('cancel'))}</button><button type="button" class="ph-btn is-primary" data-ok>${esc(T('save'))}</button>`;
  const $ = s => sheet.body.querySelector(s);
  let room = b.room_id;
  const load = async () => {
    const a = $('[data-in]').value, c = $('[data-out]').value;
    if (!a || !c || c <= a) { $('[data-rooms]').innerHTML = `<p class="st-muted">${esc(T('invalid_dates'))}</p>`; return; }
    const r = await apiFetch(`/api/hotel/free-rooms?store_id=${_storeId}&from=${a}&to=${c}&exclude=${b.id}`).catch(() => null);
    const rooms = r?.data || [];
    if (!rooms.some(x => x.id === room)) room = rooms[0]?.id || null;
    $('[data-rooms]').innerHTML = rooms.length ? rooms.map(x => `<label class="st-room-opt"><input type="radio" name="st-move" value="${x.id}" ${x.id === room ? 'checked' : ''}><span><b>${esc(x.room_number)}</b> <small>${esc(T(`rt_${x.room_type}`))}</small><em>${esc(baht(x.daily_rate))}${esc(T('perNight'))}</em></span></label>`).join('') : `<p class="st-muted">${esc(T('noFreeRoom'))}</p>`;
    sheet.body.querySelectorAll('input[name="st-move"]').forEach(i => { i.onchange = () => { room = i.value; }; });
  };
  $('[data-in]').onchange = load; $('[data-out]').onchange = load; load();
  sheet.foot.querySelector('[data-ok]').onclick = async e => {
    if (!room) return;
    e.target.disabled = true;
    const res = await apiFetch(`/api/hotel/bookings/${b.id}`, { method: 'PATCH', body: JSON.stringify({ store_id: _storeId, room_id: room, check_in_date: $('[data-in]').value, check_out_date: $('[data-out]').value }) }).catch(() => null);
    if (res?.success) { showToast(T('saved')); sheet.close(); loadView(); } else { showToast(apiError(res), 'error'); e.target.disabled = false; }
  };
}
