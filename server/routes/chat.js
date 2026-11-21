// Store ↔ customer chat (business model phase 6). Customers start chats from the FUFU App; staff answer here.
// Reads and writes use the staff member's own session: RLS on chat_threads / chat_messages and the
// send_chat_message / mark_chat_read functions decide access (supabase/migrations/20261121000600_store_chat.sql).
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

const STAFF = ['owner', 'vet', 'reception', 'staff', 'counter'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE = 2.2 * 1024 * 1024;

function fail(res, error, status = 500) {
  const forbidden = error?.code === '42501';
  return res.status(forbidden ? 403 : status).json({ success: false, code: forbidden ? 'forbidden' : 'failed', error: 'Request failed' });
}

/** JPEG / PNG / WebP only, checked by the file's own bytes. */
function imageType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ['image/jpeg', 'jpg'];
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return ['image/png', 'png'];
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return ['image/webp', 'webp'];
  return null;
}

async function threadOfStore(req, id) {
  if (!UUID.test(id || '')) return null;
  const { data } = await req.supabase.from('chat_threads').select('id, store_id, user_id').eq('id', id).maybeSingle();
  return data && data.store_id === req.query.store_id ? data : null;
}

// GET /api/chat/threads?store_id — inbox, newest first, with the customer's name and phone (they started the chat)
router.get('/threads', requireRole(...STAFF), async (req, res) => {
  const { data, error } = await req.supabase.rpc('store_chat_threads', { p_store_id: req.query.store_id });
  if (error) return fail(res, error);
  const rows = data || [];
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data: rows, unread: rows.reduce((n, t) => n + (t.unread || 0), 0) });
});

// GET /api/chat/unread?store_id — for the menu badge
router.get('/unread', requireRole(...STAFF), async (req, res) => {
  const { data, error } = await req.supabase.from('chat_threads').select('store_unread').eq('store_id', req.query.store_id).gt('store_unread', 0);
  if (error) return fail(res, error);
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, unread: (data || []).reduce((n, t) => n + t.store_unread, 0) });
});

// GET /api/chat/threads/:id/messages?store_id&before — latest 50 (photos as 1-hour signed links); marks the chat read
router.get('/threads/:id/messages', requireRole(...STAFF), async (req, res) => {
  const thread = await threadOfStore(req, req.params.id);
  if (!thread) return res.status(404).json({ success: false, code: 'not_found' });
  let q = req.supabase.from('chat_messages').select('id, sender, body, image_path, created_at')
    .eq('thread_id', thread.id).order('created_at', { ascending: false }).limit(50);
  if (req.query.before && !Number.isNaN(Date.parse(req.query.before))) q = q.lt('created_at', req.query.before);
  const [{ data: rows, error }] = await Promise.all([q, req.supabase.rpc('mark_chat_read', { p_thread_id: thread.id })]);
  if (error) return fail(res, error);
  const msgs = (rows || []).reverse();
  const paths = msgs.map(m => m.image_path).filter(Boolean);
  const signed = new Map();
  if (paths.length) {
    const { data } = await req.supabase.storage.from('chat-images').createSignedUrls(paths, 3600);
    for (const s of data || []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  res.set('Cache-Control', 'private, no-store');
  res.json({
    success: true,
    data: msgs.map(m => ({ id: m.id, sender: m.sender, body: m.body, image_url: m.image_path ? signed.get(m.image_path) || null : null, created_at: m.created_at })),
    has_more: (rows || []).length === 50,
  });
});

// POST /api/chat/threads/:id/messages { store_id, body?, image? (data URL, JPEG/PNG/WebP ≤ 2.2 MB) }
router.post('/threads/:id/messages', requireRole(...STAFF), async (req, res) => {
  req.query.store_id = req.body.store_id;
  const thread = await threadOfStore(req, req.params.id);
  if (!thread) return res.status(404).json({ success: false, code: 'not_found' });
  const body = typeof req.body.body === 'string' ? req.body.body.slice(0, 2000) : '';
  let imagePath = null;
  if (typeof req.body.image === 'string' && req.body.image) {
    const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(req.body.image);
    const buf = m ? Buffer.from(m[1], 'base64') : null;
    const type = buf && imageType(buf);
    if (!type) return res.status(400).json({ success: false, code: 'bad_image_type' });
    if (buf.length > MAX_IMAGE) return res.status(413).json({ success: false, code: 'image_too_big' });
    imagePath = `${thread.id}/${randomUUID()}.${type[1]}`;
    const { error } = await req.supabase.storage.from('chat-images').upload(imagePath, buf, { contentType: type[0], upsert: false });
    if (error) return res.status(403).json({ success: false, code: 'upload_failed' });
  }
  const { data, error } = await req.supabase.rpc('send_chat_message', { p_thread_id: thread.id, p_body: body, p_image_path: imagePath });
  if (error) return fail(res, error);
  if (!data?.ok) return res.status(data?.code === 'too_fast' ? 429 : 400).json({ success: false, code: data?.code || 'failed' });
  res.json({ success: true, data: data.message });
});

export default router;
