// Bulk import of customers, pets and vaccine history from a spreadsheet (owner only), so a clinic can move
// over from its old system. The browser reads the .xlsx/.csv file and maps the columns
// (public/js/partner/import-data.js); this route checks each row and, unless dry_run, saves it with the
// signed-in user's Supabase client (RLS applies). Existing owners are matched by phone and existing pets by
// name under that owner, so running the same file twice does not create duplicates.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { insertWithSeqRetry } from '../utils/seq-retry.js';

const router = Router();
router.use(requireAuth);

const MAX_ROWS = 200;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SPECIES = new Set(['dog', 'cat', 'rabbit', 'bird', 'other']);
const GENDER = new Set(['male', 'female', 'unknown']);
const text = (v, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));
const phoneKey = v => text(v, 40).replace(/\D/g, '').replace(/^66(?=\d{9}$)/, '0');
const nameKey = v => text(v, 120).toLowerCase().replace(/\s+/g, ' ');
const date = v => { const s = text(v, 10); return DAY.test(s) && !Number.isNaN(Date.parse(s)) ? s : null; };
const number = v => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) && n > 0 && n < 500 ? n : null; };

// Clean one row; returns { row, errors }
function clean(raw) {
  const errors = [];
  const row = {
    owner_name: text(raw.owner_name, 120), phone: text(raw.phone, 40), email: text(raw.email, 160).toLowerCase() || null,
    line_id: text(raw.line_id, 80) || null, address: text(raw.address, 300) || null,
    pet_name: text(raw.pet_name, 80), species: SPECIES.has(raw.species) ? raw.species : 'other',
    breed: text(raw.breed, 80) || null, gender: GENDER.has(raw.gender) ? raw.gender : null,
    dob: date(raw.dob), color: text(raw.color, 60) || null, weight_kg: number(raw.weight_kg),
    microchip_no: text(raw.microchip_no, 40) || null, is_neutered: raw.is_neutered === true,
    allergies: text(raw.allergies, 300) || null, notes: text(raw.notes, 500) || null,
    vaccine_name: text(raw.vaccine_name, 120) || null, given_date: date(raw.given_date), next_due_date: date(raw.next_due_date),
    batch_no: text(raw.batch_no, 60) || null,
  };
  if (!row.owner_name) errors.push('ไม่มีชื่อเจ้าของ');
  if (!phoneKey(row.phone) && !row.pet_name) errors.push('ต้องมีเบอร์โทรหรือชื่อสัตว์');
  if (raw.dob && !row.dob) errors.push('วันเกิดไม่ถูกต้อง');
  if (row.vaccine_name && !row.given_date) errors.push('วัคซีนไม่มีวันที่ฉีด');
  if (raw.next_due_date && !row.next_due_date) errors.push('วันนัดวัคซีนไม่ถูกต้อง');
  return { row, errors };
}

