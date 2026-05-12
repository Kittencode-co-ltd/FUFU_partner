import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ─── Default Thai vet clinic service catalog ──────────────────────────────────

const DEFAULTS = [
  // consultation
  { name: 'ค่าตรวจทั่วไป',              category: 'consultation', price: 200, unit: 'ครั้ง' },
  { name: 'ค่าตรวจพิเศษ',              category: 'consultation', price: 400, unit: 'ครั้ง' },
  { name: 'ค่าตรวจฉุกเฉิน',            category: 'consultation', price: 600, unit: 'ครั้ง' },
  // vaccination
  { name: 'วัคซีนรวม 5 โรค (สุนัข)',   category: 'vaccination',  price: 400, unit: 'ครั้ง' },
  { name: 'วัคซีนรวม 4 โรค (แมว)',     category: 'vaccination',  price: 400, unit: 'ครั้ง' },
  { name: 'วัคซีนพิษสุนัขบ้า',         category: 'vaccination',  price: 200, unit: 'ครั้ง' },
  { name: 'บูสเตอร์วัคซีน',            category: 'vaccination',  price: 300, unit: 'ครั้ง' },
  // surgery
  { name: 'ผ่าตัดทำหมันเพศเมีย',       category: 'surgery',      price: 2500, unit: 'ครั้ง' },
  { name: 'ผ่าตัดทำหมันเพศผู้',        category: 'surgery',      price: 1500, unit: 'ครั้ง' },
  { name: 'ค่าดมยาสลบ',               category: 'surgery',      price: 1500, unit: 'ครั้ง' },
  { name: 'ผ่าตัดทั่วไป',              category: 'surgery',      price: 3000, unit: 'ครั้ง' },
  // laboratory
  { name: 'ตรวจเลือด CBC',             category: 'laboratory',   price: 500,  unit: 'ครั้ง' },
  { name: 'ตรวจเลือด Chemistry',       category: 'laboratory',   price: 800,  unit: 'ครั้ง' },
  { name: 'ตรวจเลือด CBC + Chemistry', category: 'laboratory',   price: 1200, unit: 'ครั้ง' },
  { name: 'ตรวจปัสสาวะ',              category: 'laboratory',   price: 300,  unit: 'ครั้ง' },
  { name: 'ตรวจอุจจาระ',              category: 'laboratory',   price: 250,  unit: 'ครั้ง' },
  // imaging
  { name: 'X-ray 1 ท่า',              category: 'imaging',      price: 600,  unit: 'ครั้ง' },
  { name: 'X-ray 2 ท่า',              category: 'imaging',      price: 900,  unit: 'ครั้ง' },
  { name: 'Ultrasound',               category: 'imaging',      price: 800,  unit: 'ครั้ง' },
  // grooming
  { name: 'ค่าอาบน้ำ (เล็ก)',          category: 'grooming',     price: 250,  unit: 'ครั้ง' },
  { name: 'ค่าอาบน้ำ (กลาง)',          category: 'grooming',     price: 350,  unit: 'ครั้ง' },
  { name: 'ค่าอาบน้ำ (ใหญ่)',          category: 'grooming',     price: 500,  unit: 'ครั้ง' },
  { name: 'ค่าตัดขน',                 category: 'grooming',     price: 300,  unit: 'ครั้ง' },
  { name: 'ค่าตัดเล็บ',               category: 'grooming',     price: 100,  unit: 'ครั้ง' },
  { name: 'ค่าทำความสะอาดหู',          category: 'grooming',     price: 100,  unit: 'ครั้ง' },
  { name: 'ค่าแปรงฟัน',               category: 'grooming',     price: 120,  unit: 'ครั้ง' },
  // boarding
  { name: 'ค่าพักรักษาตัว/วัน',       category: 'boarding',     price: 500,  unit: 'วัน' },
  { name: 'ค่าพักรักษาตัว ICU/วัน',   category: 'boarding',     price: 1000, unit: 'วัน' },
  // procedure
  { name: 'ค่าฉีดยา',                 category: 'procedure',    price: 80,   unit: 'ครั้ง' },
  { name: 'น้ำเกลือ/ถุง',             category: 'procedure',    price: 150,  unit: 'ถุง' },
  { name: 'ค่าทำแผล',                 category: 'procedure',    price: 300,  unit: 'ครั้ง' },
  { name: 'ค่าล้างแผล',               category: 'procedure',    price: 150,  unit: 'ครั้ง' },
  { name: 'ค่าทำฟัน (Dental scaling)', category: 'procedure',   price: 1500, unit: 'ครั้ง' },
  { name: 'ค่า Ear cleaning',          category: 'procedure',    price: 150,  unit: 'ครั้ง' },
  // other
  { name: 'ค่า Microchip',             category: 'other',        price: 500,  unit: 'ครั้ง' },
  { name: 'ค่าออกใบรับรอง',            category: 'other',        price: 200,  unit: 'ครั้ง' },
  { name: 'ค่ายาถ่ายพยาธิ',           category: 'other',        price: 150,  unit: 'ครั้ง' },
];

