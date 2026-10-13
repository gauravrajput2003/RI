// Browser-only fixtures verify layout and interactions; no real API is contacted.
/* global document, sessionStorage, btoa */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const process = require('node:process');
const console = require('node:console');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const output = path.resolve('artifacts/dashboard-map-popup');
    fs.mkdirSync(output, { recursive: true });
    for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['phone', 390, 844], ['narrow', 320, 844]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        const token = 'test.' + btoa(JSON.stringify({ id: 'qa-only', role: 'SUPER_ADMIN' })) + '.test';
        sessionStorage.setItem('fleet.web.session', JSON.stringify({ accessToken: token, refreshToken: 'test-only' }));
      });
      const vehicle = { id: 'first', vehicle_number: 'QA-ONLY-1', vehicle_type: 'car', fleet_status: 'STOPPED', latitude: 28.868, longitude: 76.5942, speed: 0, today_distance_km: 66.25, status_since_at: '2026-10-13T08:02:39Z', server_received_at: '2026-10-13T11:02:36Z', address: 'A very long resolved address ' + 'Sector Road, Haryana, India. '.repeat(8) };
      let fleetCalls = 0;
      await context.route('**/api/v1/**', route => {
        const url = new URL(route.request().url());
        let data = [];
        let extra = {};
        if (url.pathname.endsWith('/auth/permissions')) data = { id: 'qa-only', role: 'SUPER_ADMIN', permissions: [] };
        if (url.pathname.endsWith('/account-summary')) data = { id: 'qa-only', name: 'QA', email: 'qa@example.invalid', coins: 0 };
        if (url.pathname.endsWith('/issuance-settings')) data = { monthly_target: '0', issued: '0', enforce_hard_cap: false };
        if (url.pathname.endsWith('/dashboard/vehicles')) {
          fleetCalls++;
          data = [vehicle, { ...vehicle, id: 'second', vehicle_number: 'QA-ONLY-2', latitude: 28.866, longitude: 76.5982, speed: 45, today_distance_km: null }];
          extra = { counts: { ALL: 2, STOPPED: 1, RUNNING: 1 }, pagination: { page: 1, pageSize: 25, total: 2 } };
        }
        return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, contentType: 'application/json', body: JSON.stringify({ success: true, data, ...extra }) });
      });
      await context.routeWebSocket('**/socket.io/**', socket => socket.close());
      await page.goto((process.env.WEB_PREVIEW_URL || 'http://127.0.0.1:5173') + '/dashboard');
      await page.getByText('QA-ONLY-1', { exact: true }).waitFor();
      if (width < 1024) await page.getByRole('button', { name: 'Map', exact: true }).click();
      const markers = page.locator('.map-panel .leaflet-marker-icon');
      await markers.first().hover();
      assert.equal(await page.locator('.map-popup').count(), 0, 'Hover opened the popup');
      await markers.first().click();
      const popup = page.getByRole('article', { name: 'QA-ONLY-1 map details' });
      await popup.waitFor();
      await page.mouse.move(0, 0);
      assert(await popup.isVisible(), 'Mouse-out closed the popup');
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.map-popup img')).every(img => img.complete && img.naturalWidth > 0));
      // Let Leaflet's pan/zoom and the dashboard resize settle before measuring.
      await page.waitForTimeout(1000);
      await page.waitForFunction(() => {
        const card = document.querySelector('.map-popup').getBoundingClientRect();
        const map = document.querySelector('.map-panel').getBoundingClientRect();
        return card.left >= map.left - 1 && card.right <= map.right + 1 && card.top >= map.top - 1 && card.bottom <= map.bottom + 1;
      });
      const bounds = await popup.evaluate(element => {
        const card = element.getBoundingClientRect();
        const map = document.querySelector('.map-panel').getBoundingClientRect();
        return { card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom }, map: { left: map.left, right: map.right, top: map.top, bottom: map.bottom }, overflow: element.scrollWidth > element.clientWidth };
      });
      // A full-page capture resizes a viewport-height dashboard during capture.
      await page.screenshot({ path: path.join(output, `${name}.png`) });
      assert(!bounds.overflow, 'Long address overflows the card');
      assert(bounds.card.left >= bounds.map.left - 1 && bounds.card.right <= bounds.map.right + 1, 'Popup is outside map width');
      assert(bounds.card.top >= bounds.map.top - 1 && bounds.card.bottom <= bounds.map.bottom + 1, 'Popup is outside map height');
      const controlsOverlap = await popup.evaluate(element => {
        const header = element.querySelector('header').getBoundingClientRect();
        const zoom = document.querySelector('.leaflet-control-zoom').getBoundingClientRect();
        return header.left < zoom.right && header.right > zoom.left && header.top < zoom.bottom && header.bottom > zoom.top;
      });
      assert(!controlsOverlap, 'Zoom control covers the popup header');
      await popup.getByText('Speed', { exact: true }).click();
      assert(await popup.isVisible(), 'Popup content click closed it');
      const callsBeforeSwitch = fleetCalls;
      await markers.nth(1).click();
      const other = page.getByRole('article', { name: 'QA-ONLY-2 map details' });
      await other.waitFor();
      assert.equal(await other.getByText('45 km/h', { exact: true }).count(), 1);
      await markers.nth(1).click();
      assert.equal(await page.locator('.map-popup').count(), 0, 'Selected marker did not toggle closed');
      await markers.first().click();
      await page.getByRole('button', { name: 'Close vehicle details', exact: true }).click();
      assert.equal(await page.locator('.map-popup').count(), 0, 'Close button failed');
      assert.equal(fleetCalls, callsBeforeSwitch, 'Switching fetched vehicle data again');
      await page.getByRole('button', { name: 'Map settings', exact: true }).click();
      await page.getByRole('switch', { name: 'Satellite', exact: true }).check();
      assert.deepEqual(errors, [], 'Browser runtime errors');
      console.log(`PASS ${name}: click/hover/toggle/close, loaded assets, long address, popup bounds, satellite control, no selection API calls`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
