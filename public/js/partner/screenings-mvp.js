import { apiFetch } from '../utils/api-client.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { storage } from '../utils/storage.js';
import { showToast } from '../utils/toast.js';
import { escapeHtml } from '../utils/formatters.js';

const buckets = { new: 'เคสใหม่', active: 'กำลังติดตาม', history: 'ประวัติ' };
const urgency = {
  emergency: { label: 'เร่งด่วน · ทันที', css: 'bg-red-50 text-red-700 ring-red-200' },
  vet_24_48h: { label: 'พบสัตวแพทย์ · 24–48 ชม.', css: 'bg-amber-50 text-amber-800 ring-amber-200' },
  monitor: { label: 'เฝ้าดูอาการ', css: 'bg-blue-50 text-blue-700 ring-blue-200' },
  no_clear_abnormality: { label: 'ไม่พบสิ่งผิดปกติชัดเจน', css: 'bg-success-faint text-success-strong ring-success-subtle' },
};
const statusLabels = { requested: 'รอพิจารณา', accepted: 'รับเคสแล้ว', declined: 'ไม่รับเคส', completed: 'ตรวจทานแล้ว', cancelled: 'ยกเลิก' };
const bodyLabels = { Eyes: 'ดวงตา', Ear: 'หู', Dental: 'ฟันและช่องปาก', Skin: 'ผิวหนัง' };
const symptomLabels = {
  vision_or_eye_shape_change: 'ตาโปน / มองไม่เห็นกะทันหัน / มีแผล', severe_eye_pain: 'ลืมตาไม่ได้หรือเจ็บมาก', chemical_eye_exposure: 'สารเคมีเข้าตา', eye_discharge_or_redness: 'ตาแดงหรือมีขี้ตา', squinting_or_rubbing_eye: 'หรี่ตาหรือถูตา',
  balance_or_head_tilt: 'เดินเซหรือศีรษะเอียง', ear_bleeding_or_severe_pain: 'เลือดออกหรือเจ็บหูมาก', ear_discharge_or_odor: 'มีของเหลวหรือกลิ่นจากหู', head_shaking_or_scratching: 'สะบัดหัวหรือเกาหู', hearing_change: 'การตอบสนองต่อเสียงเปลี่ยน',
  breathing_swallowing_or_heavy_bleeding: 'หายใจ/กลืนลำบากหรือเลือดออกมาก', facial_swelling_or_jaw_injury: 'หน้าบวมหรือขากรรไกรบาดเจ็บ', not_eating_or_drooling: 'กินลำบากหรือมีน้ำลายมาก', red_gums_or_bad_breath: 'เหงือกแดงหรือมีกลิ่นปาก', broken_tooth_or_mouth_rubbing: 'ฟันหักหรือถูปาก',
};
const answerLabels = { yes: 'ใช่', no: 'ไม่ใช่', unsure: 'ไม่แน่ใจ' };

let bucket = 'new';
let searchText = '';
let reviewingId = null;

export async function renderScreenings(container) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  if (!storeId) { container.innerHTML = '<div class="card p-6">ไม่พบข้อมูลคลินิกที่กำลังใช้งาน</div>'; return; }
  container.innerHTML = '<div class="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">กำลังโหลดเคสส่งต่อ…</div>';
  try {
    const response = await apiFetch(`/api/screenings?store_id=${encodeURIComponent(storeId)}&bucket=${bucket}`);
    const rows = response.data || [];
    const filtered = searchText.trim() ? rows.filter(row => `${row.pet?.name || ''} ${row.owner_contact?.name || ''} ${row.body_part || ''}`.toLowerCase().includes(searchText.trim().toLowerCase())) : rows;
    container.innerHTML = layout(filtered, rows.length);
    bind(container);
  } catch (error) {
    container.innerHTML = `<div class="rounded-2xl border border-red-200 bg-white p-6"><p class="font-semibold text-red-700">โหลดเคสไม่สำเร็จ</p><p class="mt-1 text-sm text-slate-500">${escapeHtml(error.message || 'กรุณาลองใหม่')}</p><button id="screening-retry" class="btn-primary mt-4">ลองอีกครั้ง</button></div>`;
    container.querySelector('#screening-retry').onclick = () => renderScreenings(container);
  }
}

