import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IN_APP_BROWSER } from '../public/js/utils/in-app-browser.js';
import {
  bookingRequestMessage, customerMessage, isExpiredStatus, parseAdminEmails, reviewMessage,
  safeEqual, shouldPushNotification, storePendingMessage, storeRecipients, toLang,
} from '../supabase/functions/send-web-push/messages.ts';

const migration = readFileSync(new URL('../supabase/migrations/20261115130000_web_push_subscriptions.sql', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const pushClient = readFileSync(new URL('../public/js/partner/push-notifications.js', import.meta.url), 'utf8');

const notif = (over = {}) => ({ id: 'n1', user_id: 'u1', event_type: 'appointment_confirmed', title: 'ยืนยันการจองแล้ว', body: null, appointment_id: 'a1', ...over });

test('customer pushes are localized and open the bookings page', () => {
  const appt = { id: 'a1', pet_name: 'Mochi', starts_at: '2026-11-20T03:00:00Z' };
  const msg = customerMessage(notif(), 'en', appt, { id: 's1', name: 'Happy Vet' });
  assert.equal(msg.title, 'Booking confirmed');
  assert.match(msg.body, /Happy Vet · Mochi · /);
  assert.equal(msg.url, '/appointments');
  assert.equal(msg.tag, 'appt-a1');
  assert.equal(msg.system, 'app');
  const rejected = customerMessage(notif({ event_type: 'appointment_rejected' }), 'th', { id: 'a1', rejection_reason: 'คิวเต็ม' });
  assert.equal(rejected.body, 'เหตุผล: คิวเต็ม');
});

test('customer is not pushed about a cancellation they made', () => {
  assert.equal(shouldPushNotification(notif({ event_type: 'appointment_cancelled' }), { id: 'a1', cancelled_by: 'u1' }), false);
  assert.equal(shouldPushNotification(notif({ event_type: 'appointment_cancelled' }), { id: 'a1', cancelled_by: 'staff1' }), true);
  assert.equal(shouldPushNotification(notif({ user_id: null })), false);
});

test('staff and admin messages point at their own system', () => {
  const booking = bookingRequestMessage({ id: 'a2', pet_name: 'Tofu', services: ['อาบน้ำ'], starts_at: '2026-11-20T03:00:00Z' }, 'ja');
  assert.equal(booking.title, '新しい予約リクエスト');
  assert.equal(booking.url, '/dashboard?page=appointments');
  assert.equal(booking.system, 'portal');
  const review = reviewMessage({ id: 'r1', store_id: 's1', rating: 4, comment: '' }, 'ko');
  assert.equal(review.title, '새 리뷰 ★★★★☆');
  assert.equal(review.body, '코멘트 없음');
  const store = storePendingMessage({ id: 's9', name: 'New Clinic' }, 'zh');
  assert.deepEqual([store.title, store.url, store.system], ['新店铺待审核', '/partners', 'admin']);
});

test('recipient and security helpers', () => {
  assert.deepEqual(storeRecipients({ id: 's1', owner_id: 'o1' }, [{ user_id: 'o1' }, { user_id: 'st1' }, { user_id: null }]), ['o1', 'st1']);
  assert.deepEqual([...parseAdminEmails(' A@x.com, b@y.com ,')], ['a@x.com', 'b@y.com']);
  assert.equal(parseAdminEmails('').size, 0);
  assert.equal(isExpiredStatus(410), true);
  assert.equal(isExpiredStatus(404), true);
  assert.equal(isExpiredStatus(500), false);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('', ''), false);
  assert.equal(toLang('xx'), 'th');
});

test('push_subscriptions is owner-only and browsers cannot create admin rows', () => {
  assert.match(migration, /alter table public\.push_subscriptions force row level security/);
  assert.match(migration, /unique \(user_id, endpoint, system\)/);
  assert.match(migration, /push_subscriptions_own_insert[\s\S]*?with check \(user_id = auth\.uid\(\) and system in \('app','portal'\)\)/);
  assert.match(migration, /revoke all on function public\.dispatch_web_push\(text, uuid\) from public, anon, authenticated/);
  assert.doesNotMatch(migration, /eyJ|sb_secret_|BEGIN PRIVATE KEY/);
});

test('portal service worker handles push and never prompts on load', () => {
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /addEventListener\('notificationclick'/);
  assert.match(pushClient, /requestPermission/);
  assert.doesNotMatch(pushClient, /DOMContentLoaded[\s\S]{0,200}requestPermission/);
});

test('in-app browsers (LINE, Facebook…) get an "open in browser" hint instead of a dead switch', () => {
  const re = IN_APP_BROWSER;
  assert.ok(re.test('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari Line/14.3.0'));
  assert.ok(re.test('Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0;]'));
  assert.ok(!re.test('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36'));
  assert.ok(!re.test('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1'));
  assert.match(pushClient, /if \(isInAppBrowser\(\)\) return 'in-app'/);
  assert.equal((pushClient.match(/ inApp: '/g) || []).length, 5);
});
