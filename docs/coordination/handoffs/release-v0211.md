# Handoff — release v0.2.11, the ground on its own material

Owner: bounded release-cut worker, 21 September 2026. Branch
`codex/release-v0211`, worktree `C:/Users/Jared/.codex/worktrees/release-v0211`,
base `e4c317e` (`origin/main`). Release head is the single commit on this branch.

This cut follows the shape of `8c57646` (v0.2.10): `package.json` and both
`package-lock.json` version fields 0.2.10 → 0.2.11, one `## 0.2.11 — release
candidate` section at the top of `CHANGELOG.md`, and this handoff. No source,
test, CI or config file is touched by the release commit.

## What shipped on main since 0.2.10

Four merged pull requests, `8c57646..e4c317e`. Each has its own handoff with the
full evidence, and the changelog quotes only numbers that appear there.

| PR  | Merge     | Change                                                                         | Handoff                                            |
| --- | --------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| #75 | `5cca144` | Paint the quarry floor's four oil pools and one mud patch on stone/dirt        | `quarry-floor-spill-ground.md`                     |
| #77 | `7c0b82a` | Lift the procedural `road`/`stone` tones into the illustrated family           | `village-paving-tone.md`                           |
| #76 | `b34047b` | Paint the two bare village lawns from accepted material; gallery settle budget | `village-outer-lawns.md`, `gallery-idle-budget.md` |
| #78 | `e4c317e` | Pin in tests that a load settles and the route survives the reload             | — (test only, commit `8c50211`)                    |

Ordering in the table is the landing order; #76's merge commit is older than
#77's because #76 was rebased after its gallery-settle fix. The gallery
playback-settle budget rides in #76 as commits `7db7111` and `45cdf56`, recorded
in `gallery-idle-budget.md`.

## The numbers the changelog quotes

- Quarry spills: pages `stone.webp` 39,100 → 50,252 B, `dirt-east.webp`
  28,026 → 33,068 B, `dirt-west.webp` 31,990 → 33,922 B; quarry floor moves
  4.572% of pixels on Canvas `-fit` (52,916 up / 4,119 down) and 4.912% on WebGL
  `-fit` against a frame from 0.2.10, with every other board inside
  animation-timing noise. The Cutting was not repacked.
- Village lawns: plates 1024×512 36.5 KB and 832×416 24.4 KB; map family
  820 KB → 881 KB, precache 17.62 → 17.67 MB of 25 MB; uncovered village cells
  144 → 86, south-west field 20/20 → 0/20, north-east 25/25 → 0/25; village
  default view moves 9.753% (Canvas) and 10.558% (WebGL), all up.
- Paving tones: stone 1.95x → 1.61x, east road-band window 2.06x → 1.65x on the
  same fixture and window; one stone tile centre moves 100.9 → 101.9 and every
  other terrain centre on the authored board is unchanged.
- Gallery settle: `waitForIdle` default stays 20 s, `Stage.idleTimeout` is
  `max(20_000, settleTimeout)` — 60 s on WebGL, 20 s on Canvas.
- Save continuity: the new file is 173 lines and covers the mid-battle state,
  the walk home at both custody outcomes and the discipline gate with no pick
  taken, with the gated fixture failing when `reconcileDisciplines` ignores its
  `alreadyOffered` guard.

## Checks on this head

`npm ci` from the lockfile, then `npm run verify`, `npm run build` and
`node scripts/check-bundle-size.mjs`, all run locally on the release commit
before it was pushed. Results are recorded in the PR description of this
branch. No CI run is dispatched by hand, no check is re-run, and this branch is
not armed for auto-merge.

## Still open and deliberately not claimed

- **No played browser save route.** `continuity.test.ts` drives the real parse +
  repair path, but no session was saved in the running game, reloaded and walked
  through by hand.
- **No visual acceptance against the references.** The four changes carry
  fixture frames and per-board pixel tables; none of them was compared against
  the approved player-view references.
- **No device or listening evidence.** Physical iPad and Surface touch, pinch,
  rotation and Home Screen/PWA behaviour are untested, and no one has listened
  to the audio on hardware.
- Earlier gaps that these changes did not close: the quarry floor still has no
  working furniture and its raised ledges still use the procedural elevation
  base; `dirt`, `sand` and `wall` remain at their legacy tones; the village's 86
  uncovered cells are the deliberate rim rows and tree columns. The gzipped
  bundle sat at 299.9 KB of 300 KB on #76, so any further product code has to
  pay for itself.

## Next actions

1. Read the checks the push starts. If one reddens, diagnose it locally and make
   one focused repair commit; do not re-run the failed job unchanged.
2. Once the exact-head checks pass, this PR is a release ready for the routine
   merge. It is deliberately left unarmed so the release owner decides the
   merge, per the bounded scope of this cut.

## CI cost

One branch push and one pull request, which is the release's single exact-head
run. No `main` push, no dispatch, no re-run, and no auto-merge armed.