function layout(rows, total) {
  const counts = { requested: 0, accepted: 0, completed: 0 };
  rows.forEach(row => { if (counts[row.referral_status] != null) counts[row.referral_status] += 1; });
  return `<div class="mx-auto max-w-6xl space-y-5">
    <section class="rounded-3xl bg-gradient-to-br from-brand-strong to-brand p-6 text-white shadow-sm sm:p-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div><p class="text-xs font-bold uppercase tracking-[.18em] text-brand-subtle">FUFU · CLINIC WORKSPACE</p><h1 class="mt-2 text-2xl font-bold sm:text-3xl">เคสคัดกรองที่ส่งถึงคลินิก</h1><p class="mt-2 max-w-2xl text-sm leading-6 text-brand-faint">ดูระดับเร่งด่วน อาการที่เจ้าของแจ้ง และภาพประกอบ แล้วบันทึกผลประเมินจากสัตวแพทย์ไว้เป็น feedback</p></div>
        <div class="rounded-2xl bg-white/10 px-4 py-3"><p class="text-xs text-brand-subtle">รายการในหน้านี้</p><p class="mt-1 text-2xl font-bold">${total}</p></div>
      </div>
      <p class="mt-5 rounded-xl bg-white/10 px-3 py-2 text-xs leading-5 text-brand-faint">ผล AI เป็นข้อมูลคัดกรองเบื้องต้น คลินิกเป็นผู้ประเมินและวินิจฉัยขั้นสุดท้าย</p>
    </section>

    <section class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      ${metric('รอพิจารณา', counts.requested, 'text-amber-700', 'bg-amber-50')}
      ${metric('รับเคสแล้ว', counts.accepted, 'text-blue-700', 'bg-blue-50')}
      ${metric('ตรวจทานแล้ว', counts.completed, 'text-success-strong', 'bg-success-faint')}
    </section>

    <section class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div class="flex flex-wrap gap-2">${Object.entries(buckets).map(([key, label]) => `<button type="button" data-bucket="${key}" aria-pressed="${bucket === key}" class="min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors ${bucket === key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${label}</button>`).join('')}</div>
      <label class="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 sm:w-72"><span class="sr-only">ค้นหาเคส</span><svg aria-hidden="true" class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke-width="2"/><path d="m16 16 4 4" stroke-width="2"/></svg><input id="screening-search" value="${escapeHtml(searchText)}" placeholder="ค้นหาชื่อสัตว์หรือผู้ส่ง" class="w-full border-0 bg-transparent text-sm outline-none focus:ring-0" /></label>
    </section>
    <section class="space-y-3" aria-live="polite">${rows.length ? rows.map(card).join('') : `<div class="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.36-6.36-2.12 2.12M7.76 16.24l-2.12 2.12m12.72 0-2.12-2.12M7.76 7.76 5.64 5.64"/></svg></div><h2 class="mt-3 font-semibold text-slate-800">ยังไม่มีเคสในหมวดนี้</h2><p class="mt-1 text-sm text-slate-500">เมื่อเจ้าของสัตว์ส่งผลคัดกรองมาที่คลินิก เคสจะแสดงตรงนี้</p></div>`}</section>
  </div>`;
}

function metric(label, count, color, bg) {
  return `<article class="rounded-2xl border border-slate-200 bg-white p-4"><div class="flex items-center justify-between"><span class="text-sm font-medium text-slate-600">${label}</span><span class="flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color}"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M5 12h14M12 5v14"/></svg></span></div><p class="mt-3 text-2xl font-bold text-slate-900">${count}</p></article>`;
}

