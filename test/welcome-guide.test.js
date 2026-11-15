import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortalGuideSteps, guideText } from '../public/js/partner/welcome-guide.js';

const item = (id, label, icon = 'box') => ({ id, label, icon });
const base = { label: i => i.label, menuLabel: 'เมนู', lang: 'th' };

test('hotel guide uses the menu labels and the store-and-bookings page', () => {
  const steps = buildPortalGuideSteps({
    ...base, role: 'hotel', drawer: true,
    navItems: [item('home', 'ภาพรวมโรงแรม'), item('appointments', 'การจอง'), item('queue', 'คิวเช็กอิน / เช็กเอาต์'), item('hotel', 'ห้องพักและการดูแล'), item('cashier', 'แคชเชียร์'), item('pos', 'ขายหน้าร้าน · POS')],
    accountItems: [item('users', 'ผู้ใช้งาน'), item('clinic', 'ร้านและการรับจอง'), item('settings', 'ตั้งค่า')],
    bottomTabs: [item('home', 'ภาพรวม')],
  });
  assert.deepEqual(steps.map(s => s.key), ['nav', 'bookings', 'flow', 'profile']);
  assert.match(steps[1].body, /«การจอง»/);
  assert.match(steps[2].body, /«แคชเชียร์»/);
  assert.deepEqual(steps[2].chips.map(c => c.label), ['คิวเช็กอิน / เช็กเอาต์', 'ห้องพักและการดูแล', 'แคชเชียร์']);
  assert.match(steps[3].body, /«ร้านและการรับจอง»/);
  assert.match(steps[0].body, /«เมนู»/);
  for (const step of steps) assert.ok(step.body.length <= 80, `${step.key} copy stays short`);
});

test('shop guide covers online orders, POS and settings (no bookings page)', () => {
  const steps = buildPortalGuideSteps({
    ...base, role: 'shop', drawer: false,
    navItems: [item('home', 'ภาพรวมร้านค้า'), item('pos', 'ขายหน้าร้าน · POS'), item('orders', 'คำสั่งซื้อออนไลน์'), item('inventory', 'คลังสินค้า')],
    accountItems: [item('users', 'ผู้ใช้งาน'), item('settings', 'ตั้งค่า')],
  });
  assert.deepEqual(steps.map(s => s.key), ['nav', 'orders', 'sell', 'profile']);
  assert.match(steps[3].body, /«ตั้งค่า»/);
});

test('staff without account pages still get a profile step, and labels follow the language', () => {
  const steps = buildPortalGuideSteps({ ...base, lang: 'en', role: 'grooming', drawer: false, navItems: [item('home', 'Overview')], accountItems: [] });
  assert.deepEqual(steps.map(s => s.key), ['nav', 'profile']);
  assert.match(steps[1].body, /profile button/);
  assert.equal(steps[1].chips.at(-1).label, 'View user guide');
  for (const lang of ['th', 'en', 'zh', 'ja', 'ko']) assert.notEqual(guideText('skip', {}, lang), 'skip');
});
