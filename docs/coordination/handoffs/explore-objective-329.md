# Exploration objective chip — issue #329

## Scope and behavior

Implemented on `codex/329-explore-objective-cloud` from fresh main
`bc77ae2eceb6740dd4c143cae61595a1f4884bc2`. Exploration's current objective
now lives in a persistent header button outside the map canvas. A new objective
is expanded; its first party walk collapses it to one line; tapping or keyboard
activation toggles it; changing objective text opens the new one in full. The
nearby gate hint stays in the collapsed chip and is fully visible/wrapped when
expanded. Riverside and conversations keep it hidden. Keeping the objective
button mounted across banner rerenders preserves focus, and Toasts.ts remains
untouched; map toasts continue to anchor below the taller header using its
existing map-boundary measurement.

## Changed paths

- `src/app/scenes/ExploreScene.ts`
- `src/app/scenes/exploreObjective.ts` and `.test.ts`
- `src/styles/hud.css`
- `e2e/exploration-dock.spec.ts`

## Verification

- Focused objective state tests: **5 passed**.
- `npm run typecheck`: passed.
- Targeted Prettier and ESLint: passed.
- Browser/E2E is not run, blocked pending the integration owner's serialized
  browser slot; full verification and CI remain queued behind that review. The
  new `exploration-dock.spec.ts` coverage is
  written for 1280×800, iPad landscape and portrait at Normal/Largest text,
  including focus retention, first-walk collapse, projected walkable-tile
  clearance, and map-toast nonintersection.

## Worktree/ownership

Work remains uncommitted in `/workspace/shared/avatar329-cloud`; no build,
commit, push, PR, merge, or deployment was performed. Do not combine this work
with issue #327's separate worktree/branch. Do not modify `Toasts.ts`; issue
#326 owns that file.
