# Handoff: the gallery's playback-settle budget

Observed 2026-09-21 21:10 CDT on `codex/village-outer-fields` (PR #76), on top
of the two lawn plates (`a70aa7a`) and the two commits below. Verify live state
before continuing; this is a snapshot.

## What failed

`Gallery iPad WebGL 1/3` (job `106582569593` of run `35672596001`) failed
`e2e/gallery/gallery-a.spec.ts:8:3 › 13-victory Victory panel` after 2.5 min:

    TimeoutError: page.waitForFunction: Timeout 20000ms exceeded.
      at waitForIdle (e2e/helpers.ts:286)

The shard ran ~17 min against 9-13 min for its siblings and wrote only 5 of its
shots, so the run stopped at that beat. The identical shard passed on #75 at
01:43:06Z and #76's other gallery shards passed, so the two lawn plates did not
change the victory panel.

## What it was

`waitForIdle` waited a fixed 20 s. It reads
`window.fnt.app.animator.busy(performance.now())`, which is measured against the
_page_ clock, so on the iPad-WebGL project's software rasteriser a single 2x
frame of that beat can take seconds. The gallery already knows this:
`Stage.settleTimeout` is 60 s on WebGL and `curtainTimeout` is never below
30 s, both for this reason and both after earlier failures in this same shard
family. The playback settle was the last wait still on a fixed budget.

## The fix

- `e2e/helpers.ts`: `waitForIdle(page, timeout = 20_000)`.
- `e2e/gallery/suite.ts`: `Stage.idleTimeout = max(20_000, settleTimeout)` —
  60 s on WebGL, 20 s on Canvas — used by `filmstrip`.
- `e2e/gallery/beats.ts` and the seven sibling beat files: `BeatContext
.idleTimeout`, and every gallery `waitForIdle` passes it. Specs outside the
  gallery keep the 20 s default.
- A timeout still fails, and the message now says which way the budget was
  wrong: `N ms of playback left` (the playback really is longer than the
  budget), or `no frame reached the end of playback` (the clock never
  delivered a frame).

## Evidence

- `npm run verify` green on the final tree: typecheck, lint, format,
  922 tests / 114 files.
- Local `npx playwright test -c playwright.gallery.config.ts
--project=ipad-webgl gallery-a.spec.ts -g "13-victory"` → `1 passed (36.0s)`,
  beat 12.1 s.
- The diagnostic path was exercised by pinning `idleTimeout` to 1 ms for one
  local run: `waitForIdle: still busy after 1 ms (no frame reached the end of
playback) — page.waitForFunction: Timeout 1ms exceeded`, then reverted. The
  `ms of playback left` half is the same expression and was not observed firing.
- Not claimed: a green iPad-WebGL shard on this head (that is the CI run this
  push starts), any playthrough, listening, physical-device or Large-text check.

## Next action

Read the checks this push starts. If a gallery shard reddens again, the message
now names the beat and what the animator was waiting on, so widen
`Stage.idleTimeout` for that project or fix the beat it names — do not re-run a
failed shard unchanged.
