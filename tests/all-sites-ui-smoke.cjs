const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body>Google fixture</body></html>' }));
    await page.addInitScript(() => {
      const listeners = [];
      const now = new Date(); now.setHours(23, 59, 0, 0);
      const data = { showOnAllSites: true, lastSeenVersion: '3.0.1', lastSyncTime: Date.now(),
        assignments: [{ eventId: 42, name: 'Homework due today', course: 'Test course', deadline: +now, url: 'https://e3p.nycu.edu.tw/mod/assign/view.php?id=42' }], courses: [], announcements: [] };
      window.chrome = {
        runtime: { id: 'fixture', getManifest: () => ({ version: '3.0.1', optional_permissions: ['scripting'] }),
          onMessage: { addListener() {} }, getURL: p => p,
          sendMessage: async () => ({ success: true }) },
        permissions: { request: async () => window.grantAccess !== false },
        storage: { onChanged: { addListener: fn => listeners.push(fn) }, local: {
          get: async (keys, cb) => { cb?.(data); return data; },
          set: async update => { const changes = Object.fromEntries(Object.entries(update).map(([k, v]) => [k, { oldValue: data[k], newValue: v }])); Object.assign(data, update); listeners.forEach(fn => fn(changes, 'local')); }
        } }
      };
    });
    await page.goto('https://www.google.com/');
    for (const file of ['all-sites-bootstrap.js', 'i18n.js', 'exam-detection.js', 'all-sites-setting.js', 'content.js']) await page.addScriptTag({ path: path.join(__dirname, '..', file) });
    const toggle = page.locator('.e3-helper-sidebar-toggle');
    await toggle.waitFor(); await toggle.click();
    await page.locator('.e3-helper-sidebar.expanded').waitFor();
    await page.locator('.e3-helper-assignment-name').filter({ hasText: 'Homework due today' }).waitFor();
    // Repeated injection does not duplicate the UI.
    await page.addScriptTag({ path: path.join(__dirname, '../content.js') });
    assert.equal(await toggle.count(), 1);
    await page.evaluate(() => chrome.storage.local.set({ showOnAllSites: false }));
    await toggle.waitFor({ state: 'hidden' });
    await page.evaluate(() => chrome.storage.local.set({ showOnAllSites: true }));
    await toggle.waitFor({ state: 'visible' });
    // Exercise permission-denied and accepted settings interactions.
    await page.evaluate(async () => {
      const container = document.createElement('div'); container.id = 'fixture-settings'; document.body.append(container);
      await E3AllSitesSetting.mount(container);
    });
    const input = page.locator('#fixture-settings input');
    await input.uncheck(); await toggle.waitFor({ state: 'hidden' });
    await page.evaluate(() => { window.grantAccess = false; });
    await input.click();
    await page.waitForFunction(() => !document.querySelector('#fixture-settings input').checked);
    assert.match(await page.locator('#fixture-settings [role=status]').textContent(), /未取得網站存取權|Website access was not granted/);
    await page.evaluate(() => { window.grantAccess = true; });
    await input.check(); await toggle.waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    console.log('PASS: Google cached due-today homework, duplicate injection, disable/re-enable, denied/granted settings');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