// POST /api/import/rows { store_id, rows: [...], dry_run }
router.post('/rows', requireRole('owner'), async (req, res) => {
  const storeId = req.body.store_id;
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const dryRun = req.body.dry_run !== false;
  if (!rows.length || rows.length > MAX_ROWS) return res.status(400).json({ success: false, error: `ส่งได้ครั้งละ 1–${MAX_ROWS} แถว` });
  const sb = req.supabase;
  // Vaccine history belongs to clinics; other businesses import customers and pets only
  const { data: store } = await sb.from('stores').select('category').eq('id', storeId).maybeSingle();
  const withVaccines = ['vet_clinic', 'vet_hospital'].includes(String(store?.category || '').toLowerCase());

  // What this store already has: its pets with their owners (owners are linked to a store through pets)
  const { data: existing, error: loadError } = await sb.from('pets')
    .select('id, name, owner_id, pet_owners(id, name, phone)').eq('store_id', storeId).is('merged_into', null).limit(50000);
  if (loadError) return res.status(500).json({ success: false, error: 'โหลดข้อมูลเดิมไม่สำเร็จ' });
  const ownerByPhone = new Map();
  const petByOwnerName = new Map();
  for (const p of existing || []) {
    const key = phoneKey(p.pet_owners?.phone);
    if (key && p.pet_owners) ownerByPhone.set(key, p.pet_owners.id);
    petByOwnerName.set(`${p.owner_id}|${nameKey(p.name)}`, p.id);
  }

  const results = [];
  const summary = { owners_new: 0, owners_matched: 0, pets_new: 0, pets_matched: 0, vaccines: 0, errors: 0 };
  for (let i = 0; i < rows.length; i++) {
    const { row, errors } = clean(rows[i] || {});
    if (errors.length) { summary.errors += 1; results.push({ index: i, ok: false, errors }); continue; }
    const result = { index: i, ok: true, owner: 'new', pet: row.pet_name ? 'new' : null, vaccine: withVaccines && !!row.vaccine_name };
    try {
      const pk = phoneKey(row.phone);
      let ownerId = pk ? ownerByPhone.get(pk) : null;
      if (ownerId) result.owner = 'matched';
      if (!ownerId && !dryRun) {
        const { data, error } = await sb.from('pet_owners')
          .insert([{ name: row.owner_name, phone: row.phone || null, email: row.email, line_id: row.line_id, address: row.address }])
          .select('id').single();
        if (error) throw error;
        ownerId = data.id;
      }
      if (!ownerId) ownerId = `new:${pk || i}`; // dry run: later rows with the same phone count as matched
      if (pk && !ownerByPhone.has(pk)) ownerByPhone.set(pk, ownerId);
      summary[result.owner === 'matched' ? 'owners_matched' : 'owners_new'] += 1;

      let petId = null;
      if (row.pet_name) {
        const petKey = `${ownerId}|${nameKey(row.pet_name)}`;
        petId = petByOwnerName.get(petKey) || null;
        if (petId) result.pet = 'matched';
        if (!petId && !dryRun) {
          const { data, error } = await insertWithSeqRetry(async () => {
            const { data: last } = await sb.from('pets').select('hn').eq('store_id', storeId).order('hn', { ascending: false }).limit(1);
            return sb.from('pets').insert([{
              owner_id: ownerId, store_id: storeId, hn: (last?.[0]?.hn || 0) + 1, name: row.pet_name, species: row.species, type: row.species,
              breed: row.breed, gender: row.gender, dob: row.dob, color: row.color, weight_kg: row.weight_kg, microchip_no: row.microchip_no,
              is_neutered: row.is_neutered, allergies: row.allergies, notes: row.notes,
            }]).select('id').single();
          });
          if (error) throw error;
          petId = data.id;
        }
        if (!petId) petId = `new:${petKey}`;
        petByOwnerName.set(petKey, petId);
        summary[result.pet === 'matched' ? 'pets_matched' : 'pets_new'] += 1;
      }

      if (withVaccines && row.vaccine_name && row.pet_name) {
        if (!dryRun) {
          const { error } = await sb.from('pet_vaccinations').insert([{
            pet_id: petId, store_id: storeId, vaccine_name: row.vaccine_name, given_date: row.given_date,
            next_due_date: row.next_due_date, batch_no: row.batch_no, notes: 'นำเข้าจากไฟล์',
          }]);
          if (error) throw error;
        }
        summary.vaccines += 1;
      }
    } catch (error) {
      console.warn('[import] row failed:', error?.code || error?.message);
      summary.errors += 1;
      results.push({ index: i, ok: false, errors: ['บันทึกไม่สำเร็จ'] });
      continue;
    }
    results.push(result);
  }

  if (!dryRun) {
    await sb.from('audit_logs').insert({
      store_id: storeId, action: 'create', entity_type: 'pets', entity_id: null,
      new_data: summary, reason: 'นำเข้าข้อมูลลูกค้าและสัตว์เลี้ยงจากไฟล์',
    }).then(() => {}, () => {});
  }
  res.json({ success: true, data: { dry_run: dryRun, summary, results } });
});

export default router;
