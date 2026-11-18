// Shared pieces for Pet Hotel and Grooming: 5-language text, pet/owner picker, small form helpers.
// Styles: .st-* in src/css/input.css (theme tokens, so dark mode follows).
import { apiFetch } from '../utils/api-client.js';
import { getLang, locale } from './portal-i18n.js';
import { icon, speciesIcon } from '../utils/icons.js';
export { icon };

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const baht = n => `฿${Number(n || 0).toLocaleString(locale(), { maximumFractionDigits: 2 })}`;
export const todayBkk = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const nightsBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export const fmtDay = (d, opts = { day: 'numeric', month: 'short' }) => new Date(`${d}T12:00:00+07:00`).toLocaleDateString(locale(), { timeZone: 'Asia/Bangkok', ...opts });
export const fmtTime = iso => new Date(iso).toLocaleTimeString(locale(), { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

// [th, en, zh, ja, ko]
const S = {
  dog: ['สุนัข', 'Dog', '狗', '犬', '강아지'], cat: ['แมว', 'Cat', '猫', '猫', '고양이'], rabbit: ['กระต่าย', 'Rabbit', '兔子', 'うさぎ', '토끼'], bird: ['นก', 'Bird', '鸟', '鳥', '새'], other: ['อื่น ๆ', 'Other', '其他', 'その他', '기타'],
  save: ['บันทึก', 'Save', '保存', '保存', '저장'], cancel: ['ยกเลิก', 'Cancel', '取消', 'キャンセル', '취소'], close: ['ปิด', 'Close', '关闭', '閉じる', '닫기'],
  edit: ['แก้ไข', 'Edit', '编辑', '編集', '수정'], add: ['เพิ่ม', 'Add', '添加', '追加', '추가'], remove: ['ลบ', 'Remove', '删除', '削除', '삭제'],
  loading: ['กำลังโหลด…', 'Loading…', '加载中…', '読み込み中…', '불러오는 중…'], loadFail: ['โหลดข้อมูลไม่สำเร็จ', 'Could not load', '加载失败', '読み込めません', '불러오지 못했어요'],
  retry: ['ลองใหม่', 'Try again', '重试', '再試行', '다시 시도'], saved: ['บันทึกแล้ว', 'Saved', '已保存', '保存しました', '저장했어요'], failed: ['ทำรายการไม่สำเร็จ', 'Something went wrong', '操作失败', 'うまくいきませんでした', '처리하지 못했어요'],
  pet: ['น้อง', 'Pet', '宠物', 'ペット', '반려동물'], petName: ['ชื่อน้อง', 'Pet name', '宠物名', 'ペット名', '이름'], species: ['ชนิด', 'Species', '种类', '種類', '종류'],
  owner: ['เจ้าของ', 'Owner', '主人', '飼い主', '보호자'], ownerName: ['ชื่อเจ้าของ', 'Owner name', '主人姓名', '飼い主名', '보호자 이름'], phone: ['เบอร์โทร', 'Phone', '电话', '電話', '전화'],
  searchPet: ['ค้นหาน้อง เจ้าของ หรือเบอร์โทร', 'Search pet, owner or phone', '搜索宠物、主人或电话', 'ペット・飼い主・電話で検索', '반려동물, 보호자, 전화번호 검색'],
  newPet: ['ลูกค้าใหม่ / ไม่มีในระบบ', 'New customer', '新顾客', '新規のお客様', '신규 고객'], change: ['เปลี่ยน', 'Change', '更换', '変更', '변경'],
  noResult: ['ไม่พบ ลองพิมพ์ชื่อหรือเบอร์อื่น', 'No match. Try another name or number', '没有结果', '見つかりません', '결과가 없어요'],
  breed: ['สายพันธุ์', 'Breed', '品种', '犬種・猫種', '품종'], age: ['อายุ', 'Age', '年龄', '年齢', '나이'], weight: ['น้ำหนัก', 'Weight', '体重', '体重', '체중'],
  allergies: ['แพ้', 'Allergies', '过敏', 'アレルギー', '알레르기'], neutered: ['ทำหมันแล้ว', 'Neutered', '已绝育', '避妊・去勢済み', '중성화'], yrs: ['ปี', 'y', '岁', '歳', '세'], kg: ['กก.', 'kg', '公斤', 'kg', 'kg'],
  notes: ['หมายเหตุ', 'Notes', '备注', 'メモ', '메모'], reason: ['เหตุผล', 'Reason', '原因', '理由', '사유'], reasonMin: ['ใส่เหตุผลอย่างน้อย 3 ตัวอักษร', 'Enter at least 3 characters', '至少 3 个字符', '3文字以上入力', '3자 이상 입력'],
  fromApp: ['จองผ่านแอป', 'Booked in app', '应用预约', 'アプリ予約', '앱 예약'], appSyncFail: ['บันทึกแล้ว แต่ปรับสถานะในแอปไม่สำเร็จ', 'Saved, but the App booking status did not update', '已保存，但应用状态未更新', '保存しましたがアプリの状態は更新されませんでした', '저장했지만 앱 예약 상태는 바뀌지 않았어요'],
  confirmTitle: ['ยืนยัน', 'Confirm', '确认', '確認', '확인'],
};
export const T = (key, vars = {}) => {
  const row = S[key] || STRINGS[key];
  if (!row) return key;
  const i = ['th', 'en', 'zh', 'ja', 'ko'].indexOf(getLang());
  return String(row[i] ?? row[1] ?? row[0]).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
};
const STRINGS = {};
/** Each page registers its own strings with the same [th, en, zh, ja, ko] shape. */
export const addStrings = rows => Object.assign(STRINGS, rows);

export const speciesLabel = s => T(['dog', 'cat', 'rabbit', 'bird'].includes(s) ? s : 'other');
// Outline dog / cat glyphs (Lucide, ISC licence). The shared icon set's dog is a fill path that draws badly as a stroke.
const PET_PATHS = {
  dog: ['M11.25 16.25h1.5L12 17z', 'M16 14v.5', 'M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309', 'M8 14v.5', 'M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5'],
  cat: ['M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z', 'M8 14v.5', 'M16 14v.5', 'M11.25 16.25h1.5L12 17l-.75-.75Z'],
};
export const petIcon = (species, cls = 'w-5 h-5') => PET_PATHS[species]
  ? `<svg class="${cls} flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PET_PATHS[species].map(d => `<path d="${d}"/>`).join('')}</svg>`
  : speciesIcon(species, cls);

/** Pet picture: photo when there is one, otherwise a line icon on a species tint. */
export const petAvatar = (species, url = null, size = '') => {
  const tint = { dog: 'is-dog', cat: 'is-cat' }[species] || 'is-other';
  return `<span class="st-avatar ${tint} ${size}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : petIcon(species, size === 'is-sm' ? 'w-4 h-4' : size === 'is-lg' ? 'w-7 h-7' : 'w-5 h-5')}</span>`;
};
/** Kept for older callers: returns the same avatar markup without the wrapper. */
export const speciesEmoji = s => petIcon(s, 'w-5 h-5');

/** Translates API error codes; Thai server messages are shown as-is only in Thai. */
export function apiError(res, fallback = 'failed') {
  const code = res?.code;
  if (code && (S[code] || STRINGS[code])) return T(code);
  return getLang() === 'th' && res?.error && /[฀-๿]/.test(res.error) ? res.error : T(fallback);
}

export function ageText(pet) {
  if (pet?.dob) {
    const months = Math.max(0, Math.floor((Date.now() - Date.parse(pet.dob)) / (30.44 * 86400000)));
    return months >= 12 ? `${Math.floor(months / 12)} ${T('yrs')}` : `${months} m`;
  }
  return pet?.age ? `${pet.age} ${T('yrs')}` : '';
}

/** One-line pet summary chips (breed · age · weight · neutered · allergies). */
export function petFacts(pet) {
  if (!pet) return '';
  const facts = [pet.breed, ageText(pet), pet.weight_kg ? `${pet.weight_kg} ${T('kg')}` : '', pet.is_neutered ? T('neutered') : ''].filter(Boolean);
  return `<div class="st-facts">${facts.map(f => `<span>${esc(f)}</span>`).join('')}${pet.allergies ? `<span class="is-warn">${icon('exclamation-triangle', 'w-3.5 h-3.5')}${esc(T('allergies'))}: ${esc(pet.allergies)}</span>` : ''}</div>`;
}

/**
 * Pet + owner picker. Search existing customers or type a new one.
 * Returns { el, get() → { pet_id, pet_name, species, owner_name, owner_phone, pet } | null }.
 */
export function petPicker({ storeId, initial = null, onChange } = {}) {
  const el = document.createElement('div');
  el.className = 'st-picker';
  let chosen = initial;
  let manual = Boolean(initial && !initial.pet_id);
  let timer = null;

  const render = () => {
    if (chosen && !manual) {
      el.innerHTML = `
        <div class="st-chosen">
          ${petAvatar(chosen.species, chosen.pet?.avatar_url)}
          <div class="min-w-0 flex-1">
            <p class="st-strong">${esc(chosen.pet_name)} <span class="st-muted">· ${esc(speciesLabel(chosen.species))}</span></p>
            ${chosen.owner_name || chosen.owner_phone ? `<p class="st-muted">${esc([chosen.owner_name, chosen.owner_phone].filter(Boolean).join(' · '))}</p>` : ''}
            ${petFacts(chosen.pet)}
          </div>
          <button type="button" class="ph-btn" data-change>${esc(T('change'))}</button>
        </div>`;
      el.querySelector('[data-change]').onclick = () => { chosen = null; render(); onChange?.(null); };
      return;
    }
    if (manual) {
      const v = chosen || {};
      el.innerHTML = `
        <div class="st-grid2">
          <label class="cx-field"><span>${esc(T('petName'))} *</span><input data-f="pet_name" value="${esc(v.pet_name || '')}" maxlength="120" required></label>
          <label class="cx-field"><span>${esc(T('species'))}</span><select data-f="species" class="st-select">${['dog', 'cat', 'rabbit', 'bird', 'other'].map(s => `<option value="${s}" ${v.species === s ? 'selected' : ''}>${esc(speciesLabel(s))}</option>`).join('')}</select></label>
          <label class="cx-field"><span>${esc(T('ownerName'))}</span><input data-f="owner_name" value="${esc(v.owner_name || '')}" maxlength="120"></label>
          <label class="cx-field"><span>${esc(T('phone'))}</span><input data-f="owner_phone" value="${esc(v.owner_phone || '')}" inputmode="tel" maxlength="30"></label>
        </div>
        <button type="button" class="st-link" data-search>← ${esc(T('searchPet'))}</button>`;
      el.querySelectorAll('[data-f]').forEach(i => { i.oninput = () => onChange?.(get()); });
      el.querySelector('[data-search]').onclick = () => { manual = false; chosen = null; render(); onChange?.(null); };
      return;
    }
    el.innerHTML = `
      <input class="cx-search" type="search" data-q placeholder="${esc(T('searchPet'))}" autocomplete="off">
      <div class="st-results" data-results></div>
      <button type="button" class="st-link" data-manual>+ ${esc(T('newPet'))}</button>`;
    const q = el.querySelector('[data-q]');
    q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => search(q.value.trim()), 250); };
    el.querySelector('[data-manual]').onclick = () => { manual = true; chosen = null; render(); onChange?.(null); };
    search('');
  };

  async function search(term) {
    const box = el.querySelector('[data-results]');
    if (!box) return;
    box.innerHTML = `<p class="st-muted st-pad">${esc(T('loading'))}</p>`;
    const res = await apiFetch(`/api/pets/owners/search?store_id=${storeId}&q=${encodeURIComponent(term)}`).catch(() => null);
    const owners = res?.data || res?.owners || (Array.isArray(res) ? res : []);
    const rows = owners.flatMap(o => (o.pets || []).map(p => ({ o, p }))).slice(0, 12);
    if (!rows.length) { box.innerHTML = `<p class="st-muted st-pad">${esc(term ? T('noResult') : '')}</p>`; return; }
    box.innerHTML = rows.map(({ o, p }, i) => `
      <button type="button" class="st-result" data-i="${i}">
        ${petAvatar(p.species, null, 'is-sm')}
        <span class="min-w-0 flex-1 text-left"><span class="st-strong">${esc(p.name)}</span> <span class="st-muted">${esc(p.breed || speciesLabel(p.species))}</span>
          <span class="st-muted block truncate">${esc([o.name, o.phone].filter(Boolean).join(' · '))}</span></span>
        ${p.allergies ? `<span class="st-warnline">${icon('exclamation-triangle', 'w-3.5 h-3.5')}${esc(T('allergies'))}</span>` : ''}
      </button>`).join('');
    box.querySelectorAll('[data-i]').forEach(btn => {
      btn.onclick = async () => {
        const { o, p } = rows[Number(btn.dataset.i)];
        chosen = { pet_id: p.id, pet_name: p.name, species: p.species || 'dog', owner_name: o.name || '', owner_phone: o.phone || '', pet: p };
        render(); onChange?.(get());
        // Full profile (age, weight, neutered…) for the summary and care sheet
        const full = await apiFetch(`/api/pets/${p.id}?store_id=${storeId}`).catch(() => null);
        const pet = full?.data?.pet || full?.data || null;
        if (pet && chosen?.pet_id === p.id) { chosen.pet = { ...p, ...pet }; render(); onChange?.(get()); }
      };
    });
  }

  function get() {
    if (manual) {
      const val = k => el.querySelector(`[data-f="${k}"]`)?.value.trim() || '';
      if (!val('pet_name')) return null;
      return { pet_id: null, pet_name: val('pet_name'), species: val('species') || 'dog', owner_name: val('owner_name'), owner_phone: val('owner_phone'), pet: null };
    }
    return chosen;
  }

  render();
  return { el, get };
}

/** Small reason prompt used for cancel. Resolves to the text or null. */
export function askReason(openSheet, { title, presets = [] }) {
  return new Promise(resolve => {
    const sheet = openSheet({ title, onClose: () => resolve(null) });
    sheet.body.innerHTML = `
      <div class="st-presets">${presets.map(p => `<button type="button" class="so-tab" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>
      <label class="cx-field"><span>${esc(T('reason'))}</span><textarea rows="3" maxlength="300" data-r></textarea></label>
      <p class="st-muted st-hint" data-h hidden>${esc(T('reasonMin'))}</p>`;
    sheet.foot.innerHTML = `<button type="button" class="ph-btn" data-sh-close>${esc(T('close'))}</button><span class="flex-1"></span><button type="button" class="ph-btn is-danger" data-ok>${esc(T('confirmTitle'))}</button>`;
    const r = sheet.body.querySelector('[data-r]');
    sheet.body.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => { r.value = b.dataset.p; }; });
    sheet.foot.querySelector('[data-ok]').onclick = () => {
      const v = r.value.trim();
      if (v.length < 3) { sheet.body.querySelector('[data-h]').hidden = false; r.focus(); return; }
      resolve(v); sheet.close();
    };
  });
}
