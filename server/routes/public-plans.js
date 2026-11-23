// Public clinic packages for the website pricing section (no sign-in). Reads only active rows of clinic_plans
// through the publishable key and the clinic_plans_public_read policy.
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(process.env.Project_URL, process.env.publishable_key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('clinic_plans')
    .select('code, name, description, price_monthly, price_yearly, max_users, is_popular, features, sort')
    .eq('is_active', true).order('sort').order('price_monthly');
  if (error) return res.status(500).json({ success: false, error: 'Unable to load packages' });
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({ success: true, data: data || [] });
});

export default router;
