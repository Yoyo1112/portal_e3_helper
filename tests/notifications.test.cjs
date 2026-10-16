const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../notification-engine.js'), 'utf8');
function load(seed = {}, now = new Date(2026, 9, 1, 10).getTime(), desktopSupported = true) {
  const data = structuredClone(seed), desktop = [], requests = [];
  let listener, failDesktop = false;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const context = vm.createContext({ Date: Clock, URL, AbortSignal, console, E3HelperI18n: { ready: Promise.resolve(), text: s => s, template: (parts, ...values) => parts.reduce((out, part, i) => out + part + (i < values.length ? values[i] : ''), ''), language: 'en' },
    fetch: async (...args) => { requests.push(args); throw new Error('Unexpected network request'); },
    chrome: { runtime: { getURL: p => p },
      storage: { local: { get: async () => structuredClone(data), set: async value => Object.assign(data, structuredClone(value)) }, onChanged: { addListener: fn => { listener = fn; } } },
      notifications: desktopSupported ? { create: async (...args) => { if (failDesktop) throw new Error('blocked'); desktop.push(args); }, onClicked: { addListener() {} } } : undefined } });
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../desktop-notifications.js'), 'utf8'), context);
  vm.runInContext(source, context);
  return { engine: context.E3Notifications, data, desktop, requests, advance: ms => { now += ms; }, failDesktop: value => { failDesktop = value; }, listener };
}
const options = { type: 'basic', title: 'Test', message: 'Content' };
test('upgrading releases saved daily deadline reminders without accelerating retries', async () => {
  const now = new Date(2026, 9, 1, 10).getTime();
  for (const attempts of [0, 1]) {
    const deadline = now + 3600000;
    const app = load({
      assignments: [{ eventId: 'saved', name: 'Saved task', deadline }],
      notificationSettings: { mode: 'daily', time: '20:00', reminders: [1] },
      notificationQueue: [{ id: `deadline-saved-${deadline}-1`, options, deadline: { eventId: 'saved', timestamp: deadline, hours: 1 }, due: now + 120000, created: now - 60000, delivered: {}, attempts }]
    }, now);
    await app.engine.tick();
    assert.equal(app.desktop.length, attempts === 0 ? 1 : 0);
    if (attempts) {
      assert.equal(app.data.notificationQueue[0].due, now + 120000);
      app.advance(120000);
      await app.engine.tick();
      assert.equal(app.desktop.length, 1);
    }
  }
});
test('immediate desktop delivery is deduplicated across worker restarts', async () => {
  const app = load();
  await app.engine.enqueue('one', options, 'https://e3p.nycu.edu.tw/test');
  await app.engine.enqueue('one', options);
  assert.equal(app.desktop.length, 1);
  const restarted = load(app.data);
  await restarted.engine.enqueue('one', options);
  assert.equal(restarted.desktop.length, 0);
});
test('daily delivery waits until the configured local time', async () => {
  const app = load({ notificationSettings: { mode: 'daily', time: '20:00', reminders: [] } });
  await app.engine.enqueue('daily', options);
  assert.equal(app.desktop.length, 0);
  app.advance(10 * 3600000);
  await app.engine.tick();
  assert.equal(app.desktop.length, 1);
  assert.equal(app.data.notificationQueue.length, 0);
});
test('submitted, removed, changed and expired deadlines are skipped', async () => {
  const now = new Date(2026, 9, 1, 10).getTime();
  for (const kind of ['submitted', 'removed', 'changed', 'expired']) {
    const app = load({ assignments: [{ eventId: 'a', name: 'Task', deadline: now + 3600000 }], notificationSettings: { mode: 'daily', time: '10:30', reminders: [1] } }, now);
    // Deadline reminders are sent at once, so keep one queued by failing the first delivery.
    app.failDesktop(true);
    await app.engine.tick();
    assert.equal(app.data.notificationQueue.length, 1);
    app.failDesktop(false);
    if (kind === 'submitted') app.data.assignmentStatuses = { a: 'submitted' };
    if (kind === 'removed') app.data.assignments = [];
    if (kind === 'changed') app.data.assignments[0].deadline += 86400000;
    app.advance(kind === 'expired' ? 7200000 : 1800000);
    await app.engine.tick();
    assert.equal(app.desktop.length, 0, kind);
  }
});
test('desktop failure retries and disabled desktop sends nothing', async () => {
  const app = load({ notificationSettings: { reminders: [] } });
  app.failDesktop(true);
  await app.engine.enqueue('retry', options);
  assert.ok(app.data.notificationDeliveryError);
  app.advance(120000); app.failDesktop(false);
  await app.engine.tick();
  assert.equal(app.desktop.length, 1);
  assert.equal(app.data.notificationQueue.length, 0);
  const disabled = load({ notificationSettings: { desktop: false } });
  await disabled.engine.enqueue('off', options);
  assert.equal(disabled.desktop.length, 0);
});
test('retired channel credentials are removed and never used for network requests', async () => {
  const app = load({ notificationSettings: { desktop: true, email: true, emailTo: 'student@example.com', webhook: 'https://relay.example/send', token: 'secret', reminders: [] } });
  await app.engine.enqueue('clean', options);
  assert.equal(app.requests.length, 0);
  assert.deepEqual(Object.keys(app.data.notificationSettings).sort(), ['desktop', 'events', 'mode', 'reminders', 'time']);
});
test('announcement baseline is silent, later additions notify even after an empty snapshot', async () => {
  const app = load({ notificationSettings: { reminders: [] } });
  app.listener({ announcements: { newValue: [{ id: 'historic', title: 'Old' }] } }, 'local');
  await app.engine.tick();
  assert.equal(app.desktop.length, 0);
  app.listener({ announcements: { oldValue: [], newValue: [{ id: 'new', title: 'New' }] } }, 'local');
  await app.engine.tick();
  assert.equal(app.desktop.length, 1);
});
test('turning off deadline reminders cancels previously queued reminders', async () => {
  const now = new Date(2026, 9, 1, 10).getTime();
  const app = load({ assignments: [{ eventId: 'a', name: 'Task', deadline: now + 3600000 }], notificationSettings: { mode: 'daily', time: '10:30', reminders: [1] } }, now);
  app.failDesktop(true);
  await app.engine.tick();
  app.failDesktop(false);
  app.data.notificationSettings.reminders = [];
  app.advance(1800000);
  await app.engine.tick();
  assert.equal(app.desktop.length, 0);
  assert.equal(app.data.notificationQueue.length, 0);
});

