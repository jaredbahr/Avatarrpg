# Handoff — the gallery curtain wait on a starved iPad-WebGL shard

Owner: DeepSeek Flash interim continuation, 21 September 2026 (run started
18:0x CDT). Branch `codex/village-density`, worktree
`C:/Users/Jared/.codex/worktrees/village-density`, PR
[#74](https://github.com/jaredbahr/Avatarrpg/pull/74) — v0.2.10, merge-commit
auto-merge armed. Release handoff: `village-ground-tone-repair.md`.

## The head that failed

Run [35659737521](https://github.com/jaredbahr/Avatarrpg/actions/runs/35659737521)
on `8c57646`: `Typecheck, lint, unit tests`, all three `Chromium touch` shards
and `E2E WebKit iPad` green; `Gallery iPad WebGL 1/3` red on one case and the
aggregate `Screenshot gallery` red behind it.

`34-bandit-portrait` — the first beat of that shard — failed in
`settleCurtain` (`stage.ts:365`, from `Stage.shoot`), waiting out its whole
30 s for `.curtain.is-down, .curtain.is-lifting` to clear. The beat had already
opened the inspector and found the portrait canvas; only the still's
pre-condition failed. The other five beats in the shard passed, and the
**same beat passed 3.2 minutes on the neighbouring head's shard**
(`92a30e5`, run `35658820830`, job 106544107811), which is why this is read as
starvation rather than a new product defect.

## What changed

Two things about that wait, no assertion:

1. `settleCurtain(page, timeout = 30_000)` takes the caller's budget, and
   `Stage` passes `Math.max(30_000, this.settleTimeout)` — 60 s on the WebGL
   projects, 30 s on Canvas. This is the same allowance `settleLayout` already
   got after `09-rock-throw` spent its whole 30 s on four frames in run
   `35590666334`; the curtain wait was the one fixed 30 s left on that path.
2. It polls on a 250 ms interval instead of the default animation frames. The
   starved frame loop that stretches the wait is exactly what `raf` polling
   waits on, so 30 s of no frames meant no re-read of a DOM that may already
   have been clear.

`test.slow()` on the WebGL projects triples the gallery's 240 s case budget to
720 s, so the wider wait cannot trade one failure for a test timeout.

## Evidence

- The curtain's lift does not depend on the fake clock being advanced: under
  `page.clock.install()` a 100 ms `setTimeout` fires at 101 ms, rAF at 22 ms
  and a 400 ms transition's `transitionend` at 434 ms (scratch probe, deleted).
  So the 600 ms fallback in `src/app/ui/Curtain.ts` really is the guarantee, and
  a wait that outlasts it is a wait that was never re-read.
- `npm run verify` on the patched head: typecheck, lint, format, **922 tests in
  114 files**.
- The beat itself, staged locally on the patched head:
  `npx playwright test -c playwright.gallery.config.ts --project=ipad-webgl
-g 34-bandit-portrait` → passed in 14.2 s. This host is GPU-backed, so it
  cannot reproduce the runner's starvation; CI is the arbiter, exactly as
  `release-head-e2e-repair.md` records for the `pauseAt` race.
- **The first push of this repair failed its own `format:check`**: this file was
  written after the local `npm run verify` and prettier re-wraps these tables.
  Run 35666027570 died in 62 s in `Typecheck, lint, unit tests`, and both
  aggregate jobs reported `skipped`, so no e2e or gallery shard ran. The follow-up
  push is the formatted file only. Write the handoff, then verify, then push.

## Next action

1. Read the new head's `Screenshot gallery` run. If `34-bandit-portrait` fails
   again, the budget was not the mechanism: the failure needs the shard's
   `test-results/…/error-context.md`, which the upload step does not keep (it
   uploads `gallery/` only) — add it to the artifact before another attempt.
2. Once the required checks are green on the new head, confirm the merge commit,
   the `main` CI run, the Pages deploy, and that the served title reads
   `0.2.10, build <merge sha>`.

## CI cost

One push, which starts exactly one new run for the new head. No rerun of the
failed run, no dispatch, no new PR.
