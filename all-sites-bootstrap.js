// Third-party pages receive no coursework, settings, localization or API keys.
// Private UI is created only after a click, in an extension-origin document.
(() => {
  if (!['http:', 'https:'].includes(location.protocol) || globalThis.E3AllSitesLauncher) return;
  let host, frame, disposed = false;
  const clearLegacyUI = () => document.querySelectorAll('.e3-helper-sidebar, .e3-helper-sidebar-toggle, .e3-helper-log-modal, .e3-helper-toast, #e3-helper-add-assignment-modal, #e3-helper-changelog-modal').forEach(node => node.remove());
  const cleanup = () => {
    disposed = true;
    host?.remove();
    clearLegacyUI();
    chrome.storage.onChanged.removeListener(changed);
    window.removeEventListener('message', message);
    delete globalThis.E3AllSitesLauncher;
  };
  const changed = (changes, area) => {
    if (area === 'local' && changes.showOnAllSites?.newValue !== true && changes.showOnAllSites) cleanup();
  };
  const close = () => {
    frame?.remove(); frame = null;
    host.style.setProperty('width', '46px', 'important');
    host.style.setProperty('height', '46px', 'important');
    host.style.setProperty('top', '100px', 'important');
    button.hidden = false;
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  };
  const message = event => {
    if (frame && event.source === frame.contentWindow && event.origin === new URL(chrome.runtime.getURL('128.png')).origin && event.data?.type === 'e3-helper-close') close();
  };
  globalThis.E3AllSitesLauncher = { cleanup };
  chrome.storage.onChanged.addListener(changed);
  window.addEventListener('message', message);
  let button;
  chrome.storage.local.get('showOnAllSites').then(data => {
    if (disposed || data.showOnAllSites !== true) { cleanup(); return; }
    clearLegacyUI();
    host = document.createElement('div');
    host.id = 'e3-helper-all-sites-host';
    for (const [key, value] of Object.entries({ all: 'initial', position: 'fixed', right: '0', left: 'auto', top: '100px', bottom: 'auto', width: '46px', height: '46px', margin: '0', padding: '0', border: '0', display: 'block', 'z-index': '2147483647', 'color-scheme': 'light', transform: 'none' })) host.style.setProperty(key, value, 'important');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      :host { contain: layout style; }
      @media print { :host { display: none !important; } }
      button { box-sizing:border-box; position:absolute; right:0; top:0; width:46px; height:46px; min-width:46px; min-height:46px; margin:0; padding:0; display:flex; align-items:center; justify-content:center; gap:8px; border:1px solid #75685c; border-right:0; border-radius:12px 0 0 12px; background:#292723; color:#f6f1e8; cursor:pointer; font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      button[hidden] { display:none; }
      button:hover, button:focus-visible { width:132px; }
      button span { display:none; }
      button:hover span, button:focus-visible span { display:inline; }
      svg { width:20px; height:20px; flex:none; color:#d9a36c; }
      iframe { width:100%; height:100%; display:block; border:0; background:white; color-scheme:normal; }
    </style><button type="button" title="E3 Helper" aria-label="E3 Helper" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 5h6a2 2 0 0 1 2 2v14a3 3 0 0 0-3-3H4zM20 5h-6a2 2 0 0 0-2 2v14a3 3 0 0 1 3-3h5z"/></svg><span>E3 Helper</span></button>`;
    button = root.querySelector('button');
    button.addEventListener('click', () => {
      if (frame) return;
      host.style.setProperty('width', 'min(400px, 100vw)', 'important');
      host.style.setProperty('height', CSS.supports('height', '100dvh') ? '100dvh' : '100vh', 'important');
      host.style.setProperty('top', '0', 'important');
      button.setAttribute('aria-expanded', 'true');
      button.hidden = true;
      frame = document.createElement('iframe');
      frame.title = 'E3 Helper';
      frame.src = chrome.runtime.getURL('all-sites-panel.html');
      root.append(frame);
    });
    (document.body || document.documentElement).append(host);
  }).catch(cleanup);
})();
