import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ── Spin probability table (RPD §4.2) ────────────────────────────────────────
const SPIN_SEGMENTS = [
  { coins: 20,  weight: 35 },
  { coins: 30,  weight: 28 },
  { coins: 50,  weight: 20 },
  { coins: 80,  weight: 10 },
  { coins: 150, weight: 5  },
  { coins: 300, weight: 2  },
];
// weights sum to 100 for easy reading; total is used for safety
const TOTAL_WEIGHT = SPIN_SEGMENTS.reduce((s, x) => s + x.weight, 0);

function pickWinner() {
  let rand = Math.random() * TOTAL_WEIGHT;
  for (const seg of SPIN_SEGMENTS) {
    rand -= seg.weight;
    if (rand <= 0) return seg.coins;
  }
  return SPIN_SEGMENTS[0].coins;
}

/** Returns today's date in Asia/Bangkok as YYYY-MM-DD */
function todayBKK() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

/** Returns yesterday's date in Asia/Bangkok as YYYY-MM-DD */
function yesterdayBKK() {
  const d = new Date(Date.now() - 86_400_000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

/**
 * Upserts the coin balance for [userId] by [delta].
 * Throws if the resulting balance would be negative.
 * Returns the new balance.
 */
async function upsertCoins(sb, userId, delta) {
  const { data: row } = await sb
    .from('user_coins').select('balance').eq('user_id', userId).maybeSingle();
  const newBalance = (row?.balance ?? 0) + delta;
  if (newBalance < 0) throw new Error('Insufficient coins');
  await sb.from('user_coins').upsert({
    user_id: userId, balance: newBalance, updated_at: new Date().toISOString(),
  });
  return newBalance;
}

// ── GET /api/rewards/status ───────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = todayBKK();

    const [{ data: coinsRow }, { data: streak }] = await Promise.all([
      req.supabase.from('user_coins').select('balance').eq('user_id', userId).maybeSingle(),
      req.supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    const balance        = coinsRow?.balance       ?? 0;
    const currentStreak  = streak?.current_streak  ?? 0;
    const weeklySpinReady = streak?.weekly_spin_ready ?? false;
    const adToday = (streak?.ad_spins_reset_at === today)
      ? (streak?.ad_spins_today ?? 0) : 0;

    res.json({
      balance,
      streak:               currentStreak,
      weekly_spin_ready:    weeklySpinReady,
      days_until_weekly_spin: weeklySpinReady ? 0 : Math.max(0, 7 - currentStreak),
      ad_spins_remaining:   Math.max(0, 2 - adToday),
      last_checkin:         streak?.last_checkin_date ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/rewards/checkin ─────────────────────────────────────────────────
router.post('/checkin', async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = todayBKK();

    const { data: streak } = await req.supabase
      .from('user_streaks').select('*').eq('user_id', userId).maybeSingle();

    if (streak?.last_checkin_date === today) {
      return res.status(400).json({ error: 'Already checked in today' });
    }

    const isConsecutive = streak?.last_checkin_date === yesterdayBKK();
    const newStreak     = isConsecutive ? (streak.current_streak ?? 0) + 1 : 1;
    const weeklyReady   = newStreak >= 7;
    const CHECKIN_COINS = 5;

    const newBalance = await upsertCoins(req.supabase, userId, CHECKIN_COINS);

    await Promise.all([
      req.supabase.from('coin_transactions').insert({
        user_id: userId, type: 'checkin', amount: CHECKIN_COINS,
      }),
      req.supabase.from('user_streaks').upsert({
        user_id:           userId,
        current_streak:    newStreak,
        last_checkin_date: today,
        weekly_spin_ready: weeklyReady,
        ad_spins_today:    streak?.ad_spins_today    ?? 0,
        ad_spins_reset_at: streak?.ad_spins_reset_at ?? null,
      }),
    ]);

    res.json({
      coins_earned:      CHECKIN_COINS,
      new_balance:       newBalance,
      streak:            newStreak,
      weekly_spin_ready: weeklyReady,
      message:           `Check-in success! Streak ${newStreak} days`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/rewards/spin ────────────────────────────────────────────────────
router.post('/spin', async (req, res) => {
  try {
    const userId    = req.user.id;
    const spinType  = req.body.spin_type; // 'weekly' | 'ad'
    const today     = todayBKK();

    if (!['weekly', 'ad'].includes(spinType)) {
      return res.status(400).json({ error: 'spin_type must be "weekly" or "ad"' });
    }

    const { data: streak } = await req.supabase
      .from('user_streaks').select('*').eq('user_id', userId).maybeSingle();

    if (spinType === 'weekly') {
      if (!streak?.weekly_spin_ready) {
        return res.status(400).json({ error: 'Weekly spin not ready (streak < 7)' });
      }
    } else {
      const adToday = (streak?.ad_spins_reset_at === today)
        ? (streak?.ad_spins_today ?? 0) : 0;
      if (adToday >= 2) {
        return res.status(400).json({ error: 'Ad spin limit reached (max 2/day)' });
      }
    }

    const coinsEarned = pickWinner();
    const newBalance  = await upsertCoins(req.supabase, userId, coinsEarned);

    const adTodayOld = (streak?.ad_spins_reset_at === today)
      ? (streak?.ad_spins_today ?? 0) : 0;
    const adTodayNew = spinType === 'ad' ? adTodayOld + 1 : adTodayOld;

    await Promise.all([
      req.supabase.from('coin_transactions').insert({
        user_id: userId,
        type:    spinType === 'weekly' ? 'weekly_spin' : 'ad_spin',
        amount:  coinsEarned,
      }),
      req.supabase.from('user_streaks').upsert({
        user_id:           userId,
        current_streak:    spinType === 'weekly' ? 0 : (streak?.current_streak ?? 0),
        last_checkin_date: streak?.last_checkin_date ?? null,
        weekly_spin_ready: spinType === 'weekly' ? false : (streak?.weekly_spin_ready ?? false),
        ad_spins_today:    adTodayNew,
        ad_spins_reset_at: today,
      }),
    ]);

    res.json({
      coins_earned:       coinsEarned,
      new_balance:        newBalance,
      spin_type:          spinType,
      ad_spins_remaining: spinType === 'ad' ? Math.max(0, 2 - adTodayNew) : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/rewards/redeem ──────────────────────────────────────────────────
const REWARDS_CATALOG = {
  ai_scan_extra:       { coins: 300,  expires_days: 30 },
  partner_discount_10: { coins: 500,  expires_days: 30 },
  free_delivery:       { coins: 500,  expires_days: 7  },
  priority_booking:    { coins: 800,  expires_days: 30 },
  trial_7days:         { coins: 1500, expires_days: 7  },
  chat_history_30days: { coins: 200,  expires_days: 30 },
};

router.post('/redeem', async (req, res) => {
  try {
    const userId     = req.user.id;
    const rewardType = req.body.reward_type;
    const reward     = REWARDS_CATALOG[rewardType];
    if (!reward) {
      return res.status(400).json({ error: `Invalid reward_type: ${rewardType}` });
    }

    const { data: coinsRow } = await req.supabase
      .from('user_coins').select('balance').eq('user_id', userId).maybeSingle();
    if ((coinsRow?.balance ?? 0) < reward.coins) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    const expiresAt  = new Date(Date.now() + reward.expires_days * 86_400_000).toISOString();
    const newBalance = await upsertCoins(req.supabase, userId, -reward.coins);

    await req.supabase.from('coin_transactions').insert({
      user_id: userId, type: 'redeem', amount: -reward.coins, ref_id: rewardType,
    });
    const { data: redemption } = await req.supabase
      .from('reward_redemptions')
      .insert({
        user_id: userId, reward_type: rewardType,
        coins_spent: reward.coins, status: 'pending', expires_at: expiresAt,
      })
      .select().maybeSingle();

    res.json({
      success:     true,
      coins_spent: reward.coins,
      new_balance: newBalance,
      reward: { type: rewardType, expires_at: expiresAt, id: redemption?.id },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
