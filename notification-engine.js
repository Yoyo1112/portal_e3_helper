// Persist desktop notification queues across MV3 worker restarts.
(function () {
  const events = { assignment: true, grading: true, announcement: true, message: true, participant: true };
  const defaults = { desktop: true, mode: 'instant', time: '20:00', reminders: [24, 1], events };
  // Notification IDs carry their event type; deadline reminders are governed by `reminders` instead of `events`.
  const prefixes = [['deadline', 'deadline-'], ['assignment', 'assignment-'], ['grading', 'grading-'],
    ['announcement', 'announcements-'], ['message', 'messages-'], ['participant', 'participant-']];
  const labels = { assignment: '新作業', grading: '作業評分', announcement: '公告', message: '信件', participant: '課程成員變動', deadline: '截止前提醒', other: '其他' };
  function categoryOf(id) { return prefixes.find(([, prefix]) => String(id).startsWith(prefix))?.[0] || 'other'; }
  function normalize(value = {}) {
    // Before per-event switches, `updates` covered both announcements and messages.
    const saved = value.events && typeof value.events === 'object' ? value.events : {};
    const legacy = value.updates !== false;
    return { desktop: E3DesktopNotifications.supported && (value.desktop ?? defaults.desktop), mode: value.mode === 'daily' ? 'daily' : 'instant',
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time || '') ? value.time : defaults.time,
      reminders: (Array.isArray(value.reminders) ? value.reminders : defaults.reminders).filter(h => Number.isFinite(h) && h > 0 && h <= 720),
      events: Object.fromEntries(Object.keys(events).map(key => [key, typeof saved[key] === 'boolean' ? saved[key] : (key === 'announcement' || key === 'message') ? legacy : true])) };
  }
  function allowed(settings, id) { return settings.events[categoryOf(id)] ?? true; }
  // Deadline reminders always go out immediately; holding them for the daily time would let short reminders expire.
  function dueAt(settings, now, deadline = null) {
    if (settings.mode !== 'daily' || deadline) return now;
    const date = new Date(now);
    const [hours, minutes] = settings.time.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    if (date.getTime() <= now) date.setDate(date.getDate() + 1);
    return date.getTime();
  }
  function deadlineId(assignment, hours) { return `deadline-${assignment.eventId}-${assignment.deadline}-${hours}`; }
  function pending(assignment, statuses) { return assignment.manualStatus !== 'submitted' && statuses?.[assignment.eventId] !== 'submitted'; }
  let work = Promise.resolve();
  function serial(fn) {
    const result = work.then(fn);
    work = result.catch(() => {});
    return result;
  }
  async function add(id, options, url, now = Date.now(), deadline = null) {
    const data = await chrome.storage.local.get(['notificationSettings', 'notificationQueue', 'notificationHistory']);
    const settings = normalize(data.notificationSettings);
    if (!settings.desktop || !allowed(settings, id)) return;
    const queue = data.notificationQueue || [];
    if ((data.notificationHistory || []).includes(id) || queue.some(item => item.id === id)) return;
    if (queue.length >= 200) {
      await chrome.storage.local.set({ notificationDeliveryError: '通知佇列已滿，請檢查桌面通知設定。' });
      return;
    }
    queue.push({ id, options, url, deadline, created: now, due: dueAt(settings, now, deadline), delivered: {}, attempts: 0 });
    await chrome.storage.local.set({ notificationQueue: queue });
  }
  // One daily notification summarizing several held events instead of a burst of separate alerts.
  function digest(items) {
    const text = E3HelperI18n.text, counts = {};
    for (const item of items) { const category = categoryOf(item.id); counts[category] = (counts[category] || 0) + 1; }
    const summary = Object.entries(counts).map(([category, count]) => `${text(labels[category])} ${count}`).join(' · ');
    const lines = items.slice(0, 3).map(item => `• ${String(item.options?.message || item.options?.title || '').split('\n')[0]}`);
    if (items.length > 3) lines.push(`…+${items.length - 3}`);
    return { type: 'basic', iconUrl: chrome.runtime.getURL('128.png'), title: E3HelperI18n.template`E3 Helper：${items.length} 則新通知`,
      message: `${summary}\n${lines.join('\n')}`.slice(0, 300) };
  }
  async function process(now = Date.now()) {
    await E3HelperI18n.ready;
    let data = await chrome.storage.local.get(['assignments', 'assignmentStatuses', 'notificationSettings']);
    const settings = normalize(data.notificationSettings);
    // Strip retired channel credentials while retaining timing and reminder preferences.
    if (data.notificationSettings && Object.keys(data.notificationSettings).some(key => !(key in settings))) {
      await chrome.storage.local.set({ notificationSettings: settings });
    }
    for (const assignment of data.assignments || []) {
      if (!pending(assignment, data.assignmentStatuses)) continue;
      const left = Number(assignment.deadline) - now;
      if (!Number.isFinite(left) || left <= 0) continue;
      for (const hours of settings.reminders) {
        if (left > hours * 3600000) continue;
        await add(deadlineId(assignment, hours), {
          type: 'basic', iconUrl: chrome.runtime.getURL('128.png'),
          title: E3HelperI18n.text('作業即將截止'),
          message: `${assignment.name}\n${assignment.course || ''}\n${new Date(assignment.deadline).toLocaleString(E3HelperI18n.language)}`
        }, assignment.url, now, { eventId: assignment.eventId, timestamp: Number(assignment.deadline), hours });
      }
    }
    data = await chrome.storage.local.get(['notificationQueue', 'notificationHistory', 'notificationLinks', 'notificationLog']);
    const history = data.notificationHistory || [];
    const links = data.notificationLinks || {};
    const log = data.notificationLog || [];
    const remaining = [], ready = [];
    let deliveryError = '';
    const assignments = await chrome.storage.local.get(['assignments', 'assignmentStatuses']);
    for (const item of data.notificationQueue || []) {
      item.delivered = { desktop: Boolean(item.delivered?.desktop) };
      if (!allowed(settings, item.id)) { history.push(item.id); continue; }
      if (item.deadline && !settings.reminders.includes(item.deadline.hours)) { history.push(item.id); continue; }
      if (item.deadline) {
        const assignment = (assignments.assignments || []).find(a => String(a.eventId) === String(item.deadline.eventId));
        if (!assignment || Number(assignment.deadline) !== item.deadline.timestamp || item.deadline.timestamp <= now || !pending(assignment, assignments.assignmentStatuses)) {
          history.push(item.id); continue;
        }
      }
      if (item.due > now) { remaining.push(item); continue; }
      ready.push(item);
    }
    const grouped = settings.desktop && settings.mode === 'daily' ? ready.filter(item => !item.deadline && !item.delivered.desktop) : [];
    const single = item => ({ id: item.id, options: item.options, url: item.url, items: [item] });
    const units = grouped.length >= 2
      ? [{ id: `digest-${Math.min(...grouped.map(item => item.due))}`, options: digest(grouped), url: 'https://e3p.nycu.edu.tw/', items: grouped },
        ...ready.filter(item => !grouped.includes(item)).map(single)]
      : ready.map(single);
    for (const unit of units) {
      if (settings.desktop && unit.items.some(item => !item.delivered.desktop)) {
        try {
          const id = `e3-alert-${unit.id}`;
          await E3DesktopNotifications.create(id, unit.options, unit.url);
          links[id] = unit.url || 'https://e3p.nycu.edu.tw/';
          unit.items.forEach(item => { item.delivered.desktop = true; });
          log.push({ id: unit.id, category: unit.items.length > 1 ? 'digest' : categoryOf(unit.id), title: unit.options?.title || '', message: unit.options?.message || '', url: unit.url || '', time: now });
        } catch { deliveryError = '桌面通知失敗，請檢查瀏覽器與系統通知設定。'; }
      }
      for (const item of unit.items) {
        if (!settings.desktop || item.delivered.desktop) history.push(item.id);
        else {
          item.attempts++;
          item.due = now + Math.min(3600000, 60000 * 2 ** Math.min(item.attempts, 6));
          remaining.push(item);
        }
      }
    }
    await chrome.storage.local.set({ notificationQueue: remaining, notificationHistory: history.slice(-2000), notificationLog: log.slice(-50),
      notificationLinks: Object.fromEntries(Object.entries(links).slice(-200)), notificationDeliveryError: deliveryError });
  }
  // A newly added reminder only applies to deadlines that cross it later, not to every assignment already inside it.
  async function baselineReminders(previous, next, now = Date.now()) {
    const added = next.reminders.filter(hours => !previous.reminders.includes(hours));
    if (!added.length) return;
    const data = await chrome.storage.local.get(['assignments', 'assignmentStatuses', 'notificationHistory']);
    const history = data.notificationHistory || [];
    for (const assignment of data.assignments || []) {
      const left = Number(assignment.deadline) - now;
      if (!pending(assignment, data.assignmentStatuses) || !Number.isFinite(left) || left <= 0) continue;
      for (const hours of added) if (left <= hours * 3600000 && !history.includes(deadlineId(assignment, hours))) history.push(deadlineId(assignment, hours));
    }
    await chrome.storage.local.set({ notificationHistory: history.slice(-2000) });
  }
  globalThis.E3Notifications = {
    normalize, dueAt, categoryOf,
    enqueue: (id, options, url) => serial(async () => { await add(id, options, url); await process(); }),
    tick: () => serial(process)
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !['notificationSettings', 'assignments', 'assignmentStatuses', 'announcements', 'messages'].some(key => changes[key])) return;
    serial(async () => {
      if (changes.notificationSettings) {
        const { notificationQueue = [] } = await chrome.storage.local.get('notificationQueue');
        const settings = normalize(changes.notificationSettings.newValue);
        notificationQueue.forEach(item => { item.due = dueAt(settings, Date.now(), item.deadline); });
        await chrome.storage.local.set({ notificationQueue });
        await baselineReminders(normalize(changes.notificationSettings.oldValue), settings);
      }
      const { notificationSettings } = await chrome.storage.local.get('notificationSettings');
      const settings = normalize(notificationSettings);
      for (const [key, category] of [['announcements', 'announcement'], ['messages', 'message']]) {
        const change = changes[key];
        // The initial snapshot is a baseline, not a flood of old alerts.
        if (!settings.events[category] || !change || !Array.isArray(change.oldValue)) continue;
        const old = new Set(change.oldValue.map(item => String(item.id)));
        for (const item of change.newValue || []) {
          if (item.id == null || old.has(String(item.id))) continue;
          await add(`${key}-${item.id}`, { type: 'basic', iconUrl: chrome.runtime.getURL('128.png'),
            title: E3HelperI18n.text(key === 'messages' ? '新信件' : '新公告'), message: `${item.title || item.subject || ''}\n${item.courseName || item.course || ''}` }, item.url);
        }
      }
      await process();
    }).catch(() => console.warn('E3 Helper: 通知處理失敗'));
  });
  chrome.notifications?.onClicked?.addListener(id => {
    if (!id.startsWith('e3-alert-')) return;
    chrome.storage.local.get('notificationLinks').then(data => {
      const url = data.notificationLinks?.[id];
      if (url && /^https:\/\/e3p?\.nycu\.edu\.tw\//.test(url)) chrome.tabs.create({ url });
      chrome.notifications.clear(id);
    });
  });
})();
