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
  idle/scene assertions. Other intermittent cases in #325 remain subject to
  hosted evidence; this work does not claim their closure.

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
- The current final head still requires all nine `npm run ci:local` steps before
  any push. Open one draft PR into main after that gate, leave auto-merge off,
  wait for PR verification, then dispatch CI once on the branch with
  `run_gallery=true`. The actual Chromium/WebKit shards and screenshot gallery
  must pass on the final head.
  A skipped PR browser/gallery matrix is not browser acceptance. Report every
  failed or unrun case; use the Riverside warning to diagnose WebKit before
  claiming #324 fixed. Physical iPad review remains separate.

No package version bump is needed for this unshipped source checkpoint.