const CATEGORY_LABELS = {
  consultation: 'ค่าตรวจ',
  vaccination:  'วัคซีน',
  surgery:      'ผ่าตัด',
  laboratory:   'แลป',
  imaging:      'X-ray / Ultrasound',
  grooming:     'Grooming',
  boarding:     'พักรักษาตัว',
  procedure:    'หัตถการ',
  other:        'อื่นๆ',
};

// ─── GET /api/service-items?store_id=UUID&category=...&q=... ──────────────────

router.get('/', async (req, res) => {
  const { store_id, category, q } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let query = req.supabase
    .from('service_items')
    .select('*')
    .eq('store_id', store_id)
    .eq('is_active', true)
    .order('use_count', { ascending: false })
    .order('name');

  if (category) query = query.eq('category', category);
  if (q)        query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Group by category for UI convenience
  const grouped = {};
  for (const item of data || []) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  res.json({
    success: true,
    data:    data || [],
    grouped,
    category_labels: CATEGORY_LABELS,
  });
});

// ─── POST /api/service-items/seed — idempotent default seeder ─────────────────

router.post('/seed', async (req, res) => {
  const { store_id } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  // Only seed items that don't already exist (active items by name + store_id)
  const { data: existing } = await req.supabase
    .from('service_items')
    .select('name')
    .eq('store_id', store_id)
    .eq('is_active', true);

  const existingNames = new Set((existing || []).map(r => r.name));
  const toInsert = DEFAULTS
    .filter(d => !existingNames.has(d.name))
    .map(d => ({ ...d, store_id, is_default: true }));

  if (!toInsert.length) {
    return res.json({ success: true, inserted: 0, message: 'ข้อมูลเริ่มต้นมีอยู่แล้ว' });
  }

  const { data, error } = await req.supabase
    .from('service_items')
    .insert(toInsert)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, inserted: data.length });
});

// ─── POST /api/service-items ──────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { store_id, name, category = 'other', price = 0, unit = 'ครั้ง' } = req.body;
  if (!store_id || !name?.trim()) {
    return res.status(400).json({ error: 'store_id and name required' });
  }

  const { data, error } = await req.supabase
    .from('service_items')
    .insert([{ store_id, name: name.trim(), category, price: parseFloat(price) || 0, unit }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// ─── PATCH /api/service-items/:id ─────────────────────────────────────────────

router.patch('/:id', async (req, res) => {
  const allowed = ['name', 'category', 'price', 'unit', 'is_active'];
  const updates = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  const { data, error } = await req.supabase
    .from('service_items')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// ─── DELETE /api/service-items/:id — soft delete ──────────────────────────────

router.delete('/:id', async (req, res) => {
  const { error } = await req.supabase
    .from('service_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── POST /api/service-items/:id/use — increment use_count ───────────────────

router.post('/:id/use', async (req, res) => {
  const { error } = await req.supabase.rpc('increment_service_use', { item_id: req.params.id });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
