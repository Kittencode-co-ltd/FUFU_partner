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

// ─── Drug Labels (58mm thermal) ───────────────────────────────────────────────

export function printDrugLabels({ prescriptions, petName, ownerName, storeName, date }) {
  const si = _storeInfo();
  storeName = storeName || si.name || 'คลินิก';
  if (!prescriptions?.length) return false;

  const labels = prescriptions.map(rx => {
    const freq  = FREQ_LABELS[rx.freq] || rx.freq || '';
    const days  = rx.days ? `${rx.days} วัน` : '';
    const instr = [rx.dose, freq, days].filter(Boolean).join(' · ');
    return `
      <div class="label">
        <div class="store">${_esc(storeName)}</div>
        <div class="drug">${_esc(rx.drug || rx.name || '—')}</div>
        ${instr ? `<div class="instr">${_esc(instr)}</div>` : ''}
        ${rx.note ? `<div class="note">${_esc(rx.note)}</div>` : ''}
        <div class="patient">${_esc(petName)}${ownerName ? ` · ${_esc(ownerName)}` : ''}</div>
        <div class="date">${_thaiDate(date)}</div>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ฉลากยา — ${_esc(petName)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans Thai','Tahoma',sans-serif; background:#fff; }
  .label {
    width: 58mm;
    padding: 4mm 4mm 3mm;
    border: 1px dashed #aaa;
    page-break-after: always;
    font-size: 10pt;
  }
  .store  { font-size:8pt; color:#666; margin-bottom:2mm; }
  .drug   { font-size:13pt; font-weight:bold; color:#111; line-height:1.3; }
  .instr  { font-size:9.5pt; margin-top:2mm; color:#222; }
  .note   { font-size:8.5pt; color:#555; margin-top:1mm; font-style:italic; }
  .patient{ font-size:8.5pt; margin-top:2mm; color:#333; }
  .date   { font-size:8pt; color:#888; margin-top:1mm; }
  .print-btn { display:block; margin:6mm auto; padding:6px 20px; background:#2A6374;
               color:#fff; border:none; border-radius:6px; font-size:13px;
               cursor:pointer; font-family:inherit; }
  @media print {
    .print-btn { display:none !important; }
    .label { border:none; }
  }
</style>
</head>
<body>
  ${labels}
  <button class="print-btn" data-print>พิมพ์ฉลาก</button>
</body>
</html>`;

  return _openPrintWindow(html, `ฉลากยา ${petName}`);
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
