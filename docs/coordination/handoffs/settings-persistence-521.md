# Settings persistence and live effects coverage (#521)

Codex root owns `codex/settings-persistence-521` at
`/workspace/avatarrpg-env/settings-persistence521/source`, based on main
`3dbe66103534137d0da40b2b7c15ef38cf746e33`.
[Claim 6731342152](https://github.com/jaredbahr/Avatarrpg/issues/521#issuecomment-6731342152)
was independently verified before edits. Only this file and new
`e2e/settings-persistence.spec.ts` change. Existing runtime, helpers, settings,
audio, serialization, configuration, content, budgets and other owners' files
remain unchanged. No production defect or behavior change was established.

Eight browser cases cover all six shipped settings and two corrupt records.
The actual Settings DOM must expose exactly Text size, Sound, Reduce motion,
Patterned ground, Higher contrast and Show grid, with the expected radio and
switch inventories. Added controls fail loudly. Each control changes through
UI from independent shipped-default expectations, then persists through reload
and a fresh Page in the same context. All defaults are restored using existing
controls and both boot paths repeat. There is no reset-all or renderer control.

Root font size, motion scale, contrast hairline and settings attributes are
checked before opening Settings or starting gameplay after boot. Actual drawn
renderer inputs must carry pattern, grid, contrast and reduced-motion values.
High contrast enables grid lines without changing the Show grid preference.
Sound uses the issue-authorized stored/UI fallback; no gain hook exists or is
added. A passive read of the existing renderer's last drawn view introduces no
hook, spy, fabricated frame or clock write. Nonempty authored village emitters
must change across advancing frames with motion on, then all be still and
identical with reduced motion. Moving positive controls run before each change
and after reset. These checks establish renderer input behavior; screenshots
provide additional rendered context, not pixel-exact effect acceptance.

Public game/route entry skips unrelated setup/narration. It never calls
`updateSettings` or `startGame`, whose default reduced-motion write could mask
a boot failure. OS motion preference is explicitly no-preference. Invalid JSON
and wrong-type fixtures seed and verify only persisted bytes on a static page
before boot. Strict console-error/page-error listeners attach before app
navigation and remain through reload/relaunch. Corrupt bytes may be retained,
cleared or normalized; the contract is silent application of shipped defaults.

Evidence stays outside Git in `/workspace/avatarrpg-env/settings-persistence521/`:

- Preliminary production runtime reused #523 CI producer `3f566c14` after all
  869 source/public/build-input hashes matched candidate main `3dbe6610`.
  This is preliminary reuse, not a claim that #521 ran its own build yet.
- Initial desktop run: **6 passed, 2 failed**, 113.538 s wrapper; log SHA256
  `c84eb96c31bf65c7d4e7e14e74de4cc62b8b69ee1421ea4f765787ce7730702a`.
  Both corrupt cases passed defaults/UI/effects but failed on a static setup
  page's incidental `/favicon.ico` 404. Both original traces identify that URL.
  Original source (SHA256 `c7034d4dd34775ab347da4da1bec179557fbe6d904d72e4ea8b2effda80cac52`),
  logs, receipts, JSON, PNG and traces remain.
- The fixture now lets the static page settle before starting error collection
  immediately before app boot. No filtering, routes, mocks, assertion removal,
  changed timeout or source correction. Repaired corrupt cases: **2/2 passed**,
  17.430 s wrapper, log SHA256
  `50cb28ecce9e09f925afc64ccd5b54fea26581a3fdac963f4bee6b16afb45bf6`.
- Independent SOL review found no remaining material issue. Root reviewed
  preliminary fresh-page large-text, reduced-motion and high-contrast captures.

Root freezes the clean final head before `npm run ci:local`, then runs all
**19** rendered cases on that exact CI production build: eight new cases on
desktop 1368×912 and tablet 1194×834, two unchanged Canvas settings-modal
controls and the unchanged reduced-motion village walk. One worker, no retries;
original 60 s test and 10 s assertion budgets. Per-test JSON/PNG captures record
changed, reloaded, fresh-page, restored-default and corrupt-default effects.
The PR and same claim record final head/tree, receipts, capture review and
actual hosted leaf jobs/skips. No unrun combined acceptance is claimed here.

Local Chromium Canvas touch emulation does not establish WebKit, physical
input, audio output, pixel-exact ambience, hardware performance or Home Screen
PWA relaunch. Normal Surface/iPad-landscape projects discover this filename;
the iPad-portrait filename filter does not. Hosted E2E acceptance remains open
if its leaf job is skipped; no dispatch is authorized.

DRAFT only after local gates pass. No merge, Ready, deployment, installation,
art generation/replacement, security or credential change. DeepSeek approved
runner/shared accounting is unverified: no requests. Corrections stay on this
branch; preserve every failure and its evidence.
