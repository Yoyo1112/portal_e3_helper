# Fork integration test build — 2026-10-17

This fork combines upstream main with every upstream PR open at integration time. Upstream PRs remain open; this integration does not merge them upstream. The fork keeps version 3.0.1 and its packaging workflow as release metadata. Runtime defaults follow upstream: countdowns are urgent below one hour, warning below 24 hours, and normal otherwise; the Help project link points upstream. No new store release or TestFlight upload is implied.

| Source | Verified head | Included behavior |
| --- | --- | --- |
| Fork main | `7e73bb55d444d852cfb09bbcb30ae252f8f7aa50` | Existing complete fork features and mail-date migration |
| Upstream main | `3b6d1ecbcbc55654aefaedd511be147b9fc68c9c` | Security hardening, restart-safe download guards, callback-compatible notifications, localization fixes, AI streaming/keepalive, mail dates |
| [Safari PR #6](https://github.com/NYCU-Chung/portal_e3_helper/pull/6) | `3648dee4a1bc86b784d8dd97c466923be24a4052` | Safari API compatibility, native macOS notifications, touch UI, per-file download links, packaged changelog |
| [Exams PR #10](https://github.com/NYCU-Chung/portal_e3_helper/pull/10) | `ff5d2fc7ed607af6e2c3355c16ea67a345026cc0` | Coursework/exam suggestions, all four sources, concurrent scans and accepted-choice validation |
| [Notifications PR #11](https://github.com/NYCU-Chung/portal_e3_helper/pull/11) | `f6abc3d9eae9fe5df3d0535876624ece61b6f65a` | Event switches, daily digest, reminder retry/overflow, participant leases, unsaved settings |
| [Site scope PR #12](https://github.com/NYCU-Chung/portal_e3_helper/pull/12) | `914fd0fb964e7c8e98757f4ccd2a5f0255b057af` | Default E3/e3p/timetable/portal scope and exact HTTPS guards |

The exam module and notification API are both included in the two Safari Xcode resource phases and sync list. The Chrome ZIP deduplicates shared CHANGELOG.md while retaining every referenced runtime file.

## Validation

- 175 Node tests; syntax checks for runtime JS; whitespace/conflict checks.
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

## Upstream-default audit

On 2026-10-17 the integration was rebuilt independently from upstream main plus the four PR heads above. Every root runtime JS/HTML/CSS file matches that result byte for byte after restoring the countdown thresholds/colors and Help project link. The only manifest difference is the fork release version (3.0.1 versus upstream 2.3.0). New exam, notification, site-scope, Safari and mail/AI fixes remain intact. This supersedes the earlier decision to retain old fork countdown defaults.

## Stable local test checkout — 2026-10-17

Open `/Users/you-cheng/Projects/e3-helper/fork` as the unpacked Chrome/Brave extension. This is a Git worktree on `codex/fork-testing`, sharing history with the primary checkout. Safari macOS/iPad projects are under this worktree's `safari/` directory. Disable other copies of this extension before testing.

The integrated runtime commit is `da1e252`. The current Safari and exam PR heads in the table include the four review fixes: matching the active E3 origin throughout sync, safe native notification fallback links, unique exam occurrence IDs, and rotating source refresh batches. All 175 Node tests passed again from this stable checkout. The earlier browser/native validation above belongs to the recorded integration runs; physical device and authenticated E3 checks remain manual.

The fork follows upstream runtime defaults, retaining newer features/fixes and fork version 3.0.1. This checkout does not automatically update when GitHub changes. Refresh upstream and open PR heads, integrate changes here, sync Safari resources and validate before the next test cycle. Do not copy the primary checkout's older files over this folder. Primary uncommitted demo/native work remains separate pending the user's choice; upstream PRs remain open and fork remote main is still `b3ce98f`.
