# Fork integration test build — 2026-10-18

Load `/Users/you-cheng/Projects/e3-helper/fork` as the unpacked Chrome/Brave extension, then reload the extension and refresh open E3 pages. Disable other copies to avoid duplicate notifications. This is the stable Git worktree on `codex/fork-testing`; its Safari macOS/iPad projects are under `safari/`.

Runtime defaults follow upstream. The fork retains version 3.0.1 and its packaging workflow as release metadata. Primary-checkout uncommitted demo/native work remains separate. This update is local: it does not push fork main, merge upstream PRs, publish a release or upload TestFlight.

## Verified sources

| Source | Verified head | Integration status |
| --- | --- | --- |
| Upstream main | `165bad5ae0126cff1d8374477f7c8db0a1f6f974` | Includes merged notifications #11 and site scope #12 |
| [Safari PR #6](https://github.com/NYCU-Chung/portal_e3_helper/pull/6) | `ef60f88bdfd54df5914339ef7546c886a1e6612f` | Open; latest review fixes included locally |
| [Exams PR #10](https://github.com/NYCU-Chung/portal_e3_helper/pull/10) | `2eb6a13c4fb5503cff624991f14091f94eada5d2` | Open; latest review fixes included locally |
| Notifications #11 | `f6abc3d9eae9fe5df3d0535876624ece61b6f65a` | Merged upstream on 2026-10-18 |
| Site scope #12 | `914fd0fb964e7c8e98757f4ccd2a5f0255b057af` | Merged upstream on 2026-10-18 |
| Fork remote main | `b3ce98f801c6590e1b1258b608c4c0d52c8163ef` | Verified unchanged; this local checkout includes additional fixes |

The prior local baseline was `c2d5b26` (runtime integration `da1e252`). This update applies Safari fixes `8452c1d` and `ef60f88`, and exam fixes `eb61734`, `820190f`, `98eeb7a`, `dde4dec` and `2eb6a13`. The notifications and site-scope behavior now merged upstream was already included in that baseline. These are recorded source patches, not claims that the PR commits were merged upstream.

## Included fixes

- Safari selects an authenticated E3 host even when the active tab on the other host is signed out or unreachable, and retains that origin for the entire sync.
- Starting any new file scan removes prepared links from the previous selection.
- Compatible numbered/unnumbered quiz posts merge within a scan; restored confirmed quizzes reconnect to their coursework; distinct numbered quizzes remain separate on repeat scans.
- Exam acceptance, local coursework field changes and sync's final merge share a background queue. Pending deletions, in-flight edits, type conversions and overdue coursework edited during sync preserve concurrent changes.
- Renaming an exam preserves date-only or class-slot timing and its duration; only conversion or an actual time change resets timing metadata.
- Announcement scans replace complete refreshed source batches, preserving older evidence beyond 200 cached candidates; oversized requests fail before storage changes.
- Delayed coursework-detail responses find the current record by ID and do not restore deleted records.

Both Safari resource bundles are synced from these combined sources, including the exam module, notification API and changelog. The Xcode resource phases already include these shared files.

## Validation for this update

- All **192 Node tests** pass from this checkout, including the new Safari and exam regressions.
- Combined test fixtures explicitly provide the Safari origin helper and the exams scan stub when testing isolated sync functions.
- Real MV3 two-tab exam acceptance, pending deletion/save races, timing metadata edits and submitted-coursework conversion passed.
- Fork UI: six tabs, language/settings, touch tap/resize/drag/cancel and narrow split view passed.
- Safari-capability bilingual download links, real click navigation, safe filenames, selection replacement and clearing links on a new scan passed.
- Real MV3 notification APIs, saved-disable race, daily scheduling, restart persistence, failed-delivery retry, reminders and alarm dispatch passed on an independent rerun. An initial concurrent run failed its retry assertion; the fixture now includes queue-state diagnostics for that assertion.
- Both Safari resource bundles match the combined shared source byte for byte; the exam engine and native notification adapter match their verified PR heads. Runtime syntax and whitespace checks passed.
- No new native build or physical Safari/iPad test is claimed for this update. Prior unsigned native builds and the earlier 175-test run belong to the 2026-10-17 integration.

## Manual testing

1. Reload the unpacked extension from this `fork/` directory and refresh E3 tabs.
2. Check assignments, grades, course membership and file scans after signing into E3; verify old mail refreshes with its sent date.
3. Test Gemini/OpenAI summaries and today's digest with your selected provider/key.
4. Test timetable, announcement/mail and PDF/Word syllabus exam suggestions; accept, ignore, rename and revise exams across two tabs.
5. Test pending deletion alongside acceptance in another tab, assignment/exam conversions and sync; verify exams and reminders remain.
6. Test notification event switches, immediate/daily delivery and deadline reminders.
7. On macOS/iPad, test sidebar touch/resize and each Safari download link, including a new scan after preparing links.

Authenticated E3, live AI requests, physical Safari/iPad behavior and OS banner visibility still require manual checks.

## Release order

Changes must be integrated upstream before publishing to TestFlight. Open PR contents may be tested locally, but an open PR or successful fork test does not satisfy that prerequisite. This update does not authorize merging upstream PRs or uploading a build. The upstream split series remains incomplete while #6 and #10 are open.

This checkout does not automatically update when GitHub changes. Integrate verified changes, sync Safari resources and validate before the next testing cycle. Do not copy older primary-checkout files over this folder. Historical ZIPs under `dist/` do not include this update.
