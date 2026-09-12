// Tests the actual local demo adapter; no fake API responses are supplied here.
/* global localStorage, sessionStorage */
const assert = require('node:assert/strict');
const process = require('node:process');
const console = require('node:console');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage(); const errors = []; const backendCalls = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('websocket', socket => { if (socket.url().includes('/socket.io')) backendCalls.push(socket.url()); });
    await page.route('**/api/v1/**', route => { backendCalls.push(route.request().url()); return route.abort(); });
    await page.goto(process.env.WEB_PREVIEW_URL || 'http://localhost:8092', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.getByLabel('Email', { exact: true }).waitFor({ timeout: 180000 });
    await page.getByLabel('Email', { exact: true }).fill('@gmail.com');
    await page.getByLabel('Password', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('Fleet overview', { exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole('tab', { name: /Vehicles/ }).click();
    await page.getByText('DEMO-101', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Open Sample delivery van', exact: true }).click();
    await page.getByText('Coordinates', { exact: true }).waitFor();
    await page.getByRole('tab', { name: /Map/ }).click();
    await page.getByText('Map available on Android and iOS', { exact: true }).waitFor();
    const saved = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    assert(!saved.includes('local-demo-access'), 'Demo credentials persisted to browser storage');
    await page.getByRole('tab', { name: /Profile/ }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).waitFor();
    assert.deepEqual(backendCalls, [], 'Demo attempted a backend request/socket connection');
    assert.deepEqual(errors, [], 'Demo browser runtime errors');
    console.log('PASS: requested demo login, dashboard, vehicles, details, map fallback, logout; no API/socket traffic and no browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
