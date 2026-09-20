# PR64 gallery budget repair

- **Updated:** 2026-09-20T11:17Z, DeepSeek continuation session (scheduled run);
  no successor assigned.
- **Outcome:** the required `Screenshot gallery` check can finish inside a
  runner budget again. The capture is split into three slice spec files and
  seven parallel jobs, and the required check name now belongs to an aggregate
  job that merges the shards back into the single `gallery` artefact. No product
  source, assertion, viewport, seed or budget changed; no version bump, because
  v0.2.2 is the release this PR ships.
- **Acceptance:** exact-head CI on the merged revision passes
  `Typecheck, lint, unit tests`, `End-to-end (Chromium touch, WebKit iPad)` and
  `Screenshot gallery`, with one `gallery` artefact containing all five projects.
- **Location:** `jaredbahr/Avatarrpg`, worktree
  `C:/Users/Jared/.codex/worktrees/v022-delivery`, branch
  `codex/pr64-gallery-budget` based on PR64 head `966d33a`; pushed to
  `codex/quarry-gate-integration` ([PR #64](https://github.com/jaredbahr/Avatarrpg/pull/64)).

## Why

The required gallery job was cancelled by its own `timeout-minutes: 75` on head
`966d33a`, run [35500759409](https://github.com/jaredbahr/Avatarrpg/actions/runs/35500759409):
started 09:39:07Z, cancelled 10:54:23Z, 119 of 340 cases captured. The other
required jobs in that run passed (verification, three Chromium shards, WebKit,
and the E2E aggregator). No assertion failed before the cancellation — every
case that ran passed.

The suite has not grown. The last complete capture, run
[35334403790](https://github.com/jaredbahr/Avatarrpg/actions/runs/35334403790)
on merged `main` at `c486457`, also ran 340 cases and finished in 1.0 h, but
that is only 15 minutes inside the limit; the runner on 20 September was about
three times slower per case, which is why the same suite needed roughly 200
minutes. Job cost is dominated by software WebGL: in the healthy run
`surface-webgl` took 25.3 minutes for 68 cases and `ipad-webgl` 23.2, while all
three Canvas projects together took 9.7 minutes. The same class of problem
already forced the browser job's three-way shard split (`0f7d6ac`).

## What changed

1. `e2e/gallery/gallery.spec.ts` became `e2e/gallery/suite.ts` plus three slice
   spec files (`gallery-a`, `gallery-b`, `gallery-c`). Playwright shards by
   _file_, so a single spec file is a single shard and `--shard` could not split
   it: the catalogue is now dealt into three files round robin
   (`beatsInSlice`), which keeps the expensive filmstrip beats, authored in
   runs, spread evenly. A new beat lands in exactly one slice with no list to
   maintain. The staging code moved verbatim; only its file changed.
2. `.github/workflows/ci.yml` gained `gallery_shards`: one job for the three
   Canvas projects and one job per third of each WebGL project, each capped at
   60 minutes, each uploading `gallery-shard-<name>`. The `Screenshot gallery`
   job is now the aggregator — it requires every shard to have succeeded,
   downloads the shards with `merge-multiple`, runs `scripts/gallery-index.mjs`
   once and uploads the single `gallery` artefact reviewers already download.
   Gating is unchanged: the shards still need `verify` and `e2e`.
3. `package.json`: `gallery` is unchanged for local use, and
   `gallery:capture` runs the capture alone so a shard can be run or recaptured
   on its own (`npm run gallery:capture -- --project=surface-webgl --shard=1/3`).
4. `docs/gallery.md` and `docs/coordination/README.md` describe the shards and
   the unchanged artefact.

## Verification

- `npm run verify` passes on this tree: typecheck, lint, format, 873 tests in
  105 files.
- Discovery: `npx playwright test -c playwright.gallery.config.ts --list`
  reports 340 cases in 3 files, 68 per project, with the beat titles unchanged.
  Each WebGL project's `--shard=i/3` resolves to 23/23/22, and the union of the
  three shards is exactly the project's 68 titles with no duplicate and no
  omission (`Compare-Object` against the unsharded list on both `surface-webgl`
  and `ipad-webgl`). The Canvas job resolves to 204 cases.
- Shard cost, from the healthy run's per-case durations, split the same way:
  surface-webgl 9.0/8.4/8.2 minutes, ipad-webgl 6.3/9.2/8.4, Canvas job 9.7.
  Even on a runner three times slower than that, no job approaches its cap.
- `.github/workflows/ci.yml` parses and its job graph is
  `verify, browser_e2e, e2e, gallery_shards, gallery`; the aggregate keeps the
  name `Screenshot gallery`.
- A local capture of `portrait-canvas --shard=3/3` ran 22 cases on installed
  Chrome: 6 passed, 15 skipped, and `38-crossbow-portrait` timed out waiting for
  its inspector portrait. That case fails the same way on the unmodified base
  `966d33a` (`gallery.spec.ts:134:3`, reproduced by stashing this work), so it
  is this host's launcher, not the slice refactor. `node scripts/gallery-index.mjs`
  then built an index over that partial shard output ("7 pictures across 1
  project"), which is the aggregate job's assembly step.
- **Gap:** no shard has run on Linux CI with software WebGL. This host has no
  bundled Playwright browser and no GPU, and the CI is the first real evidence
  for the new workflow, exactly as the earlier budget repairs were.

## Coordination

- Owned here: `.github/workflows/ci.yml` gallery jobs, the gallery spec layout,
  `docs/gallery.md`. The `verify` and `browser_e2e` jobs are untouched.
- `codex/route-visual-pass` (v0.2.3 liquid ground materials) is a separate
  branch with no PR; this change does not touch it, and it will need to rebase
  or merge the same gallery layout when it lands.
- PR #7 remains a separate documentation owner; not touched.

## Next actions

1. Read the run this push starts. All seven shards must pass; the aggregate then
   assembles `gallery` and the auto-merge already enabled on PR64 lands the
   merge commit.
2. If a WebGL shard fails, read which case and how: a case that fails on an
   assertion is a product or test problem; a shard that arrives near 60 minutes
   means the split needs a fourth slice file rather than a raised limit.
3. After the merge: confirm the Pages deployment for the merge commit and that
   the deployed title shows v0.2.2, then continue the finish line from
   `finish-through-driller.md` — the release is interim, and the outcome/return
   review, listening and physical-device rows are still open.

## Completion

Not merged at handoff: the revision is pushed for exact-head CI. The required
check names are unchanged, and no other owner is editing these files.
