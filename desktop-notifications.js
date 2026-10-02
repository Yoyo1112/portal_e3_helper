// Browser notification transport. Platform adapters can extend this interface.
(function () {
  globalThis.E3DesktopNotifications = {
    supported: Boolean(chrome.notifications?.create),
    native: false,
    async getPermissionLevel() {
      return chrome.notifications ? chrome.notifications.getPermissionLevel() : 'denied';
    },
    async authorize() {
      return this.getPermissionLevel();
    },
    async create(id, options, url) {
      if (!this.supported) throw new Error('Desktop notification service unavailable');
      return chrome.notifications.create(id, options);
    }
  };
})();
