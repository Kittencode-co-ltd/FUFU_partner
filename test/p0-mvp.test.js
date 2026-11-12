import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('MVP mode is production-safe by default', async () => {
  const config = await read('../public/js/utils/config.js');
  assert.match(config, /PARTNER_MVP_MODE\s*=.*!== false/);
  assert.match(config, /MVP_MODE:\s+PARTNER_MVP_MODE/);
  for (const flag of ['ENABLE_HOTEL_MODULE', 'ENABLE_OPD_CARD', 'ENABLE_IPD_WARD', 'ENABLE_POS', 'ENABLE_DOCUMENTS']) {
    assert.match(config, new RegExp(`${flag}:\\s+!PARTNER_MVP_MODE`));
  }
});

test('MVP navigation contains the production clinic workflow destinations', async () => {
  const dashboard = await read('../public/js/partner/dashboard.js');
  const block = dashboard.match(/const MVP_NAV = \[([\s\S]*?)\n\];/)?.[1] || '';
  const ids = [...block.matchAll(/id: '([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(ids, ['screenings', 'home', 'appointments', 'calendar', 'patients', 'summaries', 'clinic', 'users']);
  assert.match(dashboard, /MVP_NAV_PAGES\.has\(pageId\)/);
  assert.match(dashboard, /MVP_ROLE_PAGES/);
});

test('MVP navigation and dashboard are selected by the active store category', async () => {
  const dashboard = await read('../public/js/partner/dashboard.js');
  const home = await read('../public/js/partner/home.js');
  for (const role of ['vet', 'shop', 'hotel', 'grooming']) {
    assert.match(dashboard, new RegExp(`${role}: \\[`));
  }
  for (const page of ['inventory', 'pos', 'orders', 'delivery', 'hotel', 'grooming', 'opd', 'ipd']) {
    assert.match(dashboard, new RegExp(`id: '${page}'`));
  }
  assert.match(home, /const role = storage\.get\(STORAGE_KEYS\.ROLE\)/);
  assert.match(home, /_renderBusinessHome\(container, storeId, role\)/);
});

test('store onboarding tolerates schemas without the optional branch_name column', async () => {
  const stores = await read('../server/routes/stores.js');
  const app = await read('../public/js/app.js');
  assert.match(stores, /function isMissingBranchName/);
  assert.match(stores, /if \(isMissingBranchName\(error\) && Object\.hasOwn\(store, 'branch_name'\)\)/);
  assert.match(stores, /BASE_STORE_FIELDS = 'id, name, category'/);
  assert.match(app, /tr\('catShop'/);
  assert.doesNotMatch(app, /ยังไม่มีร้านค้า — สร้างร้านแรกของคุณได้เลย/);
});

test('online order screens explain the current FUFU App store-link limitation', async () => {
  const dashboard = await read('../public/js/partner/dashboard.js');
  const operations = await read('../public/js/partner/shop-operations.js');
  assert.match(dashboard, /renderShopOperations/);
  assert.match(operations, /รหัสร้านกำกับ/);
  assert.match(operations, /ไปที่คลังสินค้า/);
  assert.match(operations, /ขายหน้าร้าน · POS/);
});

test('MVP overview uses appointment data and excludes finance execution', async () => {
  const home = await read('../public/js/partner/home.js');
  const mvpBlock = home.slice(home.indexOf('async function _renderMvpHome'), home.indexOf('function _mvpMetric'));
  assert.match(mvpBlock, /\/api\/appointments\?store_id=.*bucket=requested/);
  assert.match(mvpBlock, /\/api\/screenings\?store_id=.*bucket=new/);
  assert.doesNotMatch(mvpBlock, /\/api\/finance|commission|รายได้/);
  assert.match(mvpBlock, /โหลดข้อมูลนัดหมายไม่สำเร็จ/);
});

test('MVP summary page does not lazy-load the legacy medical module', async () => {
  const dashboard = await read('../public/js/partner/dashboard.js');
  const summaryBranch = dashboard.slice(
    dashboard.indexOf("if (pageId === 'summaries')"),
    dashboard.indexOf("if (pageId === 'clinic')"),
  );
  assert.match(summaryBranch, /visit-summaries\.js/);
  assert.doesNotMatch(summaryBranch, /medical\.js|doctor-workroom|opd/);
});
