# Combat camera glide — issue #327

## Scope

On the `codex/327-combat-camera-glide-cloud` branch from fresh main `bc77ae2`,
turn changes glide the current camera offset to the acting unit over 420 ms when
the board is not fitted. Reduced motion cuts directly; a fitted board stays put.
The shared ease is extracted to `src/app/anim/glide.ts`, while the existing
`src/app/world/practice.ts` export remains compatible. Large-actor follow retains
frame ownership and hands off to the glide when it releases. Pan, pinch, focus,
Recentre and teardown cancel motion; resize retargets an active glide without
changing scale or snapping the current view.

## Changed files

- `src/app/anim/glide.ts`, `src/app/world/practice.ts`
- `src/app/scenes/CombatScene.ts`, `combatCameraFollow.ts`
- `CombatScene.test.ts`, `combatCameraFollow.test.ts`
- `e2e/combat-focus.spec.ts`, `e2e/helpers.ts`

## Checks

- Focused Vitest: **49 tests passed** across three files.
- `npm run typecheck`: passed.
- Targeted Prettier and ESLint: passed.
- Browser/E2E, full `npm run verify`, `npm run ci:local`, and combined branch
  testing are deliberately left to the integration owner’s serialized slot.
  No build, push, PR, merge or commit was performed by this worker.

## Isolated cloud validation follow-up — 2026-10-29

The published checkpoint `27dd296554aa6f410d535bd875b6c4e6bacf86f0`
(tree `570b45ed937cc4546c7cc9afcc2d4bf60aa74b5e`) passed all nine
`npm run ci:local` stages here, including 3,009 tests in 256 files. The existing
24 focused Chromium camera/viewport cases passed on Canvas and WebGL. Hosted
CI's actual browser/gallery matrix jobs were skipped; their green aggregate
fallback checks do not establish browser or gallery execution.

Independent SOL Ultra review and supplemental captures found two camera defects:

- Loading a motion-enabled combat save at DPR 2 and 1280×720 retained 96px tiles
  instead of the settled compact 64px frame. Initial actor centring now remains
  immediate until the first HUD measurement; subsequent turns still glide.
- At 390×844, the existing 260ms AI delay could dispatch before the incoming
  420ms glide revealed the enemy, then replace that glide with the next actor's.
  The owned AI callback now waits for the camera reveal to finish. The original
  action delay, unit movement speeds and animation pace are unchanged. A turn
  change cancels the previous actor's timer, including camera-wait retries.

Durable browser regressions cover the real saved-battle adoption path and natural
AI timing; timer regressions cover waiting and lifecycle cleanup. The accompanying
cloud validation receipt records the exact local follow-up commit and its checks.
These are local changes on `codex/353-cloud-validation`, not a public PR update.

WebKit remains blocked: the repository-pinned Playwright 1.63.0 WebKit 2359
executable is absent, and its official `cdn.playwright.dev` download returned
403 under the environment's enforced network policy. The initial missing-runtime
and download results are preserved. No fallback-host retry or policy bypass was
attempted. Cross-DPR display changes, physical-device review and full gallery
acceptance remain unverified.

The main orchestrator owns publication, final visual acceptance and any PR state
change. Keep PR353 draft until that review; no push, ready state, approval, merge
or deployment is authorized by this validation handoff.
