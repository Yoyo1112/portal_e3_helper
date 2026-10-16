# Notification preferences and review fixes

Notification settings offer event switches, reminder times, immediate or daily delivery, and a recent-notification history. The former updates switch migrates to announcements and messages. Daily mode groups held events and sends deadline reminders immediately.

Saved deadline reminders from an older version become immediately eligible if delivery has never been attempted. Existing failed-delivery retries keep their backoff; obsolete, submitted, removed, and expired deadlines remain filtered.

Membership checks own a token for ten minutes. Only the current, unexpired owner may publish counts and release the lock. A delayed tab drops its results and alerts if its lease was replaced. Scheduled checks wait five minutes between starts; a manual check may follow a finished one.

Settings retain the unsaved state and leave-page warning when a user edits the form during a pending save. The earlier save cannot mark those newer edits as saved.

Run `node --test tests/*.test.cjs` and `node tests/notification-ui-smoke.cjs` with Playwright available. Repeat the UI fixture with `UI_LANGUAGE=zh-TW` and `SAFARI_FIXTURE=1` for Chinese and unsupported notifications. The save-race regression pauses a storage write while changing the form.

This fork uses Promise-based browser APIs; the upstream split additionally wraps notification APIs for callback-only Chrome 93–94. The common sources are synchronized into both Safari projects with `python3 scripts/sync-safari.py`. Actual OS banners, authenticated E3 updates, and Safari/iPad devices require separate manual validation.
