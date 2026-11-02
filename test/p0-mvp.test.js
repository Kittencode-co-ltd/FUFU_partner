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
