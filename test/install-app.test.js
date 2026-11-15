import test from 'node:test';
import assert from 'node:assert/strict';
import { installMode } from '../public/js/partner/install-app.js';

const base = { ios: false, standalone: false, canPrompt: false, inApp: false };
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
};

test('install instructions match the device', () => {
  assert.equal(installMode({ ...base, userAgent: UA.android, canPrompt: true }), 'prompt');
  assert.equal(installMode({ ...base, userAgent: UA.android }), 'android');
  assert.equal(installMode({ ...base, userAgent: UA.iphone, ios: true }), 'ios');
  assert.equal(installMode({ ...base, userAgent: UA.macSafari }), 'mac');
  assert.equal(installMode({ ...base, userAgent: UA.macChrome }), 'desktop');
  assert.equal(installMode({ ...base, userAgent: UA.firefox }), 'firefox');
  assert.equal(installMode({ ...base, userAgent: UA.iphone, ios: true, inApp: true }), 'inApp');
  assert.equal(installMode({ ...base, userAgent: UA.android, standalone: true, canPrompt: true }), 'installed');
});