function card(row) {
  const pet = row.pet || {};
  const contact = row.owner_contact || {};
  const level = urgency[row.triage_level] || urgency.vet_24_48h;
  const status = statusLabels[row.referral_status] || row.referral_status;
  const date = row.referred_at ? new Date(row.referred_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const resultSummary = row.result_json?.summary || row.diagnosis || 'ยังไม่มีผล AI ที่อ่านได้';
  const answers = Object.entries(row.symptom_answers || {}).map(([key, value]) => `<li class="flex justify-between gap-4 border-t border-slate-100 py-2"><span>${escapeHtml(symptomLabels[key] || key.replaceAll('_', ' '))}</span><strong class="shrink-0 font-semibold">${escapeHtml(answerLabels[value] || value)}</strong></li>`).join('');
  const image = row.image_url ? `<img src="${escapeHtml(row.image_url)}" alt="ภาพคัดกรองบริเวณ ${escapeHtml(bodyLabels[row.body_part] || row.body_part)} ของ ${escapeHtml(pet.name || 'สัตว์เลี้ยง')}" class="h-48 w-full rounded-xl bg-slate-100 object-cover sm:h-full sm:min-h-48" loading="lazy" />` : `<div class="flex h-48 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">ไม่มีภาพแนบ</div>`;
  const form = reviewingId === row.id ? reviewForm(row) : '';
  const actions = row.referral_status === 'requested'
    ? `<button type="button" data-review="${row.id}" class="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">ตรวจเคสนี้</button>`
    : row.referral_status === 'accepted'
      ? `<button type="button" data-review="${row.id}" data-complete="true" class="min-h-11 rounded-xl border border-brand px-4 text-sm font-bold text-brand-strong hover:bg-brand-faint">บันทึกผลหลังติดต่อแล้ว</button>`
      : '';
  const assessment = row.vet_assessment ? `<div class="mt-3 rounded-xl bg-slate-50 p-3"><p class="text-xs font-bold text-slate-500">บันทึกสัตวแพทย์</p><p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">${escapeHtml(row.vet_assessment)}</p></div>` : '';

  return `<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div class="grid gap-4 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:p-5">${image}<div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2"><span class="rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${level.css}">${level.label}</span><span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">${status}</span><span class="ml-auto text-xs text-slate-400">${date}</span></div>
      <div class="mt-3 flex flex-wrap items-start justify-between gap-2"><div><h2 class="text-lg font-bold text-slate-900">${escapeHtml(pet.name || 'สัตว์เลี้ยง')}</h2><p class="mt-0.5 text-sm text-slate-500">${escapeHtml(pet.species || '')}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ''} · บริเวณ${escapeHtml(bodyLabels[row.body_part] || row.body_part)}</p></div><span class="rounded-lg bg-brand-faint px-2.5 py-1 text-xs font-semibold text-brand-strong">AI: ${escapeHtml(row.screening_status || 'ประเมินไม่ได้')}</span></div>
      <p class="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">${escapeHtml(resultSummary)}</p>
      <details class="mt-3"><summary class="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-strong">คำตอบอาการและข้อมูลผู้ติดต่อ</summary><div class="grid gap-4 border-t border-slate-100 pt-3 md:grid-cols-2"><div><p class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">อาการที่แจ้ง</p><ul class="text-xs leading-5 text-slate-600">${answers || '<li>ไม่มีคำตอบ</li>'}</ul>${row.owner_note ? `<p class="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">${escapeHtml(row.owner_note)}</p>` : ''}</div><div><p class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">ผู้ติดต่อ</p><p class="text-sm font-semibold text-slate-800">${escapeHtml(contact.name || 'ไม่ระบุชื่อ')}</p><p class="mt-1 text-sm text-slate-600">${contact.phone ? `<a class="underline" href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a>` : 'ไม่ระบุโทรศัพท์'}</p><p class="text-sm text-slate-600">${contact.email ? `<a class="underline" href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>` : 'ไม่ระบุอีเมล'}</p><p class="mt-2 text-xs text-slate-400">มีความยินยอมแชร์ข้อมูล: ${row.referral_consent_at ? new Date(row.referral_consent_at).toLocaleString('th-TH') : '—'}</p></div></div></details>
      ${assessment}<div class="mt-4 flex flex-wrap items-center gap-2">${actions}</div>${form}
    </div></div>
  </article>`;
}

function reviewForm(row) {
  const status = row.referral_status === 'accepted' ? 'completed' : 'accepted';
  return `<form data-review-form="${row.id}" data-next-status="${status}" class="mt-4 space-y-3 rounded-2xl border border-brand-subtle bg-brand-faint/70 p-4">
    <h3 class="text-sm font-bold text-slate-900">บันทึกการประเมินโดยสัตวแพทย์</h3>
    <label class="block text-xs font-semibold text-slate-700">ผลเทียบกับ AI<select name="match" class="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="confirmed">สอดคล้องกับผล AI</option><option value="changed">ปรับผลประเมิน</option><option value="uncertain">ยังสรุปไม่ได้</option></select></label>
    <label class="block text-xs font-semibold text-slate-700">ผลประเมิน/สิ่งที่คลินิกดำเนินการ<textarea name="assessment" required minlength="3" maxlength="5000" rows="3" class="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" placeholder="สรุปผลที่ตรวจสอบได้ หรือสิ่งที่ต้องติดตาม"></textarea></label>
    <label class="block text-xs font-semibold text-slate-700">ผลที่สัตวแพทย์เห็น (ถ้าต่างจาก AI)<input name="diagnosis" maxlength="500" class="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" placeholder="ระบุผลประเมินโดยสัตวแพทย์" /></label>
    <div class="flex flex-wrap gap-2"><button name="action" value="${status}" class="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">${status === 'completed' ? 'บันทึกผลและปิดเคส' : 'รับเคสและบันทึกผล'}</button>${status === 'accepted' ? '<button name="action" value="declined" class="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">ไม่รับเคสนี้</button>' : ''}<button type="button" data-review-cancel class="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-500 hover:bg-white">ยกเลิก</button></div>
  </form>`;
}

function bind(container) {
  container.querySelectorAll('[data-bucket]').forEach(button => button.addEventListener('click', () => { bucket = button.dataset.bucket; reviewingId = null; renderScreenings(container); }));
  const search = container.querySelector('#screening-search');
  search?.addEventListener('input', () => { searchText = search.value; const cardList = container.querySelectorAll('article'); cardList.forEach(card => { card.classList.toggle('hidden', !card.textContent.toLowerCase().includes(searchText.toLowerCase())); }); });
  container.querySelectorAll('[data-review]').forEach(button => button.addEventListener('click', () => { reviewingId = reviewingId === button.dataset.review ? null : button.dataset.review; renderScreenings(container); }));
  container.querySelector('[data-review-cancel]')?.addEventListener('click', () => { reviewingId = null; renderScreenings(container); });
  container.querySelectorAll('[data-review-form]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const submitter = event.submitter;
    const action = submitter?.value || form.dataset.nextStatus;
    const fields = new FormData(form);
    const assessment = String(fields.get('assessment') || '').trim();
    if (assessment.length < 3) return;
    submitter.disabled = true;
    try {
      await apiFetch(`/api/screenings/${form.dataset.reviewForm}`, {
        method: 'PATCH', headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ status: action, assessment, feedback: { match: fields.get('match'), diagnosis: fields.get('diagnosis') } }),
      });
      showToast(action === 'declined' ? 'บันทึกว่าไม่รับเคสแล้ว' : 'บันทึกผลสัตวแพทย์แล้ว', 'success');
      reviewingId = null;
      renderScreenings(container);
    } catch (error) {
      showToast(error.message || 'บันทึกผลไม่สำเร็จ', 'error');
      submitter.disabled = false;
    }
  }));
}
