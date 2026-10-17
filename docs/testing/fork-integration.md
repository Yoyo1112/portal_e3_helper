# Fork integration test build — 2026-10-17

This fork combines upstream main with every upstream PR open at integration time. Upstream PRs remain open; this integration does not merge them upstream. The fork keeps version 3.0.1, its packaging workflow, project link and 1/3/7-day countdown color bands. No new store release or TestFlight upload is implied.

| Source | Verified head | Included behavior |
| --- | --- | --- |
| Fork main | `7e73bb55d444d852cfb09bbcb30ae252f8f7aa50` | Existing complete fork features and mail-date migration |
| Upstream main | `3b6d1ecbcbc55654aefaedd511be147b9fc68c9c` | Security hardening, restart-safe download guards, callback-compatible notifications, localization fixes, AI streaming/keepalive, mail dates |
| [Safari PR #6](https://github.com/NYCU-Chung/portal_e3_helper/pull/6) | `6d9a235f54da7982aefb46d2bd38146289282105` | Safari API compatibility, native macOS notifications, touch UI, per-file download links, packaged changelog |
| [Exams PR #10](https://github.com/NYCU-Chung/portal_e3_helper/pull/10) | `999a4be2511d994cb57048e6450882790f52e361` | Coursework/exam suggestions, all four sources, concurrent scans and accepted-choice validation |
| [Notifications PR #11](https://github.com/NYCU-Chung/portal_e3_helper/pull/11) | `f6abc3d9eae9fe5df3d0535876624ece61b6f65a` | Event switches, daily digest, reminder retry/overflow, participant leases, unsaved settings |
| [Site scope PR #12](https://github.com/NYCU-Chung/portal_e3_helper/pull/12) | `914fd0fb964e7c8e98757f4ccd2a5f0255b057af` | Default E3/e3p/timetable/portal scope and exact HTTPS guards |

The exam module and notification API are both included in the two Safari Xcode resource phases and sync list. The Chrome ZIP deduplicates shared CHANGELOG.md while retaining every referenced runtime file.

## Validation

- 170 Node tests; syntax checks for runtime JS; whitespace/conflict checks.
- Offline Chromium: bilingual sidebar, settings/provider selection, translations, touch/drag/resize, Safari-capability download links, language reload and fresh site permissions.
- Notification options: English callback-only Chrome 93 fixture, Chinese unsupported transport and macOS native transport fixtures.
- Actual MV3 extension: two-tab exam acceptance and revisions, notification storage/alarm delivery, retry, browser restart and saved-setting races. Also repeated against the extracted delivery ZIP.
- macOS and iPad unsigned Debug builds succeeded; built content/background/i18n/notification-api/exam-detection bytes matched the integrated source.

## Manual testing

1. Extract the test ZIP. Reload the existing unpacked extension from that folder, then refresh open E3 pages. Use only one enabled copy to avoid duplicate notifications.
2. Check assignments, grades, course membership and file scanning after logging into real E3; verify old mail refreshes with its sent date.
3. Test Gemini/OpenAI summaries and today's digest with your selected provider/key, including a longer response.
4. Test exam suggestions from timetable, announcement/mail and selected PDF/Word syllabus files; accept, ignore and revise dates across two tabs.
5. Test event switches, immediate/daily delivery, deadline reminders and OS notification permission.
6. On macOS/iPad, test sidebar touch/resize and each Safari download link after building/installing the native app.

Authenticated E3, live AI requests, physical Safari/iPad behavior and OS banner visibility still require manual checks. Primary-checkout uncommitted demo/native work was not included because it is outside the upstream PR snapshots.
