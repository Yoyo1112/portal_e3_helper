const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
function fixture(enabled = false, granted = false) {
  const data = { showOnAllSites: enabled }, registrations = [], injections = [];
  const events = {};
  const event = name => ({ addListener(fn) { (events[name] ||= []).push(fn); } });
  const chrome = {
    runtime: { id: 'test', getManifest: () => ({ optional_permissions: ['scripting'], content_scripts: [{ js: ['jszip.min.js', 'i18n.js', 'exam-detection.js', 'all-sites-setting.js', 'content.js'] }] }),
      onInstalled: event('installed'), onStartup: event('startup'), onMessage: event('message') },
    storage: { local: { get: async () => data, set: async value => Object.assign(data, value) }, onChanged: event('storage') },
    permissions: { contains: async () => granted, onRemoved: event('removed') },
    scripting: {
      getRegisteredContentScripts: async () => registrations,
      registerContentScripts: async scripts => registrations.push(...scripts),
      unregisterContentScripts: async () => { registrations.length = 0; },
      executeScript: async details => { injections.push(details); if (details.target.tabId === 3) throw Error('Restricted page'); }
    },
    tabs: { query: async () => [{ id: 1, url: 'https://www.google.com/' }, { id: 2, url: 'https://e3p.nycu.edu.tw/' }, { id: 3, url: 'https://chromewebstore.google.com/' }] }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'all-sites.js'), 'utf8'), { chrome, console });
  const apply = () => new Promise(resolve => events.message[0]({ action: 'applyAllSitesSetting' }, { id: 'test' }, resolve));
  return { data, registrations, injections, apply, grant(value) { granted = value; } };
}
test('default does not register scripts or touch ordinary tabs', async () => {
  const app = fixture(); assert.equal((await app.apply()).success, true);
  assert.equal(app.registrations.length, 0); assert.equal(app.injections.length, 0);
});
test('all-sites requires opt-in AND granted permissions; revocation restores default', async () => {
  const denied = fixture(true, false); await denied.apply();
  assert.equal(denied.registrations.length, 0); assert.equal(denied.data.showOnAllSites, false);
  const app = fixture(true, true); await app.apply();
  assert.equal(app.registrations.length, 1);
  assert.ok(app.registrations[0].js.includes('exam-detection.js'));
  assert.equal(app.registrations[0].allFrames, undefined);
  assert.equal(app.injections.length, 2); // E3 is excluded; restricted-page errors are tolerated.
  await app.apply(); assert.equal(app.injections.length, 2); // Idempotent.
  app.grant(false); await app.apply();
  assert.equal(app.registrations.length, 0); assert.equal(app.data.showOnAllSites, false);
});
test('switching off unregisters future injection without changing default hosts', async () => {
  const app = fixture(true, true); await app.apply();
  app.data.showOnAllSites = false; await app.apply(); assert.equal(app.registrations.length, 0);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  assert.ok(!manifest.host_permissions.includes('https://*/*'));
  assert.ok(manifest.optional_host_permissions.includes('https://*/*'));
  assert.ok(!manifest.permissions.includes('scripting'));
});
