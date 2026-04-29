import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const ROOM_TYPES = { standard: { label: 'Standard', price: 400 }, deluxe: { label: 'Deluxe', price: 650 }, suite: { label: 'Suite', price: 900 } };

// GET /api/hotel/rooms?store_id=UUID
router.get('/rooms', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const { data: rooms, error } = await req.supabase
    .from('hotel_rooms').select('*').eq('store_id', store_id).order('room_number');
  if (error) return res.status(500).json({ error: error.message });

  // Attach current booking
  const occupied = rooms?.filter(r => r.status === 'occupied').map(r => r.id) || [];
  let bookingsMap = {};
  if (occupied.length) {
    const { data: bookings } = await req.supabase
      .from('hotel_bookings').select('*')
      .in('room_id', occupied).eq('status', 'checked_in');
    (bookings || []).forEach(b => { bookingsMap[b.room_id] = b; });
  }

  const enriched = (rooms || []).map(r => ({ ...r, current_booking: bookingsMap[r.id] || null }));
  res.json({ success: true, data: enriched });
});

// POST /api/hotel/rooms — create room
router.post('/rooms', async (req, res) => {
  const { store_id, room_number, room_type = 'standard', floor = 1, price_per_night } = req.body;
  if (!store_id || !room_number) return res.status(400).json({ error: 'store_id and room_number required' });

  const price = price_per_night || ROOM_TYPES[room_type]?.price || 400;
  const { data, error } = await req.supabase
    .from('hotel_rooms').insert([{ store_id, room_number, room_type, floor, price_per_night: price }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// POST /api/hotel/checkin
router.post('/checkin', async (req, res) => {
  const { store_id, room_id, pet_name, owner_name, owner_phone, species, check_in_date, check_out_date, notes, deposit_amount = 0 } = req.body;
  if (!store_id || !room_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'store_id, room_id, check_in_date, check_out_date required' });
  }

  const { data: room } = await req.supabase.from('hotel_rooms').select('price_per_night').eq('id', room_id).single();
  const nights = Math.max(1, Math.ceil((new Date(check_out_date) - new Date(check_in_date)) / 86400000));
  const total  = nights * (room?.price_per_night || 400);

  const { data: booking, error } = await req.supabase
    .from('hotel_bookings').insert([{
      store_id, room_id, pet_name, owner_name, owner_phone, species,
      check_in_date, check_out_date, nights, total_amount: total,
      deposit_amount, notes, status: 'checked_in',
      actual_checkin_at: new Date().toISOString(),
    }]).select().single();

  if (error) return res.status(500).json({ error: error.message });

  await req.supabase.from('hotel_rooms').update({ status: 'occupied' }).eq('id', room_id);
  res.json({ success: true, data: booking });
});

// POST /api/hotel/checkout/:booking_id
router.post('/checkout/:id', async (req, res) => {
  const { data: booking, error: bErr } = await req.supabase
    .from('hotel_bookings').select('*').eq('id', req.params.id).single();
  if (bErr) return res.status(404).json({ error: 'Booking not found' });

  await req.supabase.from('hotel_bookings')
    .update({ status: 'checked_out', actual_checkout_at: new Date().toISOString() })
    .eq('id', req.params.id);

  await req.supabase.from('hotel_rooms').update({ status: 'cleaning' }).eq('id', booking.room_id);

  res.json({ success: true, data: { ...booking, total_amount: booking.total_amount } });
});

// PATCH /api/hotel/rooms/:id — update room status
router.patch('/rooms/:id', async (req, res) => {
  const { data, error } = await req.supabase
    .from('hotel_rooms').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// GET /api/hotel/bookings?store_id=UUID
router.get('/bookings', async (req, res) => {
  const { store_id, status } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  let query = req.supabase.from('hotel_bookings').select('*, hotel_rooms(room_number,room_type)')
    .eq('store_id', store_id).order('created_at', { ascending: false }).limit(50);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data: data || [] });
});

export default router;
