# CI-green integration — #370, #322–#325

`codex/ci-green-integration` starts at main `bc77ae2eceb6740dd4c143cae61595a1f4884bc2`.
This is the single landing branch for the CI-health fixes. Existing draft PRs
#360 and #361 and the published #324 source branch remain preserved; no main
merge, deployment or auto-merge is authorized in the current session.

## Source and ownership

- Merge `0c1264d9` retains exact #360 head `3c305155` and its three authored
  commits for live Pixi texture rebinding. Merge `74cadca2` retains exact #361
  head `c346f4ec` and its three authored Gao queued-talk commits.
- Merge `339188e9` retains the published #324 candidate `ae2ea76b` and all
  three original Riverside control-lock/diagnostic commits. The lock prevents a
  rebuilt Wave/form button from appearing enabled while an activity is still
  active; its five state tests pass. The historical WebKit timeout's cause is
  still unproved. Commit `fbeae22e` adds a bounded failure-only GitHub warning
  alongside the full diagnostic attachment, because hosted artifact downloads
  have returned 403 while check annotations remain readable.
- Merge `a18f861e` retains the #325 worker's authored `603ed094`, `f49b1f66`
  and `1cdd52ed` lineage. It corrects the Riverside directional-walk spec's
  expected brisk cel rate without relaxing its 40 ms bound, and advances the
  real long shrine route to its observed animator finish before the unchanged
  idle/scene assertions. Merge `0789c83f` retains the worker's diagnostic
  commits `d3a56376` and `832f8229`: a failure-only obscurement attachment
  and bounded GitHub warning with canonical screen, frame/animator and control
  state. Other intermittent cases in #325 remain subject to hosted evidence;
  this work does not claim their closure.

## Verification and remaining gates

- On integration head `339188e9`, the focused Riverside Canvas
  discovery/forms/campaign case passed 1/1 with zero retries, unchanged 90 s
  test timeout and production build. Body duration was 72.369 s. The local
  receipt, full log and Node-held diagnostics are `/tmp/370-324-browser.receipt`,
  `/tmp/370-324-browser.log` and `/tmp/370-324-results.json`. This is Chromium
  evidence only. The five #324 `VillageLife` state tests also passed on that
  head with one worker (`/tmp/370-village-life-focused.log`).
- The #325 worker passed focused production Chromium directional Canvas/WebGL
  cases on `603ed094` and the corrected world case on `f49b1f66`; its handoff
  records the exact receipts. The later `1cdd52ed` commit records only that
  evidence. Combined-head TypeScript, scoped ESLint, Prettier and diff checks
  passed after integration, before the `fbeae22e` commit.
- On frozen integration head `0e2fbf95`, all nine selected #325 production
  Chromium cases passed with zero retries: combat formation, compact Normal
  and Huge reflow, motion transitions on both backends, obscurement on both
  backends and resident phase changes on both backends. Receipt and log are
  `/workspace/avatarrpg-env/370-325-bounded-0e-browser.receipt` and
  `/workspace/avatarrpg-env/370-325-bounded-0e-browser.log`.
  On diagnostic merge head `0789c83f`, the two affected obscurement cases
  passed on Canvas and forced WebGL with zero retries and unchanged 30/90 s
  limits; receipt and log are
  `/workspace/avatarrpg-env/370-obscurement-diagnostics-browser.receipt` and
  `/workspace/avatarrpg-env/370-obscurement-diagnostics-browser.log`. These
  browser runs reused a production build from `339188e9`;
  `src/` is byte-identical from that build head through `0789c83f`.
- On frozen integration source head `f12748ee`, the entire read-only
  `e2e/bending-cels.spec.ts` file passed three consecutive local runs, 4/4
  cases each. The exact Gao queued-talk case in
  `e2e/resident-motion.spec.ts` also passed three consecutive runs, 1/1 each.
  Each run used one worker, zero retries, activated Node 22.23.4, system
  Chromium, a fresh preview port and the production build from `339188e9`;
  `src/` remained byte-identical. Receipts and logs are
  `/workspace/avatarrpg-env/370-bending-run{1,2,3}.{receipt,log}` and
  `/workspace/avatarrpg-env/370-gao-run{1,2,3}.{receipt,log}`. All six
  receipts record exit 0 and the same head before and after. These local
  streaks fulfill the specific #322 and #323 repetition gates; hosted browser
  acceptance remains pending.
