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
