// send-web-push: called by database triggers (pg_net) after a notification, booking request,
// review or pending store is written. Resolves who should hear about it, sends Web Push with
// the VAPID keys, and removes subscriptions the push service reports as gone (404/410).
//
// Secrets (names only — values live in Supabase secrets, never in the repo):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEB_PUSH_WEBHOOK_SECRET, ADMIN_EMAILS
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
// Deploy with: supabase functions deploy send-web-push --no-verify-jwt
// (the caller is the database, which proves itself with x-push-secret instead of a user JWT).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  bookingRequestMessage, customerMessage, isExpiredStatus, parseAdminEmails, reviewMessage,
  safeEqual, shouldPushNotification, storePendingMessage, storeRecipients, toLang,
  type AppointmentRow, type Lang, type NotificationRow, type PushPayload, type PushSystem, type ReviewRow, type StoreRow,
} from './messages.ts';

interface SubscriptionRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; locale: string }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const env = (name: string) => Deno.env.get(name) || '';

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!safeEqual(req.headers.get('x-push-secret') || '', env('WEB_PUSH_WEBHOOK_SECRET'))) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!env('VAPID_PUBLIC_KEY') || !env('VAPID_PRIVATE_KEY') || !env('VAPID_SUBJECT') || !env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) {
    return json({ error: 'Push is not configured' }, 503);
  }

  let job: { kind?: string; id?: string };
  try { job = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!job?.kind || typeof job.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(job.id)) return json({ error: 'Invalid job' }, 400);

  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });

  const loadStore = async (id: string | null | undefined) => {
    if (!id) return null;
    const { data } = await db.from('stores').select('id,name,owner_id,timezone').eq('id', id).maybeSingle();
    return data as StoreRow | null;
  };
  const loadAppointment = async (id: string | null | undefined) => {
    if (!id) return null;
    const { data } = await db.from('appointments')
      .select('id,user_id,store_id,status,pet_name,services,starts_at,proposed_starts_at,rejection_reason,cancelled_by')
      .eq('id', id).maybeSingle();
    return data as AppointmentRow | null;
  };
  const loadSubscriptions = async (system: PushSystem, userIds: string[]) => {
    if (!userIds.length) return [] as SubscriptionRow[];
    const { data, error } = await db.from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth,locale').eq('system', system).in('user_id', userIds);
    if (error) throw error;
    return (data || []) as SubscriptionRow[];
  };
  const storeMembers = async (store: StoreRow | null) => {
    if (!store) return [];
    const { data } = await db.from('staff').select('user_id').eq('store_id', store.id).eq('is_active', true);
    return storeRecipients(store, data || []);
  };

  let subscriptions: SubscriptionRow[] = [];
  let build: (lang: Lang) => PushPayload;

  try {
    if (job.kind === 'notification') {
      const { data } = await db.from('notifications').select('id,user_id,event_type,title,body,appointment_id').eq('id', job.id).maybeSingle();
      const row = data as NotificationRow | null;
      if (!row) return json({ sent: 0, skipped: 'not_found' });
      const appointment = await loadAppointment(row.appointment_id);
      if (!shouldPushNotification(row, appointment)) return json({ sent: 0, skipped: 'not_needed' });
      const store = await loadStore(appointment?.store_id);
      subscriptions = await loadSubscriptions('app', [row.user_id as string]);
      build = lang => customerMessage(row, lang, appointment, store);
    } else if (job.kind === 'booking_requested') {
      const appointment = await loadAppointment(job.id);
      if (!appointment) return json({ sent: 0, skipped: 'not_found' });
      const store = await loadStore(appointment.store_id);
      subscriptions = await loadSubscriptions('portal', await storeMembers(store));
      build = lang => bookingRequestMessage(appointment, lang, store);
    } else if (job.kind === 'review_created') {
      const { data } = await db.from('store_reviews').select('id,store_id,rating,comment').eq('id', job.id).maybeSingle();
      const review = data as ReviewRow | null;
      if (!review) return json({ sent: 0, skipped: 'not_found' });
      subscriptions = await loadSubscriptions('portal', await storeMembers(await loadStore(review.store_id)));
      build = lang => reviewMessage(review, lang);
    } else if (job.kind === 'store_pending') {
      const store = await loadStore(job.id);
      if (!store) return json({ sent: 0, skipped: 'not_found' });
      const allowed = parseAdminEmails(env('ADMIN_EMAILS'));
      if (!allowed.size) return json({ sent: 0, skipped: 'no_admins' });
      const { data } = await db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth,locale').eq('system', 'admin');
      // Re-check every admin row against the allowlist, in case an account lost admin access.
      const admins = new Set<string>();
      for (const userId of new Set((data || []).map(row => row.user_id as string))) {
        const { data: found } = await db.auth.admin.getUserById(userId);
        if (found?.user?.email && allowed.has(found.user.email.toLowerCase())) admins.add(userId);
      }
      subscriptions = ((data || []) as SubscriptionRow[]).filter(row => admins.has(row.user_id));
      build = lang => storePendingMessage(store, lang);
    } else {
      return json({ error: 'Unknown kind' }, 400);
    }
  } catch (error) {
    console.error('send-web-push lookup failed', job.kind, error instanceof Error ? error.message : error);
    return json({ error: 'Lookup failed' }, 500);
  }

  let sent = 0, removed = 0, failed = 0;
  await Promise.all(subscriptions.map(async sub => {
    const payload = build(toLang(sub.locale));
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24, urgency: 'high' },
      );
      sent++;
      await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq('id', sub.id);
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (isExpiredStatus(status)) {
        removed++;
        await db.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        failed++;
        console.error('send-web-push delivery failed', status ?? 'network');
        const { data } = await db.from('push_subscriptions').select('failure_count').eq('id', sub.id).maybeSingle();
        await db.from('push_subscriptions').update({ failure_count: (data?.failure_count || 0) + 1 }).eq('id', sub.id);
      }
    }
  }));

  return json({ sent, removed, failed });
});
