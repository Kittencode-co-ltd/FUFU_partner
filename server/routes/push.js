// Web Push opt-in for Partner Portal staff. The VAPID public key is not a secret; the private
// key never reaches this server (only the send-web-push edge function holds it).
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const LANGS = new Set(['th', 'en', 'zh', 'ja', 'ko']);

export function parseSubscription(body) {
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth.trim() : '';
  if (!/^https:\/\/\S+$/.test(endpoint) || endpoint.length > 2048) return null;
  if (!/^[A-Za-z0-9_-]{1,255}={0,2}$/.test(p256dh) || !/^[A-Za-z0-9_-]{1,255}={0,2}$/.test(auth)) return null;
  return { endpoint, p256dh, auth, locale: LANGS.has(body?.locale) ? body.locale : 'th' };
}

router.get('/config', (_req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  res.set('Cache-Control', 'no-store').json({ success: true, enabled: Boolean(publicKey), publicKey });
});

router.use(requireAuth);

router.post('/subscriptions', async (req, res) => {
  const sub = parseSubscription(req.body);
  if (!sub) return res.status(400).json({ success: false, error: 'ข้อมูลการสมัครรับแจ้งเตือนไม่ถูกต้อง' });
  const { error } = await req.supabase.rpc('register_push_subscription', {
    p_system: 'portal', p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth,
    p_locale: sub.locale, p_user_agent: String(req.headers['user-agent'] || '').slice(0, 512),
  });
  if (error) return res.status(500).json({ success: false, error: 'เปิดการแจ้งเตือนไม่สำเร็จ' });
  res.json({ success: true });
});

router.delete('/subscriptions', async (req, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
  if (!endpoint) return res.status(400).json({ success: false, error: 'ไม่พบข้อมูลอุปกรณ์' });
  const { error } = await req.supabase.from('push_subscriptions').delete()
    .eq('user_id', req.user.id).eq('system', 'portal').eq('endpoint', endpoint);
  if (error) return res.status(500).json({ success: false, error: 'ปิดการแจ้งเตือนไม่สำเร็จ' });
  res.json({ success: true });
});

export default router;
