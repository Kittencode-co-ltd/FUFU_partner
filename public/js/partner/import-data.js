// "นำเข้าข้อมูลจาก Excel" sheet (store owner): customers, pets and vaccine history from an .xlsx or .csv file.
// The file is read in the browser (no upload, no extra library: .xlsx is unzipped with DecompressionStream),
// columns are matched by their Thai/English names and can be changed, then the server checks every row
// (dry run) before anything is saved. API: server/routes/import.js. Styles: .im-* in src/css/input.css.
import { apiFetch } from '../utils/api-client.js';
import { storage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/config.js';
import { showToast } from '../utils/toast.js';
import { icon } from '../utils/icons.js';
import { openSheet } from './sheet.js';
import { bizKind } from '../utils/business.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MAX_FILE = 8 * 1024 * 1024;
const MAX_ROWS = 5000;
const CHUNK = 200;

// field → [label, header names it is recognised by]
const FIELDS = [
  ['owner_name', 'ชื่อเจ้าของ *', ['ชื่อเจ้าของ', 'เจ้าของ', 'ชื่อลูกค้า', 'ลูกค้า', 'owner', 'owner name', 'customer', 'client']],
  ['phone', 'เบอร์โทร', ['เบอร์โทร', 'เบอร์', 'โทรศัพท์', 'เบอร์โทรศัพท์', 'มือถือ', 'phone', 'tel', 'mobile']],
  ['email', 'อีเมล', ['อีเมล', 'email', 'e-mail']],
  ['line_id', 'LINE ID', ['line', 'line id', 'ไลน์']],
  ['address', 'ที่อยู่', ['ที่อยู่', 'address']],
  ['pet_name', 'ชื่อสัตว์', ['ชื่อสัตว์', 'ชื่อสัตว์เลี้ยง', 'สัตว์เลี้ยง', 'pet', 'pet name', 'patient']],
  ['species', 'ชนิด', ['ชนิด', 'ประเภท', 'ชนิดสัตว์', 'species', 'type']],
  ['breed', 'สายพันธุ์', ['สายพันธุ์', 'พันธุ์', 'breed']],
  ['gender', 'เพศ', ['เพศ', 'sex', 'gender']],
  ['dob', 'วันเกิด', ['วันเกิด', 'วันเดือนปีเกิด', 'dob', 'birthday', 'birth date', 'date of birth']],
  ['color', 'สี', ['สี', 'สีขน', 'ตำหนิ', 'color', 'colour']],
  ['weight_kg', 'น้ำหนัก (กก.)', ['น้ำหนัก', 'weight', 'kg']],
  ['microchip_no', 'ไมโครชิป', ['ไมโครชิป', 'microchip', 'chip']],
  ['is_neutered', 'ทำหมัน', ['ทำหมัน', 'หมัน', 'neutered', 'spayed']],
  ['allergies', 'แพ้ยา / แพ้อาหาร', ['แพ้', 'แพ้ยา', 'allergy', 'allergies']],
  ['notes', 'หมายเหตุ', ['หมายเหตุ', 'note', 'notes', 'remark']],
  ['vaccine_name', 'ชื่อวัคซีน', ['วัคซีน', 'ชื่อวัคซีน', 'vaccine']],
  ['given_date', 'วันที่ฉีด', ['วันที่ฉีด', 'ฉีดวันที่', 'วันฉีด', 'given', 'given date', 'vaccination date']],
  ['next_due_date', 'นัดฉีดครั้งถัดไป', ['นัดครั้งถัดไป', 'ครั้งถัดไป', 'นัดฉีด', 'วันนัด', 'next due', 'due date', 'next']],
  ['batch_no', 'Lot / Batch', ['lot', 'batch', 'lot no', 'batch no', 'ล็อต']],
];
const DATE_FIELDS = new Set(['dob', 'given_date', 'next_due_date']);
const VACCINE_FIELDS = new Set(['vaccine_name', 'given_date', 'next_due_date', 'batch_no']);
// Vaccine history is a clinic record; other businesses import customers and pets only
const fields = () => (bizKind() === 'clinic' ? FIELDS : FIELDS.filter(([f]) => !VACCINE_FIELDS.has(f)));
const TEMPLATE = [
  ['ชื่อเจ้าของ', 'เบอร์โทร', 'ชื่อสัตว์', 'ชนิด', 'สายพันธุ์', 'เพศ', 'วันเกิด', 'วัคซีน', 'วันที่ฉีด', 'นัดครั้งถัดไป'],
  ['คุณนภัส ใจดี', '0812345678', 'Mochi', 'สุนัข', 'Pomeranian', 'เมีย', '14/03/2565', 'พิษสุนัขบ้า', '01/11/2569', '01/11/2570'],
  ['คุณนภัส ใจดี', '0812345678', 'Mochi', 'สุนัข', 'Pomeranian', 'เมีย', '14/03/2565', 'วัคซีนรวม', '01/10/2569', '01/10/2570'],
  ['คุณธนา รักแมว', '0898765432', 'Latte', 'แมว', 'Scottish Fold', 'ผู้', '2023-06-01', '', '', ''],
];

// ─── File reading ────────────────────────────────────────────────────────────

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  const delim = (text.split('\n', 1)[0].match(/\t/g) || []).length > (text.split('\n', 1)[0].match(/,/g) || []).length ? '\t' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function unzip(buffer) {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buffer, p + 46, nameLen));
    files[name] = { method, size, local };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return async name => {
    const f = files[name];
    if (!f) return null;
    const start = f.local + 30 + view.getUint16(f.local + 26, true) + view.getUint16(f.local + 28, true);
    const data = new Uint8Array(buffer, start, f.size);
    if (f.method === 0) return dec.decode(data);
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  };
}

