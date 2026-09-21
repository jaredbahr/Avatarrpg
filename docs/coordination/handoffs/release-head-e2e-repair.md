# Handoff — v0.2.8 release head: two runner-only check failures

Owner: DeepSeek Flash scheduled continuation, 21 September 2026, twelfth run.
Branch `codex/exterior-aprons`, worktree
`C:/Users/Jared/.codex/worktrees/exterior-aprons`, PR
[#71](https://github.com/jaredbahr/Avatarrpg/pull/71) — v0.2.8, merge-commit
auto-merge armed. Release handoff: `exterior-aprons-release.md`.

## The head that failed

Run `35578795966` on `7c801571` was red on four jobs. `Typecheck, lint, unit
tests` was green; `E2E Chromium touch 1/3`, `3/3` and `E2E WebKit iPad` each
failed one case identically on both attempts, and `Screenshot gallery` failed
because its shards are gated on `e2e` and so were skipped, not because a frame
was wrong.

Two distinct defects, both in state the specs assumed rather than read:

1. **`riverside-tea.spec.ts:266` — the first cel crop was empty.** Attachments
   from the previous run had already carried the answer: the seated pair's foot
   was projected at y 547.3 on a 485 px stage, so the crop (foot y - 55) started
   below the stage and read blank canvas. The break teleports the party onto
   the veranda and nothing walked them there, so the camera stayed on the tile
   row the party entered the riverside on (`offsetY 357.5`, tile 12.5). That is
   a playable defect, not a fixture defect: the player never saw the pair they
   had just seated.
2. **`directional-walk.spec.ts:84` — `clock.pauseAt: Cannot fast-forward to the
past`.** `pauseAt` refuses a target that is not ahead of the fake clock, and
   until it is paused that clock keeps pace with real time; a software-WebGL
   frame painted between reading `Date.now()` and asking for the pause spends
   the whole 1000 ms margin. `b40551b` introduced the pause in the previous run
   and inherited that race.

## What this run changed

- `fc530dd` — the previous run's camera fix, cherry-picked from
  `codex/webgl-probe-hardening`: `VillageLife.update(now, camera)` centres the
  camera on `RIVERSIDE_SPOTS.tea` when the hold starts.
- `89ee2c7` — that branch's `partial-ground` probe repair, also cherry-picked:
  the probes draw the board's own last view and read it back in the same turn
  instead of polling Playwright screenshots of a software-WebGL board.
- `349435e` — `pauseClock` in `e2e/helpers.ts` (the gallery suite's
  read-try-widen loop, now shared; the gallery's `Stage.pause` delegates to it)
  used by `directional-walk` and `riverside-tea`, plus the assertion
  `riverside-tea` was missing: the seated pair's foot and its 110 px crop are
  inside the stage.

## Evidence

- The pause race was reproduced against the live page in a scratch spec: a
  target read 1.5 s before the request fails with exactly `Cannot fast-forward
to the past`, and `pauseClock` then pauses, holds `Date.now()` still across
  700 ms of real time and steps the app with `runFor`. (Scratch spec deleted.)
- Geometry probe at the spec's own 1280x720 viewport. The first row is the
  break's own framing; the rest are after a viewport resize:

  | stage px | foot y | crop 110 px inside stage | inked px |
  | -------- | ------ | ------------------------ | -------- |
  | 485      | 259.3  | yes                      | 2558     |
  | 405      | 337.8  | yes                      | 2548     |
  | 599      | 434.8  | yes                      | 2548     |
  | 765      | 517.8  | yes                      | 2548     |

  The 485 px row is the failing runner's stage, where it read foot y 547.3 and
  0 inked pixels. The later rows are after viewport resizes, which leave the
  camera at the map's own lower limit (135 px below the stage middle) rather
  than a fixed offset from its bottom, so the crop leaves the stage only on a
  stage shorter than about 381 px, which no project uses.

- `npm run verify` on `349435e`: typecheck, lint, format, 911 tests in 113
  files.
- `riverside-tea`, `directional-walk` and `partial-ground` pass on
  `surface-touch` (15 cases); `riverside-tea` and `directional-walk` pass on
  `ipad-landscape` with `FNT_E2E_WEBKIT=1` (7 cases). Local WebKit is
  GPU-backed, so it does not reproduce the runner; CI is the arbiter.
- The gallery filmstrip beat `02b-village-walk` passes on `surface-canvas`
  through the shared helper.

## Next action

1. Confirm the pushed head's required checks on PR #71 — `Typecheck, lint, unit
tests`, `End-to-end (Chromium touch, WebKit iPad)` and `Screenshot gallery` —
   and let the armed merge-commit auto-merge land it; a new head needs its own
   run, so this is one push and one CI run.
2. If `riverside-tea` is blank again, read `tea-<backend>-blank-geometry` first:
   it now carries the foot position, the stage and the camera.
3. Then confirm Pages serves 0.2.8 and release `codex/apron-plates` (`1e26044`,
   bands under the device matrix's 2048 promise) from fresh `main`.
