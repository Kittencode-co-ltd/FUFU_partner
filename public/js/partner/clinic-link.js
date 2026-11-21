// Clinic ↔ FUFU App linking. The clinic's QR/code for the counter, one-time codes for an existing customer record,
// who has linked, and (phase 3) the App data each customer chose to share — read-only, every view is logged. API: server/routes/clinic-links.js. Styles: .cl-* in src/css/input.css.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { icon } from '../utils/icons.js';
import { openSheet } from './sheet.js';
import { getLang, locale } from './portal-i18n.js';
import { clinicBilling } from './clinic-billing.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// [th, en, zh, ja, ko]
const S = {
  title: ['เชื่อมลูกค้ากับแอป FUFU', 'Link customers to the FUFU app', '将顾客连接到 FUFU 应用', 'お客様を FUFU アプリと連携', '고객을 FUFU 앱에 연결'],
  sub: ['ลูกค้าสแกน QR หรือกรอกรหัสนี้ในแอป เพื่อตั้งคลินิกของคุณเป็นคลินิกประจำ', 'Customers scan this QR or type the code in the app to make you their clinic', '顾客在应用中扫码或输入代码即可将您设为常用诊所', 'お客様がアプリでQRを読み取るかコードを入力すると、かかりつけに登録されます', '고객이 앱에서 QR을 스캔하거나 코드를 입력하면 단골 병원으로 등록돼요'],
  code: ['รหัสคลินิก', 'Clinic code', '诊所代码', 'クリニックコード', '병원 코드'],
  print: ['พิมพ์โปสเตอร์', 'Print poster', '打印海报', 'ポスターを印刷', '포스터 인쇄'],
  copyLink: ['คัดลอกลิงก์', 'Copy link', '复制链接', 'リンクをコピー', '링크 복사'], copied: ['คัดลอกแล้ว', 'Copied', '已复制', 'コピーしました', '복사했어요'],
  rotate: ['เปลี่ยนรหัสใหม่', 'New code', '更换代码', 'コードを変更', '코드 변경'],
  rotateAsk: ['เปลี่ยนรหัสใหม่? QR และรหัสเดิมจะใช้ไม่ได้ ต้องพิมพ์โปสเตอร์ใหม่ ลูกค้าที่เชื่อมแล้วไม่ได้รับผลกระทบ', 'Replace the code? The old QR and code stop working and you’ll need to reprint the poster. Customers already linked are not affected.', '更换代码？旧二维码将失效，需要重新打印海报。已连接的顾客不受影响。', 'コードを変更しますか？古いQRは使えなくなり、ポスターの再印刷が必要です。連携済みのお客様には影響ありません。', '코드를 바꿀까요? 기존 QR은 사용할 수 없고 포스터를 다시 인쇄해야 해요. 이미 연결된 고객은 영향 없어요.'],
  linked: ['ลูกค้าที่เชื่อมแอปแล้ว', 'Customers on the app', '已连接应用的顾客', 'アプリ連携済みのお客様', '앱에 연결된 고객'],
  none: ['ยังไม่มีลูกค้าเชื่อม วางโปสเตอร์ QR ไว้ที่เคาน์เตอร์ หรือส่งรหัสจากหน้ารายชื่อเจ้าของ', 'No one has linked yet. Put the QR poster at the counter, or send a code from the owners list.', '还没有顾客连接。将二维码海报放在前台，或从主人列表发送代码。', 'まだ連携はありません。受付にQRポスターを置くか、飼い主一覧からコードを送ってください。', '아직 연결된 고객이 없어요. 접수대에 QR 포스터를 두거나 보호자 목록에서 코드를 보내세요.'],
  via_store_code: ['สแกน QR / รหัสคลินิก', 'Clinic QR / code', '诊所二维码/代码', 'クリニックQR/コード', '병원 QR/코드'],
  via_invite: ['รหัสส่วนตัวจากคลินิก', 'Personal invite', '个人邀请码', '個別招待コード', '개인 초대 코드'],
  via_nearby: ['เลือกจากคลินิกใกล้เคียง', 'Picked from nearby', '从附近诊所选择', '近くの病院から選択', '근처 병원에서 선택'],
  primary: ['คลินิกประจำ', 'Main clinic', '常用诊所', 'かかりつけ', '단골 병원'],
  record: ['แฟ้มลูกค้า', 'Customer record', '顾客档案', '顧客カルテ', '고객 기록'],
  noRecord: ['ยังไม่ได้จับคู่แฟ้ม', 'Not matched to a record', '未匹配档案', 'カルテ未照合', '기록과 미연결'],
  phase3: ['กดที่ลูกค้าเพื่อดูข้อมูลที่เขาเลือกแชร์จากแอป ทุกครั้งที่เปิดดูจะถูกบันทึก และลูกค้าเห็นได้', 'Tap a customer to see what they chose to share from the app. Every view is logged and visible to them.', '点击顾客可查看其从应用分享的资料。每次查看都会被记录，顾客可见。', 'お客様をタップすると、アプリから共有された情報を表示します。閲覧はすべて記録され、お客様も確認できます。', '고객을 누르면 앱에서 공유한 정보를 볼 수 있어요. 열람 기록은 고객에게도 보여요.'],
  sharedN: ['แชร์ {n}/4', 'Shares {n}/4', '分享 {n}/4', '共有 {n}/4', '공유 {n}/4'],
  notShared: ['ยังไม่แชร์', 'Not sharing', '未分享', '未共有', '공유 안 함'],
  sharedTitle: ['ข้อมูลจากแอปของ {name}', 'From {name}’s app', '{name} 的应用资料', '{name} さんのアプリ情報', '{name}님의 앱 정보'],
  sharedNone: ['ลูกค้ายังไม่ได้แชร์ข้อมูลจากแอปกับคลินิก ข้อมูลจะแสดงที่นี่เมื่อลูกค้าเปิดการแชร์ในแอป (คลินิกของฉัน > การแชร์ข้อมูล)', 'This customer isn’t sharing app data with you. It will show here once they turn sharing on in the app (My clinics > Sharing).', '该顾客尚未与诊所分享应用资料。顾客在应用中开启分享后会显示在这里。', 'このお客様はまだアプリの情報を共有していません。アプリで共有をオンにするとここに表示されます。', '이 고객은 아직 앱 정보를 공유하지 않았어요. 앱에서 공유를 켜면 여기에 표시돼요.'],
  sharedFoot: ['ลูกค้าเป็นผู้บันทึกข้อมูลนี้เองในแอป ใช้ประกอบการซักประวัติ · การเปิดดูถูกบันทึกแล้ว', 'Entered by the customer in their app; use it alongside your history taking · This view was logged', '资料由顾客在应用中自行录入，可作问诊参考 · 本次查看已记录', 'お客様がアプリに入力した情報です。問診の参考に · 閲覧は記録されました', '고객이 앱에 직접 입력한 정보예요. 문진 참고용 · 열람이 기록됐어요'],
  sharedAt: ['แชร์ตั้งแต่ {date}', 'Shared since {date}', '自 {date} 起分享', '{date} から共有', '{date}부터 공유'],
  cat_profile: ['ข้อมูลน้อง', 'Pet details', '宠物资料', 'ペット情報', '반려동물 정보'],
  cat_health: ['บันทึกสุขภาพ', 'Health notes', '健康记录', '健康記録', '건강 기록'],
  cat_vaccines: ['วัคซีนในแอป', 'App vaccines', '应用疫苗记录', 'アプリのワクチン', '앱 예방접종'],
  cat_scans: ['ผลสแกน AI', 'AI scans', 'AI 扫描', 'AIスキャン', 'AI 스캔'],
  f_weight: ['น้ำหนัก', 'Weight', '体重', '体重', '체중'], f_dob: ['วันเกิด', 'Birthday', '生日', '誕生日', '생일'],
  f_gender: ['เพศ', 'Sex', '性别', '性別', '성별'], f_neutered: ['ทำหมัน', 'Neutered', '绝育', '避妊去勢', '중성화'],
  f_allergies: ['แพ้ยา/อาหาร', 'Allergies', '过敏', 'アレルギー', '알레르기'], f_microchip: ['ไมโครชิป', 'Microchip', '芯片', 'マイクロチップ', '마이크로칩'],
  f_notes: ['หมายเหตุจากเจ้าของ', 'Owner notes', '主人备注', '飼い主メモ', '보호자 메모'],
  yes: ['ใช่', 'Yes', '是', 'はい', '예'], no: ['ไม่', 'No', '否', 'いいえ', '아니요'],
  nextDue: ['ครั้งถัดไป {date}', 'Next {date}', '下次 {date}', '次回 {date}', '다음 {date}'],
  noItems: ['ไม่มีรายการ', 'Nothing recorded', '暂无记录', '記録なし', '기록 없음'],
  sp_dog: ['สุนัข', 'Dog', '狗', '犬', '개'], sp_cat: ['แมว', 'Cat', '猫', '猫', '고양이'], sp_rabbit: ['กระต่าย', 'Rabbit', '兔', 'ウサギ', '토끼'],
  sp_bird: ['นก', 'Bird', '鸟', '鳥', '새'], sp_other: ['อื่น ๆ', 'Other', '其他', 'その他', '기타'],
  g_male: ['ผู้', 'Male', '公', 'オス', '수컷'], g_female: ['เมีย', 'Female', '母', 'メス', '암컷'],
  emBtn: ['รหัสฉุกเฉินจากแอป', 'Emergency code', '应用紧急代码', '緊急コード', '긴급 코드'],
  emTitle: ['เปิดข้อมูลฉุกเฉินจากแอป', 'Open an emergency share', '打开紧急分享', '緊急共有を開く', '긴급 공유 열기'],
  emHow: ['ลูกค้าเปิดแอป FUFU > โปรไฟล์ > แชร์ข้อมูลฉุกเฉิน แล้วยื่นรหัส 6 ตัวหรือ QR ให้ ใช้ได้ 72 ชม. คลินิกแรกที่เปิดจะเป็นคลินิกเดียวที่ใช้รหัสนี้ได้', 'The customer opens FUFU > Profile > Emergency share and shows a 6-character code or QR. Valid 72 hours; the first clinic to open it is the only one that can use it.', '顾客打开 FUFU > 个人 > 紧急分享，出示 6 位代码或二维码。72 小时有效，首个打开的诊所独享。', 'お客様が FUFU > プロフィール > 緊急共有 で6文字のコードかQRを提示します。72時間有効、最初に開いた病院のみ利用できます。', '고객이 FUFU > 프로필 > 긴급 공유에서 6자리 코드나 QR을 보여줘요. 72시간 유효, 처음 연 병원만 사용할 수 있어요.'],
  emCode: ['รหัสฉุกเฉิน', 'Emergency code', '紧急代码', '緊急コード', '긴급 코드'],
  emOpen: ['เปิดดูข้อมูล', 'Open', '打开', '開く', '열기'],
  emOpenCases: ['เคสฉุกเฉินที่ยังเปิดอยู่', 'Open emergency shares', '进行中的紧急分享', '有効な緊急共有', '진행 중인 긴급 공유'],
  emCase: ['{n} ตัว · เปิดเมื่อ {opened} · ถึง {until}', '{n} pet(s) · opened {opened} · until {until}', '{n} 只 · {opened} 打开 · 至 {until}', '{n}匹 · {opened} に開封 · {until} まで', '{n}마리 · {opened} 열람 · {until}까지'],
  emBanner: ['ข้อมูลฉุกเฉินจากแอป · ใช้ได้ถึง {until}', 'Emergency share · valid until {until}', '紧急分享 · 有效期至 {until}', '緊急共有 · {until} まで', '긴급 공유 · {until}까지'],
  emOwner: ['เจ้าของ', 'Owner', '主人', '飼い主', '보호자'],
  emFoot: ['ลูกค้าเป็นผู้บันทึกข้อมูลนี้เองในแอป ไม่รวมเวชระเบียนของคลินิกอื่น · การเปิดดูถูกบันทึกและลูกค้าเห็นได้', 'Entered by the customer in their app; other clinics’ records are not included · Views are logged and visible to the customer', '资料由顾客在应用中录入，不含其他诊所病历 · 查看记录对顾客可见', 'お客様がアプリに入力した情報で、他院のカルテは含みません · 閲覧は記録されます', '고객이 앱에 입력한 정보이며 다른 병원 기록은 없어요 · 열람은 기록돼요'],
  emBad: ['รหัสไม่ถูกต้อง หมดอายุ หรือถูกคลินิกอื่นใช้แล้ว ขอรหัสใหม่จากลูกค้า', 'Code is wrong, expired or already used by another clinic. Ask the customer for a new one.', '代码错误、已过期或已被其他诊所使用，请向顾客索取新代码。', 'コードが違うか、期限切れか、他院で使用済みです。新しいコードを依頼してください。', '코드가 틀리거나 만료됐거나 다른 병원에서 사용했어요. 새 코드를 요청하세요.'],
  emLocked: ['กรอกผิดหลายครั้ง รอ 15 นาทีแล้วลองใหม่', 'Too many wrong codes. Wait 15 minutes.', '错误次数过多，请 15 分钟后再试。', '誤入力が多すぎます。15分後に再試行してください。', '잘못 입력이 많아요. 15분 후 다시 시도하세요.'],
  planPaused: ['แพ็กเกจของคลินิกหมดอายุ ฟีเจอร์เชื่อมแอปพักอยู่ ดูรายละเอียดที่ "แพ็กเกจ FUFU ของคลินิก" ในหน้านี้', 'Your clinic package has expired, so app linking is paused. See "Your FUFU package" on this page.', '诊所套餐已到期，应用连接已暂停。请查看本页“诊所的 FUFU 套餐”。', 'プランの期限切れのため、アプリ連携は停止中です。このページの「FUFU プラン」をご確認ください。', '패키지가 만료되어 앱 연결이 중지됐어요. 이 페이지의 "FUFU 패키지"를 확인하세요.'],
  kg: ['{n} กก.', '{n} kg', '{n} 公斤', '{n} kg', '{n}kg'],
  inviteTitle: ['รหัสเชื่อมแอปของ {name}', 'App link code for {name}', '{name} 的应用连接码', '{name} さんのアプリ連携コード', '{name}님의 앱 연결 코드'],
  inviteHow: ['ให้ลูกค้าเปิดแอป FUFU > โปรไฟล์ > คลินิกของฉัน แล้วสแกน QR หรือกรอกรหัส น้องที่บันทึกไว้ที่คลินิกจะขึ้นในแอปของลูกค้าทันที', 'Ask the customer to open FUFU > Profile > My clinics and scan the QR or type the code. Pets on file here will appear in their app right away.', '请顾客打开 FUFU > 个人 > 我的诊所，扫码或输入代码。诊所里的宠物档案会立即出现在应用中。', 'お客様に FUFU > プロフィール > マイクリニック でQRを読み取るかコードを入力してもらいます。登録済みのペットがすぐアプリに表示されます。', '고객에게 FUFU > 프로필 > 내 병원에서 QR을 스캔하거나 코드를 입력하게 하세요. 병원에 등록된 반려동물이 바로 앱에 보여요.'],
  expires: ['ใช้ได้ถึง {date} · ใช้ได้ครั้งเดียว', 'Valid until {date} · one-time use', '有效期至 {date} · 仅可使用一次', '{date} まで有効・1回のみ', '{date}까지 유효 · 1회용'],
  share: ['ส่งให้ลูกค้า', 'Send to customer', '发送给顾客', 'お客様に送る', '고객에게 보내기'],
  shareText: ['เชื่อมแอป FUFU กับ {clinic}: เปิดลิงก์นี้ หรือกรอกรหัส {code} ในแอป (ใช้ได้ถึง {date})', 'Link your FUFU app with {clinic}: open this link or enter code {code} in the app (valid until {date})', '将 FUFU 应用与 {clinic} 连接：打开链接或在应用中输入代码 {code}（有效期至 {date}）', '{clinic} と FUFU アプリを連携：リンクを開くか、アプリでコード {code} を入力（{date} まで有効）', '{clinic}와 FUFU 앱 연결: 링크를 열거나 앱에서 코드 {code} 입력 ({date}까지)'],
  sendInvite: ['ส่งรหัสเชื่อมแอป', 'Send app code', '发送应用代码', 'アプリコードを送る', '앱 코드 보내기'],
  onApp: ['ใช้แอปแล้ว', 'On the app', '已用应用', 'アプリ利用中', '앱 사용 중'],
  close: ['ปิด', 'Close', '关闭', '閉じる', '닫기'], cancel: ['ยกเลิก', 'Cancel', '取消', 'キャンセル', '취소'], confirm: ['ยืนยัน', 'Confirm', '确认', '確定', '확인'],
  failed: ['ทำรายการไม่สำเร็จ', 'Something went wrong', '操作失败', 'うまくいきませんでした', '처리하지 못했어요'],
  posterTitle: ['ใช้แอป FUFU กับคลินิกเรา', 'Use the FUFU app with us', '与我们一起使用 FUFU 应用', 'FUFU アプリで当院とつながる', 'FUFU 앱으로 저희 병원과 연결하세요'],
  posterSteps: ['1. เปิดกล้องมือถือแล้วสแกน QR\n2. เข้าสู่ระบบแอป FUFU\n3. กด “เชื่อมคลินิก” เสร็จแล้ว', '1. Scan the QR with your phone camera\n2. Sign in to the FUFU app\n3. Tap “Link clinic” — done', '1. 用手机相机扫描二维码\n2. 登录 FUFU 应用\n3. 点击“连接诊所”', '1. スマホのカメラでQRを読み取る\n2. FUFU アプリにログイン\n3. 「クリニックと連携」をタップ', '1. 휴대폰 카메라로 QR 스캔\n2. FUFU 앱 로그인\n3. “병원 연결” 누르기'],
  posterCode: ['หรือกรอกรหัสในแอป', 'Or enter this code in the app', '或在应用中输入代码', 'またはアプリでコードを入力', '또는 앱에서 코드 입력'],
};
const T = (k, vars = {}) => {
  const i = ['th', 'en', 'zh', 'ja', 'ko'].indexOf(getLang());
  return String((S[k] || [k])[i] ?? S[k]?.[1] ?? k).replace(/\{(\w+)\}/g, (_, x) => vars[x] ?? '');
};
const fmtDate = iso => new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
export const isClinicStore = () => ['vet_clinic', 'vet_hospital'].includes(storage.get(STORAGE_KEYS.STORE_CATEGORY) || '');