async function parseXlsx(buffer) {
  const read = await unzip(buffer);
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const shared = [];
  const ss = await read('xl/sharedStrings.xml');
  if (ss) for (const si of xml(ss).getElementsByTagName('si')) shared.push([...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
  // First sheet in workbook order
  let target = 'xl/worksheets/sheet1.xml';
  const wb = await read('xl/workbook.xml');
  const rels = await read('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const first = xml(wb).getElementsByTagName('sheet')[0];
    const rid = first?.getAttribute('r:id') || first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = [...xml(rels).getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid);
    if (rel) target = 'xl/' + rel.getAttribute('Target').replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  const sheet = await read(target);
  if (!sheet) throw new Error('no sheet');
  const rows = [];
  for (const r of xml(sheet).getElementsByTagName('row')) {
    const out = [];
    for (const c of r.getElementsByTagName('c')) {
      const ref = c.getAttribute('r') || '';
      const col = ref.replace(/\d+/g, '').split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const val = t === 's' ? shared[Number(v)] ?? '' : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map(x => x.textContent).join('') : t === 'b' ? (v === '1' ? 'TRUE' : 'FALSE') : v;
      out[col >= 0 ? col : out.length] = { v: val, num: !t || t === 'n' };
    }
    rows[Number(r.getAttribute('r')) - 1 || rows.length] = Array.from(out, x => x || { v: '' });
  }
  return Array.from(rows, r => r || []);
}

async function readFile(file) {
  if (file.size > MAX_FILE) throw new Error('ไฟล์ใหญ่เกิน 8 MB');
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx')) return parseXlsx(await file.arrayBuffer());
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-874').decode(buf); // Thai Excel CSV
    return parseCsv(text.replace(/^﻿/, '')).map(r => r.map(v => ({ v, num: false })));
  }
  if (lower.endsWith('.xls')) throw new Error('ไฟล์ .xls รุ่นเก่า กรุณาบันทึกเป็น .xlsx หรือ .csv ก่อน');
  throw new Error('รองรับไฟล์ .xlsx และ .csv');
}

// ─── Value normalising ───────────────────────────────────────────────────────

const pad = n => String(n).padStart(2, '0');
function toDate(cell) {
  if (!cell || cell.v === '' || cell.v == null) return '';
  const raw = String(cell.v).trim();
  if (cell.num && /^\d+(\.\d+)?$/.test(raw) && Number(raw) > 1000 && Number(raw) < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(raw)) * 864e5);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  let y, m, d;
  let mt = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (mt) [, y, m, d] = mt.map(Number);
  else if ((mt = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) { [, d, m, y] = mt.map(Number); if (y < 100) y += y > 50 ? 2500 : 2000; }
  else return raw; // server marks it invalid
  if (y > 2400) y -= 543; // Buddhist year
  return `${y}-${pad(m)}-${pad(d)}`;
}
function toSpecies(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return 'dog';
  if (/สุนัข|หมา|dog|canine/.test(s)) return 'dog';
  if (/แมว|cat|feline/.test(s)) return 'cat';
  if (/กระต่าย|rabbit/.test(s)) return 'rabbit';
  if (/นก|bird/.test(s)) return 'bird';
  return 'other';
}
function toGender(v) {
  const s = String(v || '').trim().toLowerCase();
  if (/^(ผู้|ตัวผู้|เพศผู้|m|male|♂)/.test(s)) return 'male';
  if (/^(เมีย|ตัวเมีย|เพศเมีย|f|female|♀)/.test(s)) return 'female';
  return null;
}
const toBool = v => /^(y|yes|true|1|ใช่|ทำ|ทำแล้ว|ทำหมันแล้ว|✓)$/i.test(String(v || '').trim());
const norm = s => String(s || '').trim().toLowerCase().replace(/[\s_*().:-]+/g, ' ').trim();

function autoMap(headers) {
  const map = {};
  const used = new Set();
  for (const [field, , names] of fields()) {
    let idx = headers.findIndex((h, i) => !used.has(i) && names.some(n => norm(h) === norm(n)));
    if (idx < 0) idx = headers.findIndex((h, i) => !used.has(i) && names.some(n => norm(n).length > 2 && norm(h).includes(norm(n))));
    if (idx >= 0) { map[field] = idx; used.add(idx); }
  }
  return map;
}

function buildRows(data, map) {
  return data.map(r => {
    const get = f => (map[f] == null ? null : r[map[f]]);
    const out = {};
    for (const [field] of fields()) {
      const cell = get(field);
      if (cell == null) continue;
      if (DATE_FIELDS.has(field)) out[field] = toDate(cell);
      else if (field === 'species') out[field] = toSpecies(cell.v);
      else if (field === 'gender') out[field] = toGender(cell.v);
      else if (field === 'is_neutered') out[field] = toBool(cell.v);
      else out[field] = String(cell.v ?? '').trim();
    }
    return out;
  }).filter(r => Object.values(r).some(v => v && v !== 'dog'));
}

function downloadTemplate(clinic) {
  const rows = clinic ? TEMPLATE : TEMPLATE.map(r => r.slice(0, 7));
  const csv = '﻿' + rows.map(r => r.map(v => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'fufu-import-template.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ─── Sheet ───────────────────────────────────────────────────────────────────

export function openImportSheet({ onDone } = {}) {
  const storeId = storage.get(STORAGE_KEYS.STORE_ID);
  const clinic = bizKind() === 'clinic';
  const sheet = openSheet({ title: 'นำเข้าข้อมูลจาก Excel', subtitle: clinic ? 'ลูกค้า สัตว์เลี้ยง และประวัติวัคซีน' : 'ลูกค้าและสัตว์เลี้ยง', wide: true });
  let fileName = '';
  let headers = [];
  let data = [];
  let map = {};

  const stepFile = () => {
    sheet.body.innerHTML = `
      <label class="im-drop" for="im-file">
        <span class="im-drop__ic">${icon('download', 'w-6 h-6')}</span>
        <b>เลือกไฟล์ .xlsx หรือ .csv</b>
        <small>หรือลากไฟล์มาวางที่นี่ · แถวแรกต้องเป็นชื่อคอลัมน์ · ไม่เกิน ${MAX_ROWS.toLocaleString('th-TH')} แถว</small>
        <input type="file" id="im-file" accept=".xlsx,.csv,.tsv,.txt" hidden>
      </label>
      <div class="im-tips">
        <p><b>ไฟล์จากระบบเดิมใช้ได้เลย</b> ระบบจับคู่คอลัมน์ให้เอง เช่น "ชื่อเจ้าของ" "เบอร์โทร" "ชื่อสัตว์"${clinic ? ' "วัคซีน"' : ''} และแก้ได้ก่อนนำเข้า</p>
        <p>1 แถว = สัตว์ 1 ตัว${clinic ? ' (หรือวัคซีน 1 เข็ม)' : ''} ลูกค้าที่เบอร์ซ้ำจะรวมเป็นคนเดียว สัตว์ชื่อซ้ำของเจ้าของเดียวกันจะไม่ถูกสร้างซ้ำ</p>
        <p>วันที่ใช้ได้ทั้ง 31/12/2569, 31/12/2026 และ 2026-12-31</p>
      </div>
      <button type="button" class="ph-link" data-template>${icon('file-alt', 'w-4 h-4')} ดาวน์โหลดไฟล์ตัวอย่าง</button>`;
    sheet.foot.innerHTML = '<button type="button" class="ph-btn" data-sh-close>ปิด</button>';
    sheet.body.querySelector('[data-template]').onclick = () => downloadTemplate(clinic);
    const input = sheet.body.querySelector('#im-file');
    const drop = sheet.body.querySelector('.im-drop');
    const take = async file => {
      if (!file) return;
      drop.classList.add('is-busy');
      try {
        const rows = (await readFile(file)).filter(r => r.some(c => String(c?.v ?? '').trim()));
        if (rows.length < 2) throw new Error('ไม่พบข้อมูลในไฟล์');
        if (rows.length - 1 > MAX_ROWS) throw new Error(`ไฟล์มี ${rows.length - 1} แถว เกิน ${MAX_ROWS} แถว กรุณาแบ่งไฟล์`);
        fileName = file.name;
        headers = rows[0].map(c => String(c?.v ?? '').trim());
        data = rows.slice(1);
        map = autoMap(headers);
        stepMap();
      } catch (e) {
        showToast(e.message === 'not a zip' ? 'เปิดไฟล์ไม่ได้ ลองบันทึกเป็น .xlsx หรือ .csv ใหม่' : e.message || 'อ่านไฟล์ไม่สำเร็จ', 'error');
        drop.classList.remove('is-busy');
      }
    };
    input.onchange = () => take(input.files[0]);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('is-over'); };
    drop.ondragleave = () => drop.classList.remove('is-over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('is-over'); take(e.dataTransfer.files[0]); };
  };

  const stepMap = () => {
    const rows = buildRows(data, map);
    const preview = rows.slice(0, 5);
    const shown = fields().filter(([f]) => map[f] != null);
    sheet.body.innerHTML = `
      <p class="im-file">${icon('file-alt', 'w-4 h-4')}<b>${esc(fileName)}</b><span>${rows.length.toLocaleString('th-TH')} แถว</span><button type="button" class="ph-link" data-restart>เปลี่ยนไฟล์</button></p>
      <h4 class="im-h">จับคู่คอลัมน์</h4>
      <div class="im-map">
        ${fields().map(([field, label]) => `
          <label><span>${label}</span>
            <select data-field="${field}">
              <option value="">— ไม่ใช้ —</option>
              ${headers.map((h, i) => `<option value="${i}" ${map[field] === i ? 'selected' : ''}>${esc(h || `คอลัมน์ ${i + 1}`)}</option>`).join('')}
            </select>
          </label>`).join('')}
      </div>
      <h4 class="im-h">ตัวอย่าง 5 แถวแรก</h4>
      <div class="im-table"><table>
        <thead><tr>${shown.map(([, label]) => `<th>${esc(label.replace(' *', ''))}</th>`).join('')}</tr></thead>
        <tbody>${preview.map(r => `<tr>${shown.map(([f]) => `<td>${esc(f === 'species' ? { dog: 'สุนัข', cat: 'แมว', rabbit: 'กระต่าย', bird: 'นก', other: 'อื่นๆ' }[r[f]] : f === 'gender' ? ({ male: 'ผู้', female: 'เมีย' }[r[f]] || '') : f === 'is_neutered' ? (r[f] ? 'ทำแล้ว' : '') : r[f] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    sheet.foot.innerHTML = `<button type="button" class="ph-btn" data-sh-close>ยกเลิก</button><button type="button" class="ph-btn is-primary" data-check ${map.owner_name == null ? 'disabled' : ''}>ตรวจข้อมูล</button>`;
    sheet.body.querySelector('[data-restart]').onclick = stepFile;
    sheet.body.querySelectorAll('[data-field]').forEach(sel => {
      sel.onchange = () => {
        const v = sel.value === '' ? null : Number(sel.value);
        for (const k of Object.keys(map)) if (map[k] === v) delete map[k];
        if (v == null) delete map[sel.dataset.field]; else map[sel.dataset.field] = v;
        stepMap();
      };
    });
    sheet.foot.querySelector('[data-check]').onclick = () => run(rows, true);
  };

  const run = async (rows, dryRun) => {
    const total = { owners_new: 0, owners_matched: 0, pets_new: 0, pets_matched: 0, vaccines: 0, errors: 0 };
    const errors = [];
    sheet.foot.querySelectorAll('button').forEach(b => { b.disabled = true; });
    for (let i = 0; i < rows.length; i += CHUNK) {
      sheet.body.innerHTML = `<div class="im-progress"><b>${dryRun ? 'กำลังตรวจข้อมูล' : 'กำลังนำเข้า'}…</b><i><span style="width:${Math.round((i / rows.length) * 100)}%"></span></i><small>${i.toLocaleString('th-TH')} / ${rows.length.toLocaleString('th-TH')} แถว</small></div>`;
      const res = await apiFetch('/api/import/rows', { method: 'POST', body: JSON.stringify({ store_id: storeId, rows: rows.slice(i, i + CHUNK), dry_run: dryRun }) }).catch(() => null);
      if (!res?.success) {
        showToast(res?.error || 'เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง', 'error');
        if (dryRun) { stepMap(); return; }
        errors.push({ row: `${i + 2}–${Math.min(i + CHUNK, rows.length) + 1}`, errors: ['ส่งข้อมูลไม่สำเร็จ'] });
        total.errors += Math.min(CHUNK, rows.length - i);
        continue;
      }
      for (const k of Object.keys(total)) total[k] += res.data.summary[k] || 0;
      for (const r of res.data.results) if (!r.ok) errors.push({ row: i + r.index + 2, errors: r.errors });
    }
    stepResult(rows, total, errors, dryRun);
  };

  const stepResult = (rows, t, errors, dryRun) => {
    sheet.body.innerHTML = `
      ${dryRun ? '' : `<div class="im-done">${icon('check-circle', 'w-6 h-6')}<b>นำเข้าเรียบร้อย</b></div>`}
      <div class="im-sum">
        <div><b>${t.owners_new.toLocaleString('th-TH')}</b><small>เจ้าของใหม่</small><em>ซ้ำกับที่มีอยู่ ${t.owners_matched.toLocaleString('th-TH')}</em></div>
        <div><b>${t.pets_new.toLocaleString('th-TH')}</b><small>สัตว์เลี้ยงใหม่</small><em>มีอยู่แล้ว ${t.pets_matched.toLocaleString('th-TH')}</em></div>
        ${clinic ? `<div><b>${t.vaccines.toLocaleString('th-TH')}</b><small>ประวัติวัคซีน</small><em>ระบบจะเตือนลูกค้าตามวันนัด</em></div>` : ''}
        <div class="${t.errors ? 'is-warn' : ''}"><b>${t.errors.toLocaleString('th-TH')}</b><small>แถวที่มีปัญหา</small><em>${t.errors ? (dryRun ? 'จะถูกข้าม' : 'ไม่ได้นำเข้า') : 'ไม่มี'}</em></div>
      </div>
      ${errors.length ? `<h4 class="im-h">แถวที่ต้องแก้ในไฟล์</h4><ul class="im-errors">${errors.slice(0, 50).map(e => `<li><b>แถว ${e.row}</b> ${esc(e.errors.join(' · '))}</li>`).join('')}${errors.length > 50 ? `<li>และอีก ${errors.length - 50} แถว</li>` : ''}</ul>` : ''}
      ${dryRun ? '<p class="cl-note">ยังไม่มีอะไรถูกบันทึก ตรวจตัวเลขด้านบนแล้วกด "นำเข้า"</p>' : ''}`;
    const good = t.owners_new + t.owners_matched;
    sheet.foot.innerHTML = dryRun
      ? `<button type="button" class="ph-btn" data-back>แก้การจับคู่</button><button type="button" class="ph-btn is-primary" data-go ${good ? '' : 'disabled'}>นำเข้า ${good.toLocaleString('th-TH')} แถว</button>`
      : '<button type="button" class="ph-btn is-primary" data-sh-close>เสร็จสิ้น</button>';
    sheet.foot.querySelector('[data-back]')?.addEventListener('click', stepMap);
    sheet.foot.querySelector('[data-go]')?.addEventListener('click', () => run(rows, false));
    if (!dryRun) onDone?.();
  };

  stepFile();
}
