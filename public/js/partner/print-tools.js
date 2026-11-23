// Print sheets for the exam room and the pet profile:
//   openLabelSheet       — drug labels, 50×30 mm sticker or 58 mm roll (choice remembered on this device)
//   openCertificateSheet — vaccination / health / medical-opinion certificate (A4, print or save as PDF)
// Templates: public/js/utils/print-docs.js. Vets and licence numbers: server/routes/certificates.js.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { printDrugLabels, printCertificate, rxInstruction } from '../utils/print-docs.js';
import { openSheet } from './sheet.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SIZE_KEY = 'fufu_label_size';
const pad = n => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const getSize = () => { try { return localStorage.getItem(SIZE_KEY) === '58' ? '58' : '50x30'; } catch { return '50x30'; } };
const setSize = v => { try { localStorage.setItem(SIZE_KEY, v); } catch { /* private mode */ } };
const popupBlocked = () => showToast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up แล้วลองอีกครั้ง', 'error');

// ── Drug labels ──────────────────────────────────────────────────────────────
export function openLabelSheet({ prescriptions = [], petName = '', ownerName = '', hn = '' }) {
  if (!prescriptions.length) { showToast('ยังไม่มียาในใบสั่งยา', 'error'); return; }
  const sheet = openSheet({ title: 'พิมพ์ฉลากยา', subtitle: `${petName}${hn ? ` · HN ${hn}` : ''}` });
  let size = getSize();
  sheet.body.innerHTML = `
    <div class="pt-seg" role="radiogroup" aria-label="ขนาดฉลาก">
      <button type="button" role="radio" data-size="50x30">สติ๊กเกอร์ 50×30 มม.</button>
      <button type="button" role="radio" data-size="58">กระดาษม้วน 58 มม.</button>
    </div>
    <ul class="pt-rx">${prescriptions.map((rx, i) => {
      const { main, sub } = rxInstruction(rx);
      return `<li><label><input type="checkbox" data-rx="${i}" checked>
        <span><b>${esc(rx.drug || rx.name || 'ยา')}</b><small>${esc([main, sub].filter(Boolean).join(' · ') || 'ยังไม่ระบุวิธีใช้')}</small></span></label></li>`;
    }).join('')}</ul>
    <p class="pt-hint">ตั้งค่าเครื่องพิมพ์ให้ขนาดกระดาษตรงกับฉลาก และขอบกระดาษเป็น 0</p>`;
  const drawSize = () => sheet.body.querySelectorAll('[data-size]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.size === size)));
  sheet.body.querySelectorAll('[data-size]').forEach(b => { b.onclick = () => { size = b.dataset.size; setSize(size); drawSize(); }; });
  drawSize();
  sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>ปิด</button><button type="button" class="ph-btn is-primary" data-go>พิมพ์ฉลาก</button>`;
  sheet.foot.querySelector('[data-go]').onclick = () => {
    const chosen = [...sheet.body.querySelectorAll('[data-rx]:checked')].map(c => prescriptions[Number(c.dataset.rx)]);
    if (!chosen.length) { showToast('เลือกยาอย่างน้อย 1 รายการ', 'error'); return; }
    const tab = printDrugLabels({ prescriptions: chosen, petName, ownerName, hn, storeName: storage.get(STORAGE_KEYS.STORE_NAME) || '', date: new Date().toISOString(), size });
    if (!tab) return popupBlocked();
    sheet.close();
  };
}

// ── Certificates ─────────────────────────────────────────────────────────────
const TYPES = [['vaccine', 'ฉีดวัคซีน'], ['health', 'สุขภาพ'], ['medical', 'ความเห็นแพทย์']];
const PURPOSES = ['เดินทาง', 'ฝากเลี้ยง / โรงแรม', 'ผสมพันธุ์', 'ซื้อขาย / ส่งต่อ'];
const HEALTH_TEXT = 'ได้รับการตรวจร่างกายแล้ว มีสุขภาพแข็งแรง ไม่พบอาการของโรคติดต่อ และไม่พบปรสิตภายนอกในวันที่ตรวจ';

export async function openCertificateSheet({ pet, owner = {} }) {
  if (!pet?.id) { showToast('ไม่พบข้อมูลสัตว์', 'error'); return; }
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const sheet = openSheet({ title: 'ออกใบรับรอง', subtitle: `${pet.name || ''}${owner.name ? ` · ${owner.name}` : ''}` });
  sheet.body.innerHTML = '<div class="cl-skel"></div>';
  const [vetsRes, storeRes, vacRes] = await Promise.all([
    apiFetch(`/api/certificates/vets?store_id=${storeId}`).catch(() => null),
    apiFetch(`/api/clinic/${storeId}`).catch(() => null),
    apiFetch(`/api/pets/vaccinations?pet_id=${encodeURIComponent(pet.id)}&store_id=${storeId}`).catch(() => null),
  ]);
  const vets = vetsRes?.data || [{ id: 'owner', kind: 'owner', name: '', license_no: '' }];
  const store = storeRes?.data || {};
  const vaccinations = (vacRes?.data || []).slice().sort((a, b) => String(b.given_date || '').localeCompare(String(a.given_date || '')));
  let type = vaccinations.length ? 'vaccine' : 'health';
  let vetId = vets.find(v => v.id === vetsRes?.me)?.id || vets[0].id;
  let purpose = '';

  const draw = () => {
    const vet = vets.find(v => v.id === vetId) || vets[0];
    sheet.body.innerHTML = `
      <div class="pt-seg" role="radiogroup" aria-label="ประเภทใบรับรอง">
        ${TYPES.map(([id, label]) => `<button type="button" role="radio" data-type="${id}" aria-checked="${type === id}">${label}</button>`).join('')}
      </div>
      ${type === 'vaccine' ? `<p class="pt-info">${vaccinations.length ? `รวมประวัติวัคซีน ${vaccinations.length} รายการ ล่าสุด ${esc(vaccinations[0].vaccine_name)}` : 'ยังไม่มีประวัติวัคซีนในระบบ บันทึกวัคซีนในแท็บ "วัคซีน" ก่อน'}</p>` : `
        <div class="pt-row">
          <label class="cx-field"><span>วันที่ตรวจ</span><input type="date" data-f="exam_date" value="${todayKey()}" max="${todayKey()}"></label>
          <label class="cx-field"><span>น้ำหนัก (กก.)</span><input inputmode="decimal" data-f="weight" value="${esc(pet.weight_kg ?? '')}"></label>
          ${type === 'health' ? '<label class="cx-field"><span>อุณหภูมิ (°C)</span><input inputmode="decimal" data-f="temp" placeholder="38.5"></label>' : ''}
        </div>`}
      ${type === 'health' ? `
        <div class="cx-field"><span>วัตถุประสงค์</span><div class="ap-presets">${PURPOSES.map(p => `<button type="button" class="ap-preset ${purpose === p ? 'is-on' : ''}" data-purpose="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>
        <label class="cx-field"><span>ผลการตรวจ</span><textarea rows="3" data-f="result">${esc(HEALTH_TEXT)}</textarea></label>
        <label class="cx-field"><span>อายุใบรับรอง (วัน)</span><input inputmode="numeric" data-f="valid_days" value="30"></label>` : ''}
      ${type === 'medical' ? `
        <label class="cx-field"><span>ผลการตรวจ / การวินิจฉัย <b aria-hidden="true">*</b></span><textarea rows="3" data-f="diagnosis" placeholder="เช่น ผิวหนังอักเสบจากเชื้อแบคทีเรีย บริเวณหลัง"></textarea></label>
        <label class="cx-field"><span>ความเห็นของสัตวแพทย์ <b aria-hidden="true">*</b></span><textarea rows="3" data-f="opinion" placeholder="เช่น ได้รับการรักษาแล้ว อาการดีขึ้น ควรงดอาบน้ำ 7 วัน"></textarea></label>
        <label class="cx-field"><span>คำแนะนำ (ไม่บังคับ)</span><textarea rows="2" data-f="recommendation"></textarea></label>` : ''}
      <div class="pt-row">
        <label class="cx-field"><span>สัตวแพทย์ผู้ลงนาม</span>
          <select data-vet>${vets.map(v => `<option value="${esc(v.id)}" ${v.id === vetId ? 'selected' : ''}>${esc(v.name || (v.kind === 'owner' ? 'เจ้าของคลินิก (ใส่ชื่อ)' : 'สัตวแพทย์'))}</option>`).join('')}</select></label>
        ${vet.kind === 'owner' ? `<label class="cx-field"><span>ชื่อสัตวแพทย์</span><input data-vet-name value="${esc(vet.name)}" placeholder="สพ.ญ. ..."></label>` : ''}
        <label class="cx-field"><span>เลขที่ใบอนุญาต</span><input data-license value="${esc(vet.license_no)}" placeholder="เช่น 12345"></label>
      </div>
      <p class="pt-hint">ชื่อและเลขใบอนุญาตจะถูกจำไว้สำหรับครั้งถัดไป</p>
      <p class="ap-err" data-error role="alert" hidden></p>`;
    sheet.body.querySelectorAll('[data-type]').forEach(b => { b.onclick = () => { type = b.dataset.type; draw(); }; });
    sheet.body.querySelectorAll('[data-purpose]').forEach(b => { b.onclick = () => { purpose = purpose === b.dataset.purpose ? '' : b.dataset.purpose; draw(); }; });
    sheet.body.querySelector('[data-vet]').onchange = e => { vetId = e.target.value; draw(); };
  };
  draw();

  sheet.foot.innerHTML = `<span class="flex-1"></span><button type="button" class="ph-btn" data-sh-close>ปิด</button><button type="button" class="ph-btn is-primary" data-go>พิมพ์ / PDF</button>`;
  sheet.foot.querySelector('[data-go]').onclick = async () => {
    const get = k => sheet.body.querySelector(`[data-f="${k}"]`)?.value.trim() || '';
    const err = sheet.body.querySelector('[data-error]');
    const vet = vets.find(v => v.id === vetId) || vets[0];
    const name = vet.kind === 'owner' ? (sheet.body.querySelector('[data-vet-name]')?.value.trim() || '') : vet.name;
    const license = sheet.body.querySelector('[data-license]').value.trim();
    if (type === 'vaccine' && !vaccinations.length) { err.textContent = 'ยังไม่มีประวัติวัคซีน'; err.hidden = false; return; }
    if (type === 'medical' && (!get('diagnosis') || !get('opinion'))) { err.textContent = 'กรอกการวินิจฉัยและความเห็นของสัตวแพทย์'; err.hidden = false; return; }
    if (!name || !license) { err.textContent = 'ใส่ชื่อและเลขที่ใบอนุญาตของสัตวแพทย์ผู้ลงนาม'; err.hidden = false; return; }
    const now = new Date();
    const certNo = `${{ vaccine: 'VC', health: 'HC', medical: 'MC' }[type]}-${String(now.getFullYear() + 543).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const tab = printCertificate({
      type, certNo, store, pet, owner, vet: { name, license_no: license }, vaccinations,
      fields: { exam_date: get('exam_date') || todayKey(), weight: get('weight'), temp: get('temp'), purpose, result: get('result'), valid_days: get('valid_days') || 30,
        diagnosis: get('diagnosis'), opinion: get('opinion'), recommendation: get('recommendation'), issue_date: now.toISOString() },
    });
    if (!tab) return popupBlocked();
    if (name !== vet.name || license !== vet.license_no) {
      apiFetch('/api/certificates/vets', { method: 'PUT', body: JSON.stringify({ store_id: storeId, id: vet.id, name, license_no: license }) })
        .then(r => { if (r?.success) { vet.name = name; vet.license_no = license; } }).catch(() => {});
    }
    sheet.close();
  };
}
