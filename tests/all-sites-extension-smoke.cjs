// Real optional-permission lifecycle. A disposable profile is seeded with prior consent; no real user profile or browser prompt is modified.
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
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  for (const name of [...fs.readdirSync(root).filter(name => /\.(js|html|css|png)$/.test(name)), '_locales', 'CHANGELOG.md']) fs.cpSync(path.join(root, name), path.join(extension, name), { recursive: true });
  let context;
  try {
    const launch = () => chromium.launchPersistentContext(path.join(temp, 'profile'), { channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    // Seed consent in an isolated profile, then restore optional hosts before testing removal.
    const seedManifest = structuredClone(manifest);
    seedManifest.permissions.push('scripting'); seedManifest.host_permissions.push('http://*/*', 'https://*/*');
    fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(seedManifest));
    context = await launch();
    const seedWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await seedWorker.evaluate(() => chrome.storage.local.set({ showOnAllSites: true }));
    await context.close();
    fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
    context = await launch();
    context.setDefaultTimeout(10000);
    await context.route('https://**/*', route => route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': "frame-src 'none';" }, body: '<!doctype html><html><head><style>body > button, button { width:100vw !important; min-width:100vw !important; min-height:100px !important; padding:24px !important; font-size:32px !important; } body > div { min-width:100vw !important; min-height:100vh !important; padding:50px !important; }</style></head><body>Hostile fixture</body></html>' }));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(async () => {
      const due = new Date(); due.setHours(23, 59, 0, 0);
      await chrome.storage.local.set({ lastSeenVersion: chrome.runtime.getManifest().version, lastSyncTime: Date.now(),
        aiSettings: { enabled: false, geminiApiKey: 'fixture-gemini-secret', openaiSummaryApiKey: 'fixture-openai-secret' },
        assignments: [{ eventId: '12', name: 'Private coursework fixture', deadline: +due, course: 'Private course', url: 'https://e3p.nycu.edu.tw/mod/assign/view.php?id=12' }], courses: [], announcements: [] });
    });
    const google = await context.newPage(); await google.goto('https://www.google.com/');
    const host = google.locator('#e3-helper-all-sites-host');

    const options = await context.newPage(); await options.goto(new URL('notification-settings.html', worker.url()).href);
    const setting = options.locator('#all-sites-setting input');
    await setting.waitFor(); assert.equal(await setting.isChecked(), true);
    await host.waitFor();
    assert.equal(await worker.evaluate(() => chrome.permissions.contains({ origins: ['http://*/*', 'https://*/*'] })), true);
    const box = await host.boundingBox(); assert.equal(box.width, 46); assert.equal(box.height, 46);
    await google.emulateMedia({ media: 'print' }); assert.equal(await host.isVisible(), false);
    await google.emulateMedia({ media: 'screen' }); assert.equal(await host.isVisible(), true);
    const privateDOM = () => google.evaluate(() => ({ keys: [...document.querySelectorAll('input')].map(el => el.value), text: document.body.textContent, shadow: document.querySelector('#e3-helper-all-sites-host')?.shadowRoot }));
    assert.equal((await privateDOM()).shadow, null);
    assert.ok(!(await privateDOM()).text.includes('Private coursework fixture'));
    assert.equal(google.frames().length, 1, 'No private frame before a click');
    await host.click({ position: { x: 23, y: 23 } });
    await google.waitForFunction(() => document.querySelector('#e3-helper-all-sites-host')?.getBoundingClientRect().width > 46);
    for (let i = 0; i < 100 && !google.frames().some(frame => frame.url().includes('all-sites-panel.html')); i++) await google.waitForTimeout(25);
    let panel = google.frames().find(frame => frame.url().includes('all-sites-panel.html'));
    assert.ok(panel, 'Extension-origin panel opened');
    await panel.locator('.e3-helper-assignment-name').filter({ hasText: 'Private coursework fixture' }).waitFor();
    await panel.locator('#e3-helper-more-btn').click(); await panel.locator('#e3-helper-settings-btn').click();
    await panel.waitForFunction(() => document.getElementById('e3-helper-gemini-key')?.value === 'fixture-gemini-secret');
    const external = await privateDOM();
    assert.ok(!JSON.stringify(external).includes('fixture-gemini-secret'));
    assert.ok(!JSON.stringify(external).includes('Private coursework fixture'));
    const hostRead = await google.evaluate(() => {
      try { return window.frames[0].document.body.textContent; } catch (error) { return error.name; }
    });
    assert.ok(['SecurityError', 'TypeError'].includes(hostRead), 'Host JS cannot obtain the private frame document');
    assert.equal(await panel.evaluate(() => {
      try { return parent.document.title; } catch (error) { return error.name; }
    }), 'SecurityError', 'The iframe has a separate origin from its host');
    await panel.locator('#e3-helper-close-settings').click();
    await panel.locator('#e3-helper-close-btn').click();
    await google.waitForFunction(() => document.querySelector('#e3-helper-all-sites-host')?.getBoundingClientRect().width === 46);
    assert.ok(panel.isDetached(), 'Closing destroys the private document');
    await host.click({ position: { x: 23, y: 23 } });
    for (let i = 0; i < 100 && !google.frames().some(frame => frame.url().includes('all-sites-panel.html')); i++) await google.waitForTimeout(25);
    panel = google.frames().find(frame => frame.url().includes('all-sites-panel.html'));
    await panel.locator('.e3-helper-assignment-name').filter({ hasText: 'Private coursework fixture' }).waitFor();
    // Keep the panel open while turning the option off.
    await setting.uncheck(); await host.waitFor({ state: 'detached' });
    await options.waitForFunction(() => !document.querySelector('#all-sites-setting input').disabled);
    assert.ok(panel.isDetached(), 'Opt-out destroys the private document');
    assert.equal(await worker.evaluate(() => chrome.permissions.contains({ origins: ['http://*/*', 'https://*/*'] })), false);
    assert.ok((await worker.evaluate(() => chrome.permissions.getAll())).origins.includes('https://e3p.nycu.edu.tw/*'));
    assert.equal((await privateDOM()).text.includes('Private coursework fixture'), false);
    await google.reload(); await google.waitForTimeout(150); assert.equal(await host.count(), 0);
    // Campus UI remains enabled; avoid hostile button styling in this campus fixture.
    const campus = await context.newPage(); await campus.goto('https://portal.nycu.edu.tw/');
    await campus.locator('.e3-helper-sidebar-toggle').waitFor();
    console.log('PASS: real optional grant/revoke, 46px hostile-CSS launcher, no private host DOM, extension-origin settings isolation, opt-out teardown, print, campus unchanged');
  } finally { await context?.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
