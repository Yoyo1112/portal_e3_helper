// Optional browser regression: install Playwright or set PLAYWRIGHT_PATH.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    // Some host sites apply global !important button rules.
    const hostileCSS = 'body > button { width: 100vw !important; min-width: 100vw !important; max-width: none !important; padding: 24px !important; display: block !important; position: static !important; margin: 18px !important; }';
    await page.route('https://e3p.nycu.edu.tw/**', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><head><style>' + hostileCSS + '</style></head><body><main>Course page content</main></body></html>'
    }));
    await page.addInitScript(() => {
      const data = {
        interfaceLanguage: 'en',
        themePreference: 'light',
        assignments: [],
        courses: [],
        announcements: [],
        lastSyncTime: Date.now(),
        lastSeenVersion: '2.3.0'
      };
      const listeners = [];
      window.chrome = {
        i18n: { getUILanguage: () => 'en' },
        runtime: {
          id: 'fixture',
          getManifest: () => ({ version: '2.3.0' }),
          getURL: file => file,
          onMessage: { addListener() {} },
          sendMessage: (message, callback) => {
            const response = { success: true };
            callback?.(response);
            return Promise.resolve(response);
          }
        },
        storage: {
          onChanged: { addListener: listener => listeners.push(listener) },
          local: {
            get: async (keys, callback) => {
              callback?.(data);
              return data;
            },
            set: async update => {
              Object.assign(data, update);
              listeners.forEach(listener => listener(
                Object.fromEntries(Object.entries(update).map(([key, value]) => [key, { newValue: value }])),
                'local'
              ));
            }
          }
        }
      };
    });
    await page.goto('https://e3p.nycu.edu.tw/');
    const root = path.join(__dirname, '..');
    await page.addScriptTag({ path: path.join(root, 'i18n.js') });
    await page.addScriptTag({ path: path.join(root, 'exam-detection.js') });
    await page.addScriptTag({ path: path.join(root, 'content.js') });

    const launcher = page.locator('.e3-helper-sidebar-toggle');
    const getLauncher = () => launcher.evaluate(button => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return {
        position: style.position,
        display: style.display,
        width: rect.width,
        right: rect.right,
        background: style.backgroundColor,
        iconColor: getComputedStyle(button.querySelector('.e3-helper-toggle-icon')).color,
        textDisplay: getComputedStyle(button.querySelector('.e3-helper-toggle-text')).display
      };
    });

    const compact = await getLauncher();
    assert.equal(compact.position, 'fixed', 'host styles cannot unfix the launcher');
    assert.equal(compact.display, 'inline-flex', 'host styles cannot override launcher layout');
    assert.ok(compact.width >= 40 && compact.width <= 50, 'launcher stays icon-sized');
    assert.equal(compact.right, 1280, 'launcher remains at the right edge');
    assert.equal(compact.background, 'rgb(41, 39, 35)', 'warm black launcher');
    assert.equal(compact.iconColor, 'rgb(217, 163, 108)', 'amber icon');
    assert.equal(compact.textDisplay, 'none', 'label is initially folded');

    await launcher.hover();
    const hovered = await getLauncher();
    assert.ok(hovered.width >= 130 && hovered.width <= 140, 'hover expands only to label width');
    assert.notEqual(hovered.textDisplay, 'none', 'label appears on hover');

    await launcher.click();
    assert.ok(await page.locator('.e3-helper-sidebar').evaluate(el => el.classList.contains('expanded')));

    await page.emulateMedia({ media: 'print' });
    for (const selector of ['.e3-helper-sidebar', '.e3-helper-sidebar-toggle']) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).display), 'none', selector + ' hidden in print');
    }
    assert.notEqual(await page.locator('main').evaluate(el => getComputedStyle(el).display), 'none', 'host content still prints');
    await page.emulateMedia({ media: 'screen' });

    await page.locator('#e3-helper-close-btn').click();
    assert.equal(await page.locator('.e3-helper-sidebar').evaluate(el => el.classList.contains('expanded')), false);
    await page.mouse.move(0, 0);
    await page.setViewportSize({ width: 375, height: 667 });
    const mobile = await getLauncher();
    assert.ok(mobile.width <= 50 && mobile.right === 375, 'compact launcher remains visible on mobile');
    await launcher.click();
    assert.ok(await page.locator('.e3-helper-sidebar').evaluate(el => el.classList.contains('expanded')), 'compact launcher reopens sidebar');

    assert.deepEqual(errors, []);
    console.log('Passed: compact launcher survives host CSS, expands on hover, reopens sidebar, and disappears on print.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