async function copy(text) {
  try { await navigator.clipboard.writeText(text); showToast(T('copied')); } catch { window.prompt('', text); }
}

/** The clinic's QR / code card + linked customers. Shown on "ร้านและการรับจอง" for clinics only. */
export async function renderClinicLinkCard(el, { canEdit = false } = {}) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const storeName = storage.get(STORAGE_KEYS.STORE_NAME) || '';
  el.innerHTML = `<div class="card p-5"><div class="cl-skel"></div></div>`;
  const [codeRes, listRes, billing] = await Promise.all([
    apiFetch(`/api/clinic-links/code?store_id=${storeId}`).catch(() => null),
    apiFetch(`/api/clinic-links/customers?store_id=${storeId}`).catch(() => null),
    clinicBilling(),
  ]);
  const paused = billing?.applies && billing.phase === 'paused';
  if (!codeRes?.success) { el.innerHTML = ''; return; }
  const { code, url, qr_svg } = codeRes.data;
  const people = listRes?.data || [];
  el.innerHTML = `
    <section class="card p-5 cl-card">
      ${paused ? `<p class="cb-alert is-bad">${icon('exclamation-triangle', 'w-4 h-4')}${esc(T('planPaused'))}</p>` : ''}
      <div class="cl-card__main">
        <div class="cl-qr" aria-label="QR">${qr_svg}</div>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-bold text-navy">${esc(T('title'))}</h2>
          <p class="text-sm text-slate-500 mt-1">${esc(T('sub'))}</p>
          <p class="cl-code-label">${esc(T('code'))}</p>
          <p class="cl-code">${esc(code.slice(0, 3))}<span>${esc(code.slice(3))}</span></p>
          <div class="cl-actions">
            <button type="button" class="ph-btn is-primary" data-print>${icon('printer', 'w-4 h-4')}${esc(T('print'))}</button>
            <button type="button" class="ph-btn" data-copy>${icon('copy', 'w-4 h-4')}${esc(T('copyLink'))}</button>
            ${canEdit ? `<button type="button" class="ph-btn" data-rotate>${esc(T('rotate'))}</button>` : ''}
          </div>
        </div>
      </div>
      <div class="cl-people">
        <p class="cl-people__head">${esc(T('linked'))} <span>${people.length}</span></p>
        ${people.length ? `<ul>${people.slice(0, 50).map(p => `
          <li><button type="button" class="cl-person" data-person="${esc(p.user_id)}">
            <span class="cl-avatar">${esc((p.full_name || '?').trim().charAt(0).toUpperCase())}</span>
            <span class="min-w-0 flex-1"><b>${esc(p.full_name || '—')}</b>${p.is_primary ? ` <em class="cl-tag">${esc(T('primary'))}</em>` : ''}
              <small>${esc(T(`via_${p.linked_via}`))} · ${esc(fmtDate(p.linked_at))} · ${p.owner_name ? `${esc(T('record'))}: ${esc(p.owner_name)}` : esc(T('noRecord'))}</small></span>
            ${shareChip(p.consent)}
          </button></li>`).join('')}</ul>` : `<p class="cl-empty">${esc(T('none'))}</p>`}
        <p class="cl-note">${icon('shield-alt', 'w-4 h-4')}${esc(T('phase3'))}</p>
      </div>
    </section>`;
  el.querySelectorAll('[data-person]').forEach(b => {
    const p = people.find(x => x.user_id === b.dataset.person);
    b.onclick = () => openSharedSheet({ userId: p.user_id, name: p.full_name || p.owner_name || '' });
  });
  el.querySelector('[data-copy]').onclick = () => copy(url);
  el.querySelector('[data-print]').onclick = () => printPoster({ storeName, code, qr_svg });
  el.querySelector('[data-rotate]')?.addEventListener('click', () => {
    const sheet = openSheet({ title: T('rotate') });
    sheet.body.innerHTML = `<p class="text-sm text-slate-600 leading-6">${esc(T('rotateAsk'))}</p>`;
    sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('cancel'))}</button><button type="button" class="ph-btn is-danger" data-ok>${esc(T('confirm'))}</button>`;
    sheet.foot.querySelector('[data-ok]').onclick = async e => {
      e.target.disabled = true;
      const r = await apiFetch('/api/clinic-links/code/rotate', { method: 'POST', body: JSON.stringify({ store_id: storeId }) }).catch(() => null);
      if (!r?.success) { showToast(T('failed'), 'error'); e.target.disabled = false; return; }
      sheet.close(); renderClinicLinkCard(el, { canEdit });
    };
  });
}

function printPoster({ storeName, code, qr_svg }) {
  const w = window.open('', '_blank', 'width=720,height=960');
  if (!w) return;
  const steps = T('posterSteps').split('\n').map(s => `<li>${esc(s.replace(/^\d+\.\s*/, ''))}</li>`).join('');
  w.document.write(`<!doctype html><html lang="${esc(getLang())}"><meta charset="utf-8"><title>${esc(storeName)} · FUFU</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { margin: 0; font-family: 'Noto Sans Thai', system-ui, sans-serif; color: #1D3640; display: grid; place-items: center; min-height: 100vh; }
    .p { width: 100%; max-width: 520px; text-align: center; padding: 40px 32px; border: 2px solid #E4EAE9; border-radius: 28px; }
    .brand { font-weight: 800; letter-spacing: .02em; color: #2A6374; font-size: 18px; }
    h1 { margin: 10px 0 4px; font-size: 30px; line-height: 1.3; }
    h2 { margin: 0 0 24px; font-size: 18px; font-weight: 500; color: #5E7379; }
    .qr { width: 300px; height: 300px; margin: 0 auto; }
    .qr svg { width: 100%; height: 100%; }
    ol { text-align: left; display: inline-block; margin: 24px 0 8px; padding-left: 22px; font-size: 17px; line-height: 1.9; }
    .or { margin-top: 18px; font-size: 14px; color: #5E7379; }
    .code { font-size: 40px; font-weight: 800; letter-spacing: .18em; margin-top: 4px; }
  </style>
  <div class="p"><div class="brand">FUFU Pet Care</div><h1>${esc(T('posterTitle'))}</h1><h2>${esc(storeName)}</h2>
  <div class="qr">${qr_svg}</div><ol>${steps}</ol><p class="or">${esc(T('posterCode'))}</p><p class="code">${esc(code)}</p></div>
  <script>window.onload = () => setTimeout(() => window.print(), 300)<\/script></html>`);
  w.document.close();
}

/** One-time code for an existing customer record (owners list → "ส่งรหัสเชื่อมแอป"). */
export async function openInviteSheet(owner) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const storeName = storage.get(STORAGE_KEYS.STORE_NAME) || '';
  const sheet = openSheet({ title: T('inviteTitle', { name: owner.name || '' }) });
  sheet.body.innerHTML = `<div class="cl-skel"></div>`;
  const r = await apiFetch('/api/clinic-links/invite', { method: 'POST', body: JSON.stringify({ store_id: storeId, owner_id: owner.id }) }).catch(() => null);
  if (!r?.success) { sheet.body.innerHTML = `<p class="text-sm text-red-600">${esc(T(r?.code === 'plan_paused' ? 'planPaused' : 'failed'))}</p>`; return; }
  const { code, url, qr_svg, expires_at } = r.data;
  const date = fmtDate(expires_at);
  sheet.body.innerHTML = `
    <div class="cl-invite">
      <div class="cl-qr is-lg">${qr_svg}</div>
      <p class="cl-code is-lg">${esc(code.slice(0, 3))}<span>${esc(code.slice(3))}</span></p>
      <p class="cl-muted">${esc(T('expires', { date }))}</p>
      <p class="cl-how">${esc(T('inviteHow'))}</p>
    </div>`;
  const text = T('shareText', { clinic: storeName, code, date });
  sheet.foot.innerHTML = `<button type="button" class="ph-btn" data-copy>${icon('copy', 'w-4 h-4')}${esc(T('copyLink'))}</button><span class="flex-1"></span><button type="button" class="ph-btn is-primary" data-share>${esc(T('share'))}</button>`;
  sheet.foot.querySelector('[data-copy]').onclick = () => copy(`${text}\n${url}`);
  sheet.foot.querySelector('[data-share]').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'FUFU', text, url }); return; } catch { /* cancelled */ } }
    copy(`${text}\n${url}`);
  };
}

/** Customer records already linked to an App account: Map(owner_id → App user id), for the "ใช้แอปแล้ว" badge. */
export async function linkedOwnerIds() {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const r = await apiFetch(`/api/clinic-links/owners?store_id=${storeId}`).catch(() => null);
  return new Map((r?.data || []).map(x => [x.owner_id, x.user_id]));
}

const CATS = ['profile', 'health', 'vaccines', 'scans'];
const sharedCount = c => CATS.filter(k => c?.[k] === true).length;
function shareChip(consent) {
  const n = sharedCount(consent);
  return `<span class="cl-share ${n ? 'is-on' : ''}">${esc(n ? T('sharedN', { n }) : T('notShared'))}</span>`;
}

/** Pets with the categories in d.consent: profile, allergies, health notes, App vaccines, AI scans. */
function petsHtml(d) {
  const day = iso => iso ? new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }) : '—';
  const empty = `<p class="cl-muted">${esc(T('noItems'))}</p>`;
  const tr = (prefix, v) => (v && S[`${prefix}${String(v).toLowerCase()}`] ? T(`${prefix}${String(v).toLowerCase()}`) : v);
  const forPet = (list, id) => (list || []).filter(x => x.pet_id === id);
  const field = (k, v) => v === null || v === undefined || v === '' ? '' : `<div><dt>${esc(T(k))}</dt><dd>${esc(v)}</dd></div>`;
  const pets = (d.pets || []).map(p => {
    const prof = d.consent.profile ? `<dl class="cl-fields">
        ${field('f_weight', p.weight_kg != null ? T('kg', { n: p.weight_kg }) : null)}${field('f_dob', p.dob ? day(p.dob) : null)}
        ${field('f_gender', tr('g_', p.gender))}${field('f_neutered', p.is_neutered == null ? null : T(p.is_neutered ? 'yes' : 'no'))}
        ${field('f_microchip', p.microchip_no)}</dl>
        ${p.allergies ? `<p class="cl-alert">${icon('exclamation-triangle', 'w-4 h-4')}<b>${esc(T('f_allergies'))}:</b> ${esc(p.allergies)}</p>` : ''}
        ${p.notes ? `<p class="cl-muted"><b>${esc(T('f_notes'))}:</b> ${esc(p.notes)}</p>` : ''}` : '';
    const health = d.consent.health ? `<h4>${esc(T('cat_health'))}</h4>${forPet(d.health, p.id).length ? `<ul class="cl-items">${forPet(d.health, p.id).map(h => `
        <li><time>${esc(day(h.date))}</time><span><b>${esc(h.title || h.record_type)}</b>${h.description ? `<small>${esc(h.description)}</small>` : ''}</span></li>`).join('')}</ul>` : empty}` : '';
    const vacc = d.consent.vaccines ? `<h4>${esc(T('cat_vaccines'))}</h4>${forPet(d.vaccines, p.id).length ? `<ul class="cl-items">${forPet(d.vaccines, p.id).map(v => `
        <li><time>${esc(day(v.date_administered))}</time><span><b>${esc(v.vaccine_name)}</b><small>${[v.location, v.veterinarian].filter(Boolean).map(esc).join(' · ')}${v.next_due_date ? `${v.location || v.veterinarian ? ' · ' : ''}${esc(T('nextDue', { date: day(v.next_due_date) }))}` : ''}</small></span></li>`).join('')}</ul>` : empty}` : '';
    const scans = d.consent.scans ? `<h4>${esc(T('cat_scans'))}</h4>${forPet(d.scans, p.id).length ? `<ul class="cl-items">${forPet(d.scans, p.id).map(x => `
        <li><time>${esc(day(x.at))}</time><span><b>${esc(x.diagnosis || '—')}</b><small>${[x.body_part, x.confidence != null ? `${Math.round(x.confidence * (x.confidence <= 1 ? 100 : 1))}%` : '', x.triage_level].filter(Boolean).map(esc).join(' · ')}</small></span></li>`).join('')}</ul>` : empty}` : '';
    return `<section class="cl-pet">
      <header><span class="cl-avatar">${esc((p.name || '?').charAt(0).toUpperCase())}</span><div><b>${esc(p.name)}</b><small>${[tr('sp_', p.species), p.breed, p.hn ? `HN ${p.hn}` : ''].filter(Boolean).map(esc).join(' · ')}</small></div></header>
      ${prof}${health}${vacc}${scans}</section>`;
  }).join('');
  return pets || empty;
}

/** Read-only view of what a linked customer shares from the App (phase 3). The server logs each view. */
export async function openSharedSheet({ userId, name }) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const sheet = openSheet({ title: T('sharedTitle', { name }) });
  sheet.body.innerHTML = `<div class="cl-skel"></div>`;
  const r = await apiFetch(`/api/clinic-links/shared?store_id=${storeId}&user_id=${encodeURIComponent(userId)}`).catch(() => null);
  const d = r?.data;
  if (!r?.success || !d?.ok) { sheet.body.innerHTML = `<p class="text-sm text-red-600">${esc(T(d?.code === 'plan_paused' ? 'planPaused' : 'failed'))}</p>`; return; }
  const n = sharedCount(d.consent);
  const chips = `<div class="cl-cats">${CATS.map(k => `<span class="${d.consent?.[k] ? 'is-on' : ''}">${d.consent?.[k] ? icon('check-circle', 'w-3.5 h-3.5') : ''}${esc(T(`cat_${k}`))}</span>`).join('')}</div>`;
  if (!n) {
    sheet.body.innerHTML = `${chips}<p class="cl-shared-empty">${icon('shield-alt', 'w-5 h-5')}${esc(T('sharedNone'))}</p>`;
    sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('close'))}</button>`;
    return;
  }
  const day = iso => iso ? new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }) : '—';
  const pets = petsHtml(d);
  sheet.body.innerHTML = `${chips}${d.shared_at ? `<p class="cl-muted">${esc(T('sharedAt', { date: day(d.shared_at) }))}</p>` : ''}${pets}
    <p class="cl-note">${icon('shield-alt', 'w-4 h-4')}${esc(T('sharedFoot'))}</p>`;
  sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('close'))}</button>`;
}

export const linkText = k => T(k);

const fmtTime = iso => new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

/** Emergency share (phase 4): staff type the customer's 6-character code (or arrive from its QR) to see App data. */
export async function openEmergencySheet(prefill = '') {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const sheet = openSheet({ title: T('emTitle') });
  const showData = d => {
    sheet.body.innerHTML = `
      <p class="cl-em-banner">${icon('exclamation-triangle', 'w-4 h-4')}${esc(T('emBanner', { until: fmtTime(d.expires_at) }))}</p>
      ${d.owner?.name ? `<p class="cl-em-owner"><b>${esc(T('emOwner'))}:</b> ${esc(d.owner.name)}${d.owner.phone ? ` · <a href="tel:${esc(String(d.owner.phone).replace(/[^\d+]/g, ''))}">${esc(d.owner.phone)}</a>` : ''}</p>` : ''}
      ${petsHtml(d)}
      <p class="cl-note">${icon('shield-alt', 'w-4 h-4')}${esc(T('emFoot'))}</p>`;
    sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('close'))}</button>`;
  };
  const showForm = async (error = '') => {
    const list = await apiFetch(`/api/clinic-links/emergency?store_id=${storeId}`).catch(() => null);
    const cases = list?.data || [];
    sheet.body.innerHTML = `
      <form class="cl-em-form" data-form>
        <p class="cl-how">${esc(T('emHow'))}</p>
        <label class="cx-field"><span>${esc(T('emCode'))}</span>
          <input class="cl-em-input" name="code" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC123" value="${esc(prefill)}"></label>
        ${error ? `<p class="text-sm text-red-600" role="alert">${esc(error)}</p>` : ''}
        <button type="submit" class="ph-btn is-primary">${esc(T('emOpen'))}</button>
      </form>
      ${cases.length ? `<div class="cl-em-cases"><p class="cl-people__head">${esc(T('emOpenCases'))}</p><ul>${cases.map(c => `
        <li><button type="button" class="cl-person" data-case="${esc(c.id)}"><span class="cl-avatar">${icon('exclamation-triangle', 'w-4 h-4')}</span>
          <span class="min-w-0 flex-1"><small>${esc(T('emCase', { n: c.pet_ids.length, opened: fmtTime(c.claimed_at), until: fmtTime(c.expires_at) }))}</small></span></button></li>`).join('')}</ul></div>` : ''}`;
    sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>${esc(T('close'))}</button>`;
    const input = sheet.body.querySelector('input[name=code]');
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
    sheet.body.querySelector('[data-form]').onsubmit = async e => {
      e.preventDefault();
      if (input.value.length !== 6) { showForm(T('emBad')); return; }
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
      const r = await apiFetch('/api/clinic-links/emergency', { method: 'POST', body: JSON.stringify({ store_id: storeId, code: input.value }) }).catch(() => null);
      if (r?.data?.ok) { prefill = ''; showData(r.data); return; }
      prefill = input.value;
      showForm(T(r?.data?.code === 'too_many_attempts' ? 'emLocked' : r?.data?.code === 'invalid_code' || r?.code === 'invalid_code' ? 'emBad' : 'failed'));
    };
    sheet.body.querySelectorAll('[data-case]').forEach(b => b.addEventListener('click', async () => {
      const r = await apiFetch(`/api/clinic-links/emergency/${b.dataset.case}?store_id=${storeId}`).catch(() => null);
      if (r?.data?.ok) showData(r.data); else showForm(T('emBad'));
    }));
    if (!error) input.focus();
  };
  sheet.body.innerHTML = `<div class="cl-skel"></div>`;
  await showForm();
  if (prefill.length === 6) sheet.body.querySelector('[data-form]')?.requestSubmit();
}
