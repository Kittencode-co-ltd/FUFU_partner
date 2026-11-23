// Automatic customer reminders (vaccines due, appointments tomorrow) sent in the FUFU app every morning.
// The job itself runs in the database (pg_cron → run_care_reminders); this route reads the overview and
// lets the store owner change the settings. See supabase/migrations/20261124000200_care_reminders.sql.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

function fail(res, error) {
  const forbidden = error?.code === '42501';
  return res.status(forbidden ? 403 : 500).json({ success: false, code: forbidden ? 'forbidden' : 'failed', error: forbidden ? 'เฉพาะเจ้าของร้าน' : 'Request failed' });
}

// GET /api/reminders?store_id — settings, reminders sent in 30 days, vaccines due soon
router.get('/', requireRole('owner', 'vet', 'reception', 'staff'), async (req, res) => {
  const { data, error } = await req.supabase.rpc('store_reminder_overview', { p_store_id: req.query.store_id });
  if (error) return fail(res, error);
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data });
});

// PUT /api/reminders/settings { store_id, vaccine_enabled, vaccine_days: [7, 0], appointment_enabled }
router.put('/settings', requireRole('owner'), async (req, res) => {
  const days = Array.isArray(req.body.vaccine_days) ? req.body.vaccine_days.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 60).slice(0, 4) : [];
  const { data, error } = await req.supabase.rpc('set_reminder_settings', {
    p_store_id: req.body.store_id, p_vaccine_enabled: req.body.vaccine_enabled !== false,
    p_vaccine_days: days, p_appointment_enabled: req.body.appointment_enabled !== false,
  });
  if (error) return fail(res, error);
  if (!data?.ok) return res.status(400).json({ success: false, code: data?.code || 'invalid' });
  res.json({ success: true });
});

export default router;
