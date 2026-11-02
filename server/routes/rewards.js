import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Compatibility aliases for older partner/native clients.
const aliases = {
  ai_scan_extra: 'scan_plus_1', partner_discount_10: 'discount_10pct',
  trial_7days: 'vip_trial_7d', chat_history_30days: 'chat_history_30d',
};

router.get('/status', async (req, res) => {
  try {
    const { data, error } = await req.supabase.rpc('reward_status');
    if (error) return res.status(503).json({ error: 'Rewards unavailable' });
    res.json(data);
  } catch { res.status(503).json({ error: 'Rewards unavailable' }); }
});

for (const endpoint of ['checkin', 'spin', 'redeem']) {
  router.post('/' + endpoint, async (req, res) => {
    try {
      if (endpoint === 'spin' && req.body?.spin_type !== 'weekly') {
        return res.status(400).json({ error: 'Verified ad rewards are not available yet' });
      }
      const rewardType = req.body?.reward_type;
      if (endpoint === 'redeem' && typeof rewardType !== 'string') {
        return res.status(400).json({ error: 'Missing reward_type' });
      }
      const { data, error } = await req.supabase.rpc('reward_action', {
        p_action: endpoint === 'spin' ? 'weekly' : endpoint,
        p_request_id: req.body?.request_id ?? randomUUID(),
        p_reward_type: endpoint === 'redeem' ? (aliases[rewardType] ?? rewardType) : null,
      });
      if (error) return res.status(error.code === '22023' ? 409 : 503)
        .json({ error: error.code === '22023' ? error.message : 'Rewards unavailable' });
      res.json(data);
    } catch { res.status(503).json({ error: 'Rewards unavailable' }); }
  });
}
export default router;
