// Shared PDF/print utilities — all functions open a Blob URL in a new tab

const FREQ_LABELS = {
  SID: 'วันละ 1 ครั้ง', BID: 'วันละ 2 ครั้ง',
  TID: 'วันละ 3 ครั้ง', QID: 'วันละ 4 ครั้ง', PRN: 'เมื่อจำเป็น',
};

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Read cached store info (saved by settings.js after load)
function _storeInfo() {
  try { return JSON.parse(localStorage.getItem('fufu_store_info') || '{}'); } catch { return {}; }
}

/**
 * Wire the "print" button inside a print window opened from a blob URL.
 * The blob document inherits the portal CSP, so it cannot use inline onclick.
 */
export function bindPrintButton(tab) {
  if (!tab) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    try {
      const btn = tab.document?.querySelector('[data-print]');
      if (btn && tab.document.readyState !== 'loading') {
        btn.addEventListener('click', () => tab.print());
        clearInterval(timer);
      }
    } catch { clearInterval(timer); }
    if (tries > 50) clearInterval(timer);
  }, 100);
}

function _openPrintWindow(html, title) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const tab  = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  bindPrintButton(tab);
  return tab;
}

function _thaiDate(dateStr) {
  return new Date(dateStr || Date.now()).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── Drug Labels: 50×30 mm sticker or 58 mm roll ─────────────────────────────

const ROUTE_VERB = { PO: 'กิน', oral: 'กิน', topical: 'ทา', ear: 'หยอดหู', eye: 'หยอดตา', SC: 'ฉีด', IM: 'ฉีด', IV: 'ฉีด' };

/** "กินครั้งละ 1 เม็ด วันละ 2 ครั้ง" + "หลังอาหาร · 7 วัน" from a prescription row. */
export function rxInstruction(rx) {
  const verb = ROUTE_VERB[rx.route] || (rx.route && !/^[A-Z]{2,3}$/.test(rx.route) ? rx.route : 'ใช้');
  const freq = FREQ_LABELS[rx.freq] || rx.freq || '';
  const main = [rx.dose ? `${verb}ครั้งละ ${rx.dose}` : '', freq].filter(Boolean).join(' ');
  const sub = [rx.timing || '', rx.days ? `${rx.days} วัน` : '', rx.qty ? `จำนวน ${rx.qty}` : ''].filter(Boolean).join(' · ');
  return { main, sub };
}

export function printDrugLabels({ prescriptions, petName, ownerName, hn = '', storeName, storePhone = '', date, size = '50x30' }) {
  const si = _storeInfo();
  storeName = storeName || si.name || 'คลินิก';
  storePhone = storePhone || si.phone || '';
  if (!prescriptions?.length) return false;
  const day = new Date(date || Date.now()).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  const sticker = size === '50x30';

  const labels = prescriptions.map(rx => {
    const { main, sub } = rxInstruction(rx);
    return `
      <section class="label">
        <div class="store">${_esc(storeName)}${storePhone ? ` · ${_esc(storePhone)}` : ''}</div>
        <div class="drug">${_esc(rx.drug || rx.name || '—')}</div>
        ${main ? `<div class="main">${_esc(main)}</div>` : ''}
        ${sub ? `<div class="sub">${_esc(sub)}</div>` : ''}
        ${rx.note ? `<div class="note">${_esc(rx.note)}</div>` : ''}
        <div class="foot"><span>${_esc(petName)}${hn ? ` · HN ${_esc(hn)}` : ''}${!sticker && ownerName ? ` · ${_esc(ownerName)}` : ''}</span><span>${_esc(day)}</span></div>
      </section>`;
  }).join('');

  const css = sticker ? `
  @page { size: 50mm 30mm; margin: 0; }
  .label { width: 50mm; height: 30mm; padding: 1.6mm 2.2mm; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; break-after: page; }
  .store { font-size: 6pt; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .drug  { font-size: 9.5pt; font-weight: 700; line-height: 1.15; margin-top: .4mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .main  { font-size: 8.2pt; font-weight: 700; line-height: 1.2; margin-top: .6mm; }
  .sub   { font-size: 7pt; line-height: 1.2; color: #222; }
  .note  { font-size: 6.5pt; line-height: 1.2; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foot  { margin-top: auto; display: flex; justify-content: space-between; gap: 2mm; font-size: 6pt; color: #444; white-space: nowrap; }
  .foot span:first-child { overflow: hidden; text-overflow: ellipsis; }
  ` : `
  @page { size: 58mm auto; margin: 0; }
  .label { width: 58mm; padding: 3mm 3.5mm 4mm; border-bottom: 1px dashed #999; page-break-after: always; break-after: page; }
  .store { font-size: 7.5pt; color: #444; }
  .drug  { font-size: 12.5pt; font-weight: 700; line-height: 1.25; margin-top: 1mm; }
  .main  { font-size: 10.5pt; font-weight: 700; line-height: 1.3; margin-top: 1.5mm; }
  .sub   { font-size: 9pt; margin-top: .5mm; }
  .note  { font-size: 8.5pt; margin-top: 1mm; color: #333; }
  .foot  { margin-top: 2mm; display: flex; justify-content: space-between; gap: 2mm; font-size: 7.5pt; color: #444; }
  `;

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ฉลากยา — ${_esc(petName)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans Thai','Sarabun','Tahoma',sans-serif; background:#fff; color:#111; -webkit-print-color-adjust:exact; }
  ${css}
  .bar { position: sticky; top: 0; display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #F1F5F9; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #334155; }
  .bar button { margin-left: auto; padding: 8px 18px; background:#2A6374; color:#fff; border:0; border-radius:999px; font: 600 13px inherit; font-family: inherit; cursor:pointer; }
  .sheet { padding: 12px; display: grid; gap: 8px; justify-content: start; }
  .sheet .label { outline: 1px solid #CBD5E1; background: #fff; }
  @media print { .bar { display:none !important; } .sheet { padding: 0; gap: 0; display: block; } .sheet .label { outline: none; } }
</style>
</head>
<body>
  <div class="bar">${sticker ? 'สติ๊กเกอร์ 50×30 มม.' : 'กระดาษม้วน 58 มม.'} · ${prescriptions.length} ฉลาก · ตั้งค่าเครื่องพิมพ์เป็นขนาดเดียวกัน ขอบ 0<button data-print>พิมพ์ฉลาก</button></div>
  <div class="sheet">${labels}</div>
</body>
</html>`;

  return _openPrintWindow(html, `ฉลากยา ${petName}`);
}

// ─── Certificates (A4): vaccination, health, medical opinion ───────────────────

const CERT_TITLE = {
  vaccine: ['ใบรับรองการฉีดวัคซีน', 'Vaccination Certificate'],
  health: ['ใบรับรองสุขภาพสัตว์', 'Animal Health Certificate'],
  medical: ['ใบรับรองแพทย์', 'Veterinary Medical Certificate'],
};
const SPECIES_TH = { dog: 'สุนัข', cat: 'แมว', rabbit: 'กระต่าย', bird: 'นก', other: 'อื่น ๆ' };

export function printCertificate({ type, certNo, store = {}, pet = {}, owner = {}, vet = {}, fields = {}, vaccinations = [] }) {
  const si = _storeInfo();
  const st = { name: store.name || si.name || 'คลินิก', address: store.address || si.address || '', phone: store.phone || si.phone || '', tax_id: store.tax_id || si.tax_id || '', logo: store.logo_url || '' };
  const [titleTh, titleEn] = CERT_TITLE[type] || CERT_TITLE.health;
  const d = s => (s ? _thaiDate(s) : '—');
  const row = (k, v) => `<div class="kv"><dt>${k}</dt><dd>${_esc(v || '—')}</dd></div>`;
  const age = pet.dob ? (() => { const m = Math.floor((Date.now() - new Date(pet.dob)) / (30.44 * 864e5)); return m >= 12 ? `${Math.floor(m / 12)} ปี ${m % 12 ? `${m % 12} เดือน` : ''}` : `${m} เดือน`; })() : '';

  let body = '';
  if (type === 'vaccine') {
    body = `
      <h3>ประวัติการได้รับวัคซีน</h3>
      ${vaccinations.length ? `<table>
        <thead><tr><th>วันที่ฉีด</th><th>วัคซีน</th><th>Lot / Batch</th><th>ครั้งถัดไป</th><th>สัตวแพทย์</th></tr></thead>
        <tbody>${vaccinations.map(v => `<tr><td>${d(v.given_date)}</td><td>${_esc(v.vaccine_name)}</td><td>${_esc(v.batch_no || '—')}</td><td>${d(v.next_due_date)}</td><td>${_esc(v.vet_name || '—')}</td></tr>`).join('')}</tbody>
      </table>` : '<p class="muted">ยังไม่มีประวัติวัคซีนในระบบ</p>'}
      <p class="statement">ขอรับรองว่าสัตว์ตามรายละเอียดข้างต้นได้รับวัคซีนตามรายการที่ระบุจริง</p>`;
  } else if (type === 'medical') {
    body = `
      <h3>การตรวจ</h3>
      <dl class="grid">${row('วันที่ตรวจ', d(fields.exam_date))}${row('น้ำหนัก', fields.weight ? `${fields.weight} กก.` : '')}</dl>
      <h3>ผลการตรวจ / การวินิจฉัย</h3><p class="text">${_esc(fields.diagnosis || '—')}</p>
      <h3>ความเห็นของสัตวแพทย์</h3><p class="text">${_esc(fields.opinion || '—')}</p>
      ${fields.recommendation ? `<h3>คำแนะนำ</h3><p class="text">${_esc(fields.recommendation)}</p>` : ''}`;
  } else {
    body = `
      <h3>การตรวจ</h3>
      <dl class="grid">${row('วันที่ตรวจ', d(fields.exam_date))}${row('น้ำหนัก', fields.weight ? `${fields.weight} กก.` : '')}${row('อุณหภูมิ', fields.temp ? `${fields.temp} °C` : '')}${row('วัตถุประสงค์', fields.purpose)}</dl>
      <h3>ผลการตรวจร่างกาย</h3><p class="text">${_esc(fields.result || '')}</p>
      ${vaccinations.length ? `<h3>วัคซีนล่าสุด</h3><p class="text">${vaccinations.slice(0, 6).map(v => `${_esc(v.vaccine_name)} (${d(v.given_date)})`).join(' · ')}</p>` : ''}
      <p class="statement">ใบรับรองนี้มีอายุ ${_esc(fields.valid_days || 30)} วัน นับจากวันที่ตรวจ</p>`;
  }

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${titleTh} — ${_esc(pet.name || '')}</title>
<style>
  @page { size: A4; margin: 16mm 16mm 18mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Sarabun','Noto Sans Thai','Tahoma',sans-serif; color:#1E293B; font-size:11pt; line-height:1.6; background:#F1F5F9; }
  .page { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 16mm; background:#fff; box-shadow: 0 4px 20px rgba(15,23,42,.08); }
  header { display:flex; gap:14px; align-items:center; padding-bottom:10px; border-bottom:2px solid #2A6374; }
  header img { width:56px; height:56px; object-fit:cover; border-radius:12px; }
  header h1 { font-size:15pt; color:#1D3640; }
  header p { font-size:9pt; color:#475569; }
  .title { margin:18px 0 4px; text-align:center; }
  .title h2 { font-size:18pt; letter-spacing:.02em; color:#1D3640; }
  .title p { font-size:10pt; color:#64748B; letter-spacing:.08em; text-transform:uppercase; }
  .meta { display:flex; justify-content:space-between; font-size:9.5pt; color:#475569; margin:10px 0 14px; }
  h3 { font-size:11pt; margin:14px 0 6px; color:#2A6374; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; }
  .kv { display:flex; gap:8px; border-bottom:1px dotted #CBD5E1; padding:3px 0; }
  .kv dt { width:34%; flex-shrink:0; color:#64748B; font-size:10pt; }
  .kv dd { font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:10pt; }
  th, td { border:1px solid #CBD5E1; padding:6px 8px; text-align:left; }
  th { background:#EEF6F6; color:#1D3640; font-weight:600; }
  .text { white-space:pre-line; padding:8px 12px; border:1px solid #E2E8F0; border-radius:8px; min-height:48px; }
  .statement { margin-top:16px; font-size:10.5pt; }
  .muted { color:#94A3B8; }
  .sign { margin-top:46px; display:flex; justify-content:space-between; align-items:flex-end; }
  .stamp { width:110px; height:110px; border:1.5px dashed #CBD5E1; border-radius:50%; display:grid; place-items:center; color:#CBD5E1; font-size:9pt; }
  .signer { width:260px; text-align:center; font-size:10pt; }
  .signer .line { border-top:1px solid #1E293B; margin-bottom:6px; padding-top:4px; }
  .bar { position:sticky; top:0; display:flex; align-items:center; gap:10px; padding:10px 14px; background:#fff; border-bottom:1px solid #E2E8F0; font:13px 'Noto Sans Thai',sans-serif; color:#334155; z-index:2; }
  .bar button { margin-left:auto; padding:8px 18px; background:#2A6374; color:#fff; border:0; border-radius:999px; font:600 13px 'Noto Sans Thai',sans-serif; cursor:pointer; }
  @media print { body { background:#fff; } .bar { display:none !important; } .page { margin:0; padding:0; box-shadow:none; width:auto; min-height:auto; } }
</style>
</head>
<body>
  <div class="bar">${titleTh} · กด "พิมพ์" แล้วเลือก "บันทึกเป็น PDF" ได้<button data-print>พิมพ์ / PDF</button></div>
  <div class="page">
    <header>
      ${st.logo ? `<img src="${_esc(st.logo)}" alt="">` : ''}
      <div><h1>${_esc(st.name)}</h1><p>${[st.address, st.phone ? `โทร ${st.phone}` : '', st.tax_id ? `เลขประจำตัวผู้เสียภาษี ${st.tax_id}` : ''].filter(Boolean).map(_esc).join(' · ')}</p></div>
    </header>
    <div class="title"><h2>${titleTh}</h2><p>${titleEn}</p></div>
    <div class="meta"><span>เลขที่ ${_esc(certNo || '—')}</span><span>ออกให้วันที่ ${_thaiDate(fields.issue_date || Date.now())}</span></div>

    <h3>ข้อมูลสัตว์</h3>
    <dl class="grid">
      ${row('ชื่อ', pet.name)}${row('HN', pet.hn)}
      ${row('ชนิด', SPECIES_TH[pet.species] || pet.species)}${row('สายพันธุ์', pet.breed)}
      ${row('เพศ', pet.gender === 'male' ? 'เพศผู้' : pet.gender === 'female' ? 'เพศเมีย' : '')}${row('อายุ / วันเกิด', [age, pet.dob ? d(pet.dob) : ''].filter(Boolean).join(' · '))}
      ${row('สี / ตำหนิ', pet.color)}${row('ไมโครชิป', pet.microchip_no)}
    </dl>
    <h3>เจ้าของ</h3>
    <dl class="grid">${row('ชื่อ', owner.name)}${row('โทรศัพท์', owner.phone)}</dl>

    ${body}

    <div class="sign">
      <div class="stamp">ตราประทับ</div>
      <div class="signer">
        <div class="line">ลงชื่อ</div>
        <div>(${_esc(vet.name || '................................')})</div>
        <div>สัตวแพทย์ผู้ตรวจ</div>
        <div>ใบอนุญาตประกอบวิชาชีพเลขที่ ${_esc(vet.license_no || '................')}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  return _openPrintWindow(html, titleTh);
}

// ─── Referral Letter (A4) ─────────────────────────────────────────────────────

export function printReferralLetter({
  storeName, storePhone,
  petName, ownerName, ownerPhone = '', species = '',
  hn = null,
  diagnosis, subjective, objective, plan,
  prescriptions = [],
  destClinic, referredBy, reason, notes,
  date,
}) {
  const rxRows = prescriptions.length
    ? `<ul style="margin:4px 0 0 16px;padding:0;font-size:10pt;">
        ${prescriptions.map(rx => {
          const freq = FREQ_LABELS[rx.freq] || rx.freq || '';
          return `<li>${_esc(rx.drug || rx.name || '—')}${rx.dose ? ' ' + _esc(rx.dose) : ''}${freq ? ' · ' + _esc(freq) : ''}${rx.days ? ' · ' + rx.days + ' วัน' : ''}</li>`;
        }).join('')}
       </ul>`
    : '<p style="margin:4px 0;color:#888;font-size:10pt;">ไม่มียาที่ใช้</p>';

  const si = _storeInfo();
  storeName  = storeName  || si.name    || 'คลินิก';
  storePhone = storePhone ?? si.phone   ?? '';
  const storeAddr  = si.address || '';
  const storeTaxId = si.tax_id  || '';

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ใบส่งตัว — ${_esc(petName)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans Thai','Tahoma',sans-serif; font-size:11pt; color:#111;
         padding:20mm 20mm 16mm; max-width:210mm; margin:auto; }
  h1  { font-size:18pt; text-align:center; margin-bottom:2px; }
  .sub{ text-align:center; font-size:9pt; color:#555; margin-bottom:6mm; }
  .hr { border:none; border-top:1.5px solid #111; margin:5mm 0; }
  .hr2{ border:none; border-top:1px dashed #aaa; margin:4mm 0; }
  h2  { font-size:13pt; margin:5mm 0 2mm; border-left:4px solid #2A6374; padding-left:6px; }
  .row{ display:flex; gap:16mm; margin:2px 0; }
  .row .label { width:32mm; color:#555; flex-shrink:0; }
  .row .val   { flex:1; font-weight:500; }
  .soap-block { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;
               padding:8px 12px; font-size:10pt; margin:4px 0; white-space:pre-wrap; }
  .reason-box { background:#FFF3CD; border:1px solid #FFC107; border-radius:6px;
                padding:10px 14px; font-size:11pt; font-weight:600; margin:4px 0; }
  .sig { margin-top:12mm; display:flex; justify-content:flex-end; }
  .sig-box { text-align:center; width:60mm; }
  .sig-line { border-top:1px solid #111; margin-top:14mm; padding-top:2px; font-size:9pt; }
  .print-btn { display:block; margin:6mm auto; padding:8px 24px; background:#2A6374;
               color:#fff; border:none; border-radius:8px; font-size:13px;
               cursor:pointer; font-family:inherit; }
  @media print {
    .print-btn { display:none !important; }
    body { padding:15mm 20mm 12mm; }
  }
</style>
</head>
<body>
  <h1>${_esc(storeName)}</h1>
  <p class="sub">
    ${storePhone ? _esc(storePhone) + ' · ' : ''}วันที่ ${_thaiDate(date)}
    ${storeAddr  ? `<br>${_esc(storeAddr)}`  : ''}
    ${storeTaxId ? `<br>เลขภาษี ${_esc(storeTaxId)}` : ''}
  </p>
  <hr class="hr">

  <div style="text-align:center;font-size:15pt;font-weight:bold;margin:6mm 0 4mm;">
    ใบส่งตัวสัตว์ป่วย (Referral Letter)
  </div>

  <div class="row"><span class="label">เรียน</span>
    <span class="val">${_esc(destClinic || 'สถานพยาบาลสัตว์ที่รับการส่งตัว')}</span></div>

  <hr class="hr2">

  <h2>ข้อมูลสัตว์ป่วย</h2>
  <div class="row"><span class="label">ชื่อสัตว์</span>
    <span class="val">${_esc(petName)}${hn ? ` <span style="color:#2A6374;font-size:9pt;">(HN-${String(hn).padStart(5,'0')})</span>` : ''}</span></div>
  ${species ? `<div class="row"><span class="label">ชนิด</span><span class="val">${_esc(species)}</span></div>` : ''}
  <div class="row"><span class="label">เจ้าของ</span>
    <span class="val">${_esc(ownerName || '—')}${ownerPhone ? ' · ' + _esc(ownerPhone) : ''}</span></div>

  <h2>เหตุผลในการส่งตัว</h2>
  <div class="reason-box">${_esc(reason || '—')}</div>

  <h2>ประวัติและการรักษา</h2>
  ${subjective  ? `<div class="row"><span class="label">ประวัติ (HX)</span><span class="val soap-block">${_esc(subjective)}</span></div>` : ''}
  ${objective   ? `<div class="row"><span class="label">ตรวจร่างกาย</span><span class="val soap-block">${_esc(objective)}</span></div>` : ''}
  ${diagnosis   ? `<div class="row"><span class="label">การวินิจฉัย</span><span class="val soap-block">${_esc(diagnosis)}</span></div>` : ''}
  ${plan        ? `<div class="row"><span class="label">แผนรักษา</span><span class="val soap-block">${_esc(plan)}</span></div>` : ''}

  <h2>ยาที่ใช้อยู่</h2>
  ${rxRows}

  ${notes ? `<h2>หมายเหตุเพิ่มเติม</h2><div class="soap-block">${_esc(notes)}</div>` : ''}

  <div class="sig">
    <div class="sig-box">
      <div class="sig-line">${_esc(referredBy || 'สัตวแพทย์ผู้ส่งตัว')}</div>
    </div>
  </div>

  <button class="print-btn" data-print>พิมพ์ / บันทึก PDF</button>
</body>
</html>`;

  return _openPrintWindow(html, `ใบส่งตัว ${petName}`);
}

// ─── Discharge Summary (A4) ───────────────────────────────────────────────────

export function printDischargeSummary({ storeName, adm, treatments = [], vitals = [], date }) {
  const si = _storeInfo();
  storeName = storeName || si.name || 'คลินิก';
  const admitted  = new Date(adm.admitted_at);
  const discharged = date ? new Date(date) : new Date();
  const hrs  = Math.max(1, Math.ceil((discharged - admitted) / 3600000));
  const days = Math.ceil(hrs / 24);

  const treatRows = treatments.length
    ? treatments.map(t => `
        <tr>
          <td>${_esc(t.treatment_time || '')}</td>
          <td>${_esc(t.treatment_type || '')}</td>
          <td>${_esc(t.description || '')}</td>
          <td>${_esc(t.dosage || '')}</td>
          <td style="color:${t.status === 'done' ? '#2A6374' : '#F97316'}">${t.status === 'done' ? '✓' : '—'}</td>
        </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#888;padding:8px;">ไม่มีรายการ</td></tr>';

  const latestVital = vitals[vitals.length - 1];
  const vitalsHtml  = latestVital ? `
    <p style="margin:4px 0;font-size:10pt;">
      ${latestVital.temperature      ? `${latestVital.temperature}°C · ` : ''}
      ${latestVital.heart_rate       ? `${latestVital.heart_rate} bpm · ` : ''}
      ${latestVital.respiratory_rate ? `${latestVital.respiratory_rate}/min · ` : ''}
      ${latestVital.weight_kg        ? `${latestVital.weight_kg} kg` : ''}
    </p>` : '<p style="color:#888;font-size:10pt;">ไม่มีข้อมูล</p>';

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Discharge Summary — ${_esc(adm.pet_name)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans Thai','Tahoma',sans-serif; font-size:11pt; color:#111;
         padding:18mm 20mm 14mm; max-width:210mm; margin:auto; }
  h1  { font-size:17pt; text-align:center; margin-bottom:2px; }
  .sub{ text-align:center; font-size:9pt; color:#555; margin-bottom:5mm; }
  .title{ text-align:center; font-size:14pt; font-weight:bold; margin:5mm 0 4mm; }
  .hr { border:none; border-top:1.5px solid #111; margin:4mm 0; }
  .hr2{ border:none; border-top:1px dashed #aaa; margin:3mm 0; }
  h2  { font-size:12pt; margin:5mm 0 2mm; border-left:4px solid #2A6374; padding-left:6px; }
  .row{ display:flex; gap:8mm; margin:2px 0; font-size:10.5pt; }
  .row .lbl { width:36mm; color:#555; flex-shrink:0; }
  .row .val { flex:1; font-weight:500; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:2mm 8mm; margin:2mm 0; }
  .info-item .lbl { font-size:9pt; color:#888; }
  .info-item .val { font-size:10.5pt; font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:9.5pt; margin-top:3mm; }
  th  { background:#f1f5f9; text-align:left; padding:5px 8px; font-size:9pt; color:#555; }
  td  { padding:4px 8px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
  .cost-box { background:#f0fdf4; border:1px solid #86efac; border-radius:6px;
              padding:8px 14px; display:flex; justify-content:space-between;
              align-items:center; margin:3mm 0; }
  .cost-box .amount { font-size:15pt; font-weight:bold; color:#2A6374; }
  .notes-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;
               padding:8px 12px; font-size:10pt; white-space:pre-wrap; margin:3mm 0; }
  .sig { margin-top:12mm; display:flex; justify-content:flex-end; }
  .sig-box { text-align:center; width:60mm; }
  .sig-line { border-top:1px solid #111; margin-top:14mm; padding-top:2px; font-size:9pt; }
  .print-btn { display:block; margin:6mm auto; padding:8px 24px; background:#2A6374;
               color:#fff; border:none; border-radius:8px; font-size:13px;
               cursor:pointer; font-family:inherit; }
  @media print {
    .print-btn { display:none !important; }
    body { padding:12mm 18mm 10mm; }
  }
</style>
</head>
<body>
  <h1>${_esc(storeName)}</h1>
  <p class="sub">วันที่ออก: ${_thaiDate(discharged.toISOString())}</p>
  <hr class="hr">
  <div class="title">ใบสรุปการรักษา (Discharge Summary)</div>

  <h2>ข้อมูลสัตว์ป่วย</h2>
  <div class="info-grid">
    <div class="info-item"><div class="lbl">ชื่อ</div><div class="val">${_esc(adm.pet_name)}</div></div>
    <div class="info-item"><div class="lbl">ชนิด</div><div class="val">${_esc(adm.species || '—')}</div></div>
    <div class="info-item"><div class="lbl">เจ้าของ</div><div class="val">${_esc(adm.owner_name || '—')}</div></div>
    <div class="info-item"><div class="lbl">ระยะเวลา</div><div class="val">${days} วัน (${hrs} ชั่วโมง)</div></div>
  </div>

  <hr class="hr2">
  <h2>ข้อมูลการ Admit</h2>
  <div class="row"><span class="lbl">วันที่รับตัว</span><span class="val">${_thaiDate(adm.admitted_at)}</span></div>
  <div class="row"><span class="lbl">เหตุผล</span><span class="val">${_esc(adm.admission_reason || '—')}</span></div>
  <div class="row"><span class="lbl">วันที่จำหน่าย</span><span class="val">${_thaiDate(discharged.toISOString())}</span></div>

  <h2>Vital Signs ล่าสุด</h2>
  ${vitalsHtml}

  <h2>รายการการรักษา (${treatments.length} รายการ)</h2>
  <table>
    <thead>
      <tr>
        <th style="width:14mm">เวลา</th>
        <th style="width:20mm">ประเภท</th>
        <th>รายละเอียด</th>
        <th style="width:22mm">ขนาด/ปริมาณ</th>
        <th style="width:10mm">สถานะ</th>
      </tr>
    </thead>
    <tbody>${treatRows}</tbody>
  </table>

  ${adm.daily_notes ? `
  <h2>บันทึกประจำวัน</h2>
  <div class="notes-box">${_esc(adm.daily_notes)}</div>` : ''}

  <h2>ค่าใช้จ่าย</h2>
  <div class="cost-box">
    <span>ค่าพักรักษาตัวรวม (${days} วัน × ฿${(adm.daily_rate||500).toLocaleString('th-TH')})</span>
    <span class="amount">฿${(adm.total_cost || days * (adm.daily_rate || 500)).toLocaleString('th-TH')}</span>
  </div>

  <div class="sig">
    <div class="sig-box">
      <div class="sig-line">สัตวแพทย์ผู้รักษา</div>
    </div>
  </div>

  <button class="print-btn" data-print>พิมพ์ / บันทึก PDF</button>
</body>
</html>`;

  return _openPrintWindow(html, `Discharge Summary ${adm.pet_name}`);
}

// ─── Consent Form (A4) ────────────────────────────────────────────────────────

export function printConsentForm({
  storeName, storePhone = '', storeAddr = '',
  petName, ownerName, owner_phone = '', species = '',
  procedure, reason = '', risks = '',
  vet_name = '',
  date,
}) {
  const si = _storeInfo();
  storeName  = storeName  || si.name    || 'คลินิก';
  storePhone = storePhone || si.phone   || '';
  storeAddr  = storeAddr  || si.address || '';

  const risksHtml = risks
    ? risks.split('\n').filter(Boolean).map(r => `<li>${_esc(r.replace(/^-\s*/,''))}</li>`).join('')
    : '<li>ความเสี่ยงจากยาสลบ / การดมยา</li><li>การติดเชื้อหลังการรักษา</li>';

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>หนังสือยินยอม — ${_esc(petName)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans Thai','Tahoma',sans-serif; font-size:12pt; color:#111;
         padding:20mm 20mm 16mm; max-width:210mm; margin:auto; line-height:1.7; }
  h1  { font-size:17pt; text-align:center; margin-bottom:2px; }
  .sub{ text-align:center; font-size:10pt; color:#555; margin-bottom:5mm; }
  .doc-title { text-align:center; font-size:15pt; font-weight:bold; margin:6mm 0 4mm;
               border-top:2px solid #111; border-bottom:2px solid #111; padding:4px 0; }
  hr  { border:none; border-top:1px solid #ccc; margin:4mm 0; }
  h2  { font-size:13pt; border-left:4px solid #2A6374; padding-left:6px; margin:5mm 0 2mm; }
  .row{ display:flex; gap:8mm; margin:1.5mm 0; font-size:11pt; }
  .row .lbl { width:36mm; color:#555; flex-shrink:0; }
  .row .val { flex:1; border-bottom:1px solid #ccc; min-height:6mm; }
  .risks li { margin-left:4mm; margin-bottom:1mm; }
  .consent-text { font-size:11pt; line-height:1.8; margin:4mm 0; }
  .sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:12mm; margin-top:12mm; }
  .sig-box  { text-align:center; }
  .sig-line { border-top:1px solid #111; margin-top:16mm; padding-top:2px; font-size:10pt; }
  .sig-date { font-size:10pt; color:#555; margin-top:2mm; }
  .print-btn { display:block; margin:8mm auto; padding:8px 24px; background:#2A6374;
               color:#fff; border:none; border-radius:8px; font-size:13px;
               cursor:pointer; font-family:inherit; }
  @media print { .print-btn { display:none !important; } body { padding:12mm 18mm; } }
</style>
</head>
<body>
  <h1>${_esc(storeName)}</h1>
  <p class="sub">
    ${storePhone ? _esc(storePhone) + ' · ' : ''}วันที่ ${_thaiDate(date)}
    ${storeAddr  ? '<br>' + _esc(storeAddr) : ''}
  </p>

  <div class="doc-title">หนังสือยินยอมการรักษา / ทำหัตถการ<br>
    <span style="font-size:11pt;font-weight:normal">Informed Consent Form</span>
  </div>

  <h2>ข้อมูลสัตว์ป่วยและเจ้าของ</h2>
  <div class="row"><span class="lbl">ชื่อสัตว์</span><span class="val">${_esc(petName)}</span></div>
  ${species   ? `<div class="row"><span class="lbl">ชนิด/สายพันธุ์</span><span class="val">${_esc(species)}</span></div>` : ''}
  <div class="row"><span class="lbl">ชื่อเจ้าของ</span><span class="val">${_esc(ownerName || '—')}</span></div>
  ${owner_phone ? `<div class="row"><span class="lbl">เบอร์โทร</span><span class="val">${_esc(owner_phone)}</span></div>` : ''}

  <h2>หัตถการ / การรักษาที่จะทำ</h2>
  <div class="row"><span class="lbl">ชื่อหัตถการ</span><span class="val">${_esc(procedure)}</span></div>
  ${reason ? `
  <div class="row"><span class="lbl">เหตุผล</span>
    <span class="val" style="white-space:pre-wrap">${_esc(reason)}</span>
  </div>` : ''}

  <h2>ความเสี่ยงที่อาจเกิดขึ้น</h2>
  <ul class="risks" style="font-size:11pt;">${risksHtml}</ul>

  <h2>การให้ความยินยอม</h2>
  <p class="consent-text">
    ข้าพเจ้าในฐานะเจ้าของ / ผู้ดูแลสัตว์ป่วย ได้รับทราบข้อมูลเกี่ยวกับหัตถการ
    ความเสี่ยง และผลที่อาจเกิดขึ้นจากสัตวแพทย์โดยละเอียดแล้ว
    และขอให้ความยินยอมในการดำเนินการรักษาตามที่ระบุไว้ข้างต้น
  </p>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-line">ลายมือชื่อเจ้าของ / ผู้แทน</div>
      <div class="sig-date">วันที่ _____ / _____ / _____</div>
      <div style="font-size:10pt;color:#555;margin-top:2mm;">(${_esc(ownerName || '.....................')})</div>
    </div>
    <div class="sig-box">
      <div class="sig-line">สัตวแพทย์ผู้รับผิดชอบ</div>
      <div class="sig-date">วันที่ _____ / _____ / _____</div>
      <div style="font-size:10pt;color:#555;margin-top:2mm;">(${_esc(vet_name || '.....................')})</div>
    </div>
  </div>

  <button class="print-btn" data-print>พิมพ์ / บันทึก PDF</button>
</body>
</html>`;

  return _openPrintWindow(html, `ยินยอม ${petName}`);
}