test('Safari without notifications API never retries unsupported desktop delivery', async () => {
  const app = load({ notificationSettings: { desktop: true, reminders: [] } }, Date.now(), false);
  await app.engine.enqueue('unsupported', options);
  assert.equal(app.desktop.length, 0);
  assert.equal((app.data.notificationQueue || []).length, 0);
});

test('daily mode sends deadline reminders at once but holds other events', async () => {
  const now = new Date(2026, 9, 1, 10).getTime();
  const app = load({ assignments: [{ eventId: 'a', name: 'Task', deadline: now + 1800000 }], notificationSettings: { mode: 'daily', time: '20:00', reminders: [1] } }, now);
  await app.engine.tick();
  assert.equal(app.desktop.length, 1);
  assert.match(app.desktop[0][0], /^e3-alert-deadline-a-/);
  await app.engine.enqueue('announcements-1', options);
  assert.equal(app.desktop.length, 1);
  assert.equal(app.data.notificationQueue[0].due, new Date(2026, 9, 1, 20).getTime());
});
test('daily delivery combines held events into one summary and records every item', async () => {
  const app = load({ notificationSettings: { mode: 'daily', time: '20:00', reminders: [] } });
  for (const id of ['assignment-1', 'announcements-2', 'announcements-3', 'participant-4-46-45-1', 'messages-5'])
    await app.engine.enqueue(id, { type: 'basic', title: 'T', message: `${id} first line\nsecond` }, 'https://e3p.nycu.edu.tw/x');
  assert.equal(app.desktop.length, 0);
  app.advance(10 * 3600000);
  await app.engine.tick();
  assert.equal(app.desktop.length, 1);
  const [id, summary] = app.desktop[0];
  assert.match(id, /^e3-alert-digest-/);
  assert.match(summary.title, /5/);
  assert.match(summary.message, /公告 2/);
  assert.match(summary.message, /assignment-1 first line/);
  assert.doesNotMatch(summary.message, /second/);
  assert.match(summary.message, /…\+2/);
  assert.equal(app.data.notificationQueue.length, 0);
  for (const item of ['assignment-1', 'announcements-2', 'messages-5']) assert.ok(app.data.notificationHistory.includes(item));
  assert.equal(app.data.notificationLog.length, 1);
  assert.equal(app.data.notificationLog[0].category, 'digest');
});
test('a single held event is delivered unchanged in daily mode', async () => {
  const app = load({ notificationSettings: { mode: 'daily', time: '20:00', reminders: [] } });
  await app.engine.enqueue('grading-1', options);
  app.advance(10 * 3600000);
  await app.engine.tick();
  assert.equal(app.desktop[0][0], 'e3-alert-grading-1');
  assert.equal(app.desktop[0][1].title, 'Test');
});
test('a newly added reminder does not fire for deadlines already inside it', async () => {
  const now = new Date(2026, 9, 1, 10).getTime();
  const assignments = [{ eventId: 'soon', name: 'Soon', deadline: now + 48 * 3600000 }, { eventId: 'later', name: 'Later', deadline: now + 100 * 3600000 }];
  const app = load({ assignments, notificationSettings: { reminders: [24] } }, now);
  await app.engine.tick();
  assert.equal(app.desktop.length, 0);
  const previous = structuredClone(app.data.notificationSettings);
  app.data.notificationSettings = { ...previous, reminders: [72, 24] };
  app.listener({ notificationSettings: { oldValue: previous, newValue: app.data.notificationSettings } }, 'local');
  await app.engine.tick();
  assert.equal(app.desktop.length, 0, 'already within 72 hours when the reminder was added');
  app.advance(30 * 3600000);
  await app.engine.tick();
  assert.deepEqual(app.desktop.map(([id]) => id), [`e3-alert-deadline-soon-${now + 48 * 3600000}-24`, `e3-alert-deadline-later-${now + 100 * 3600000}-72`]);
});
test('a reminder threshold missed while asleep is still delivered', async () => {
  const now = new Date(2026, 9, 1, 10).getTime();
  const app = load({ assignments: [{ eventId: 'a', name: 'Task', deadline: now + 30 * 3600000 }], notificationSettings: { reminders: [24] } }, now);
  await app.engine.tick();
  app.advance(29 * 3600000);
  await app.engine.tick();
  assert.equal(app.desktop.length, 1);
});
test('event switches suppress their notifications and legacy updates:false migrates', async () => {
  const app = load({ notificationSettings: { reminders: [], events: { assignment: false, grading: true, announcement: true, message: true, participant: false } } });
  for (const id of ['assignment-1', 'participant-2-1-2-0', 'grading-3']) await app.engine.enqueue(id, options);
  assert.deepEqual(app.desktop.map(([id]) => id), ['e3-alert-grading-3']);
  const legacy = load({ notificationSettings: { reminders: [], updates: false } });
  assert.deepEqual({ ...legacy.engine.normalize({ updates: false }).events }, { assignment: true, grading: true, announcement: false, message: false, participant: true });
  legacy.listener({ messages: { oldValue: [], newValue: [{ id: 'm', title: 'Mail' }] } }, 'local');
  await legacy.engine.enqueue('announcements-9', options);
  assert.equal(legacy.desktop.length, 0);
  await legacy.engine.enqueue('assignment-9', options);
  assert.equal(legacy.desktop.length, 1);
});
test('the same participant change is delivered once', async () => {
  const app = load({ notificationSettings: { reminders: [] } });
  await Promise.all([1, 2, 3, 4, 5].map(() => app.engine.enqueue('participant-77-46-45-1700', options)));
  assert.equal(app.desktop.length, 1);
});
test('notification log keeps the latest 50 deliveries with their links', async () => {
  const app = load({ notificationSettings: { reminders: [] } });
  for (let i = 0; i < 55; i++) await app.engine.enqueue(`assignment-${i}`, { type: 'basic', title: `T${i}`, message: 'M' }, 'https://e3p.nycu.edu.tw/a');
  assert.equal(app.data.notificationLog.length, 50);
  assert.equal(app.data.notificationLog.at(-1).title, 'T54');
  assert.equal(app.data.notificationLog.at(-1).category, 'assignment');
  assert.equal(app.data.notificationLog.at(-1).url, 'https://e3p.nycu.edu.tw/a');
});
