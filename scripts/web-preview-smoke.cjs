// Run against a local Expo server. All API/socket traffic is intercepted with
// test-only fixtures; these credentials are NOT accounts in the real backend.
/* global document, getComputedStyle, localStorage, sessionStorage */
const assert = require('node:assert/strict');
const { URL } = require('node:url');
const process = require('node:process');
const console = require('node:console');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext();
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      let data = {};
      if (path.endsWith('/auth/login')) data = { accessToken: 'browser-test-access', refreshToken: 'browser-test-refresh' };
      else if (path.endsWith('/vehicles')) data = [{ id: '11111111-1111-4111-8111-111111111111', vehicle_number: 'TEST-ONLY', alias: null, vehicle_type: null, active: true, odometer: null }];
      else if (path.endsWith('/latest-location')) data = { latitude: 1, longitude: 2, server_received_at: new Date().toISOString(), state: 'STOPPED' };
      await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });
    await context.routeWebSocket('**/socket.io/**', socket => {
      socket.send('0' + JSON.stringify({ sid: 'browser-test', upgrades: [], pingInterval: 25000, pingTimeout: 20000 }));
      socket.onMessage(message => {
        if (String(message).startsWith('40')) socket.send('40' + JSON.stringify({ sid: 'browser-test' }));
        if (message === '2') socket.send('3');
      });
    });
    await page.goto(process.env.WEB_PREVIEW_URL || 'http://localhost:8091', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.getByLabel('Email', { exact: true }).waitFor({ timeout: 180000 });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--css-interop-darkMode').trim().startsWith('class'));
    await page.getByLabel('Email', { exact: true }).fill('browser-fixture@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('fixture-not-a-real-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('Fleet overview', { exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole('tab', { name: /Map/ }).click();
    await page.getByText('Map available on Android and iOS', { exact: true }).waitFor();
    await page.evaluate(() => document.documentElement.classList.toggle('dark'));
    const persisted = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    assert(!persisted.includes('browser-test-access') && !persisted.includes('browser-test-refresh'), 'JWTs leaked to browser storage');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email', { exact: true }).waitFor({ timeout: 30000 });
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log('PASS: web login, CSS class mode, map fallback, memory-only credentials, reload sign-out; zero uncaught browser errors. API/socket fixtures only.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
