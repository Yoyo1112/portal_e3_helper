// Real extension injection test. Required permissions in this temporary fixture
// simulate the user granting optional access; the UI smoke covers denial/grant.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.join(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'e3-all-sites-'));
  const extension = path.join(temp, 'extension'); fs.mkdirSync(extension);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  manifest.permissions.push('scripting'); manifest.host_permissions.push('http://*/*', 'https://*/*');
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  for (const name of [...fs.readdirSync(root).filter(name => /\.(js|html|css|png)$/.test(name)), '_locales', 'CHANGELOG.md']) {
    fs.cpSync(path.join(root, name), path.join(extension, name), { recursive: true });
  }
  let context;
  try {
    context = await chromium.launchPersistentContext(path.join(temp, 'profile'), {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    await context.route('https://**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body>Offline fixture</body></html>' }));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(async () => {
      const due = new Date(); due.setHours(23, 59, 0, 0);
      await chrome.storage.local.set({ lastSeenVersion: chrome.runtime.getManifest().version, lastSyncTime: Date.now(), assignments: [{ eventId: 12, name: 'Due today fixture', deadline: +due, course: 'Fixture course', url: 'https://e3p.nycu.edu.tw/mod/assign/view.php?id=12' }], courses: [], announcements: [] });
    });
    const google = await context.newPage(); await google.goto('https://www.google.com/');
    assert.equal(await google.locator('.e3-helper-sidebar-toggle').count(), 0);
    const options = await context.newPage();
    await options.goto(new URL('notification-settings.html', worker.url()).href);
    const setting = options.locator('#all-sites-setting input');
    await setting.waitFor(); assert.equal(await setting.isChecked(), false);
    await setting.check();
    await google.locator('.e3-helper-sidebar-toggle').click();
    await google.locator('.e3-helper-assignment-name').filter({ hasText: 'Due today fixture' }).waitFor();
    assert.equal(await google.locator('.e3-helper-sidebar').count(), 1);
    // Future navigations use Chrome's registered isolated-world content scripts.
    await google.reload(); await google.locator('.e3-helper-sidebar-toggle').waitFor();
    await setting.uncheck();
    await google.locator('.e3-helper-sidebar-toggle').waitFor({ state: 'hidden' });
    await worker.evaluate(async () => {
      for (let tries = 0; tries < 100; tries++) {
        if (!(await chrome.scripting.getRegisteredContentScripts({ ids: ['e3-helper-all-sites'] })).length) return;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw Error('Script registration was not removed');
    });
    await google.reload(); await google.waitForTimeout(200);
    assert.equal(await google.locator('.e3-helper-sidebar-toggle').count(), 0);
    const campus = await context.newPage(); await campus.goto('https://portal.nycu.edu.tw/');
    await campus.locator('.e3-helper-sidebar-toggle').waitFor();
    await campus.locator('.e3-helper-sidebar-toggle').click();
    await campus.locator('#e3-helper-more-btn').click();
    await campus.locator('#e3-helper-settings-btn').click();
    const openOptions = campus.locator('#e3-helper-all-sites-setting button');
    await openOptions.waitFor();
    assert.equal(await campus.locator('#e3-helper-all-sites-setting input').count(), 0);
    await openOptions.click();
    await campus.waitForTimeout(200);
    assert.equal(await campus.locator('#e3-helper-all-sites-setting [role=status]').textContent(), '');
    console.log('PASS: real extension opt-in on existing Google tab, cached homework, registered navigation, opt-out, campus unchanged');
  } finally { await context?.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