- The first hosted branch dispatch, `41013097327` on earlier head `2f38a828`,
  passed verification but exposed the still-unproved Riverside WebKit failure:
  iPad shard 1/2 saw Wave remain disabled at `00-riverside.spec.ts:254` on both
  attempts, with the unchanged 90 s timeout. Its check annotations reported
  three passed and 136 unrun cases in that shard, but no Node-held state:
  Playwright's GitHub reporter did not turn the worker's `console.log` warning
  into a check annotation. The other shards were still running when this
  diagnostic revision was committed; their results belong in the live PR.
  Merge `b5437906` preserves the isolated `2e0cd417` correction: both
  collectors now append bounded raw state to the existing Playwright failure
  message/stack, leaving the original assertion, timeout, status and full
  attachments intact. A no-browser GitHub-reporter proof in
  `/workspace/avatarrpg-env/pw-reporter-proof/` confirmed that both an
  assertion and a timed-out test retain exit 1 and emit the added context in
  `::error`. The collectors' activated TypeScript, scoped ESLint, Prettier and
  diff checks passed. No product or test timing code changed in this revision.
- The first dispatch finished with Chromium shards 1/3 and 2/3 clean (86 and
  85 passed) and 3/3 successful with 83 passed plus one flaky WebGL tea-cel
  assertion at `riverside-tea.spec.ts:343`: its first image crops stayed equal
  after the fake-clock advance, then its configured retry passed. That initial
  cause is unproved. WebKit 2/2 failed the normal-text combat framing tile-size
  assertion at `gestures.spec.ts:229` (112 passed, one skipped, 15 unrun);
  WebKit 1/2's Riverside failure left 136 unrun. The gallery matrix was skipped
  after the E2E aggregate failed. Merge `9c39e6ff` retains the isolated
  `b095dcd9` and `b4d3a33d` gesture correction and handoff. Four production
  Canvas profiles measured tile sizes 64/64 at DPR 1 and 64/96 at DPR 2 for
  the two existing viewports; the strict test now asserts that same table.
  The original focused gesture case passed at both DPRs (2/2), retaining its
  other camera, canvas and actor checks. The correction is test-only, with no
  camera/product change. Its exact receipts are in
  `docs/coordination/handoffs/ci-gesture-dpr-370.md`. The intermediate
  diagnostic head `764d36b3` passed all nine pinned local checks (259 files,
  3,008 tests); this later integration head still needs its own exact-head run.
- The second branch dispatch, `41022073661` on `c77cd6d9`, passed verification
  and all three Chromium shards cleanly (86 + 85 + 84 cases). WebKit 1/2 still
  failed Riverside with three passed and 136 unrun: the reporter now shows the
  final real Water form started at about 88 s into the fixed 90 s case, with
  3.8 s of normal activity remaining and active scene frames. WebKit 2/2 passed
  the corrected gesture assertion, then timed out at the real obscurement Log
  click near its fixed 30 s limit (five passed, 123 unrun). The gallery matrix
  was skipped after E2E failed. Merge `b700c1d0` retains the Riverside worker's
  `c8d967b0` source and evidence commits: only the long tea-porch-to-shrine
  route advances through its authored animator finish, keeping the other walks,
  full dialogue, three real-time forms, Wave locks and save/leave assertions.
  The original Canvas case passed at DPR 1 and 2 in 51.6 and 58.7 s under its
  unchanged 90 s limit; forced WebGL passed in 1.8 min under its existing
  software-renderer budget. Merge `f0b9f96d` retains the obscurement worker's
  `3a4bda9c` source and evidence commits: the test reads the synchronously
  recorded miss through real Log interaction immediately after Confirm,
  without waiting for unrelated animator playback. Its original Canvas case
  passed at DPR 2 in 13.9 s under the unchanged 30 s limit. Both changes are
  test-only; detailed focused receipts are in their respective handoffs.
- The current final head still requires all nine `npm run ci:local` steps before
  any push. Open one draft PR into main after that gate, leave auto-merge off,
  wait for PR verification, then dispatch CI once on the branch with
  `run_gallery=true`. The actual Chromium/WebKit shards and screenshot gallery
  must pass on the final head.
  A skipped PR browser/gallery matrix is not browser acceptance. Report every
  failed or unrun case; use the Riverside warning to diagnose WebKit before
  claiming #324 fixed. Physical iPad review remains separate.

No package version bump is needed for this unshipped source checkpoint.
