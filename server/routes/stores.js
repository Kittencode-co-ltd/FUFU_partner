import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, useStoreIdParam as storeIdParam } from '../middleware/rbac.js';
import { isTimezone } from '../utils/validation.js';

const router = Router();
router.use(requireAuth);

const STORE_FIELDS = 'id, name, category, branch_name, phone, email, address, description, location_lat, location_lng, timezone, tax_id, website, receipt_header_note, business_hours, default_service_rates, store_profile_image_url, can_sell_products, supports_pickup, supports_delivery, delivery_fee';
const BASE_STORE_FIELDS = 'id, name, category';
const OPTIONAL_STORE_FIELDS = ['branch_name','phone','email','address','description','location_lat','location_lng','timezone','tax_id','website','receipt_header_note','business_hours','default_service_rates','store_profile_image_url','can_sell_products','supports_pickup','supports_delivery','delivery_fee'];

function isMissingOptionalStoreField(error) {
  const message = String(error?.message || '').toLowerCase();
  const namesOptionalField = OPTIONAL_STORE_FIELDS.some(field => message.includes(field));
  return namesOptionalField && (message.includes('schema cache') || error?.code === 'PGRST204' || error?.code === '42703');
}

async function listStores(makeQuery) {
  const fields = STORE_FIELDS.split(',').map(field => field.trim());
  let result;
  while (fields.length > BASE_STORE_FIELDS.split(',').length) {
    result = await makeQuery(fields.join(', '));
    if (!result.error) return result;
    if (!isMissingOptionalStoreField(result.error)) return result;
    const missing = OPTIONAL_STORE_FIELDS.find(field => fields.includes(field) && String(result.error.message || '').toLowerCase().includes(field));
    if (!missing) return result;
    fields.splice(fields.indexOf(missing), 1);
  }
  return makeQuery(BASE_STORE_FIELDS);
}

// GET /api/stores — list stores for current user
router.get('/', async (req, res) => {
  let { data: stores, error } = await listStores((fields) => req.supabase
    .from('stores').select(fields).eq('owner_id', req.user.id));

  if (!stores?.length) {
    const byEmailResult = await listStores((fields) => req.supabase
      .from('stores').select(fields).eq('owner_email', req.user.email));
    stores = byEmailResult.data;
    error = byEmailResult.error;
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: stores || [] });
});

// POST /api/stores — create a new store
router.post('/', async (req, res) => {
  const { name, category, branch_name } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'name and category required' });
  }

  const store = { name, category, owner_id: req.user.id, owner_email: req.user.email, is_verified: false };
  if (branch_name) store.branch_name = branch_name;

  let { data, error } = await req.supabase
    .from('stores')
    .insert([store])
    .select(BASE_STORE_FIELDS)
    .single();

  // Older production schemas do not have branch_name. Retry without that
  // optional field so store onboarding remains available during migrations.
  if (isMissingOptionalStoreField(error) && Object.hasOwn(store, 'branch_name')) {
    delete store.branch_name;
    ({ data, error } = await req.supabase
      .from('stores')
      .insert([store])
      .select(BASE_STORE_FIELDS)
      .single());
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PATCH /api/stores/:id — update store settings (business_hours, default_service_rates, etc.)
router.patch('/:id', storeIdParam('id'), requireRole('owner'), async (req, res) => {
  const ALLOWED = new Set(['name', 'branch_name', 'phone', 'email', 'address', 'description', 'timezone', 'tax_id', 'website', 'receipt_header_note', 'business_hours', 'default_service_rates', 'can_sell_products', 'supports_pickup', 'supports_delivery', 'delivery_fee']);
  const updates = {};
  for (const [k, v] of Object.entries(req.body)) {
    if (ALLOWED.has(k)) updates[k] = v;
  }
  if (req.body.latitude !== undefined) updates.location_lat = req.body.latitude;
  if (req.body.longitude !== undefined) updates.location_lng = req.body.longitude;
  if (updates.address !== undefined) {
    if (typeof updates.address !== 'string' || updates.address.trim().length > 1000) return res.status(400).json({ error: 'กรุณากรอกที่อยู่ร้านไม่เกิน 1,000 ตัวอักษร' });
    updates.address = updates.address.trim() || null;
  }
  if (updates.location_lat != null && (!Number.isFinite(Number(updates.location_lat)) || Number(updates.location_lat) < -90 || Number(updates.location_lat) > 90)) {
    return res.status(400).json({ error: 'Invalid latitude' });
  }
  if (updates.location_lng != null && (!Number.isFinite(Number(updates.location_lng)) || Number(updates.location_lng) < -180 || Number(updates.location_lng) > 180)) {
    return res.status(400).json({ error: 'Invalid longitude' });
  }
  if (updates.location_lat != null) updates.location_lat = Number(updates.location_lat);
  if (updates.location_lng != null) updates.location_lng = Number(updates.location_lng);
  if (updates.timezone !== undefined && !isTimezone(updates.timezone)) return res.status(400).json({ error: 'Invalid timezone' });
  for (const field of ['can_sell_products','supports_pickup','supports_delivery']) if (updates[field] !== undefined && typeof updates[field] !== 'boolean') return res.status(400).json({ error: `Invalid ${field}` });
  if (updates.delivery_fee !== undefined && (!Number.isFinite(Number(updates.delivery_fee)) || Number(updates.delivery_fee) < 0 || Number(updates.delivery_fee) > 100000)) return res.status(400).json({ error: 'Invalid delivery_fee' });
  if (updates.delivery_fee !== undefined) updates.delivery_fee = Number(updates.delivery_fee);
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'no valid fields' });

  // A store that takes product orders (delivery or pickup) must have an address and a map pin, so customers can find it
  if (updates.supports_delivery === true || updates.can_sell_products === true || updates.supports_pickup === true || updates.address !== undefined || updates.location_lat !== undefined || updates.location_lng !== undefined) {
    const { data: current, error: currentError } = await req.supabase.from('stores')
      .select('address,location_lat,location_lng,supports_delivery,can_sell_products').eq('id', req.params.id).single();
    if (currentError || !current) return res.status(404).json({ error: 'Store not found' });
    const nextAddress = updates.address !== undefined ? updates.address : current.address;
    const nextLatitude = updates.location_lat !== undefined ? updates.location_lat : current.location_lat;
    const nextLongitude = updates.location_lng !== undefined ? updates.location_lng : current.location_lng;
    const deliveryEnabled = updates.supports_delivery !== undefined ? updates.supports_delivery : current.supports_delivery;
    const sellingEnabled = updates.can_sell_products !== undefined ? updates.can_sell_products : current.can_sell_products;
    const missingLocation = !String(nextAddress || '').trim() || nextLatitude == null || nextLongitude == null;
    if (deliveryEnabled && missingLocation) {
      return res.status(400).json({ error: 'กรุณากรอกที่อยู่ร้านและปักหมุดตำแหน่งร้านก่อนเปิดรับจัดส่ง' });
    }
    if (sellingEnabled && missingLocation) {
      return res.status(400).json({ error: 'กรุณากรอกที่อยู่ร้านและปักหมุดตำแหน่งร้านก่อนเปิดรับคำสั่งซื้อ ลูกค้าต้องใช้หมุดนี้เดินทางมารับสินค้า' });
    }
  }

  const { data, error } = await req.supabase
    .from('stores')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

export default router;
