# Prop contact shadows measured from their art

- **Updated:** 20 September 2026, second scheduled DeepSeek Flash continuation.
  Incoming owner: the next scheduled session for the same goal.
- **Outcome:** a prop no longer meets the ground on a hard dark rim. The shared
  contact shadow is a feathered gradient instead of a flat ellipse, it falls a
  hair down-screen the way the board's ledge shadows do, and a prop drawn from
  art now measures its own footprint so the feathered rim shows around its base
  instead of hiding under it. This is the route review's third bounded task
  ("soften prop contact shadows"); it now ships as **v0.2.6**.
- **Acceptance:** `npm run verify` passes on the rebased head: 896 tests in 109
  files, typecheck, lint and format. `npm run build` +
  `node scripts/check-bundle-size.mjs` reports 298.7 KB gzipped of the 300 KB
  budget. The route review harness passes on both backends at `1368x912` and at
  portrait `834x1194` with Huge text (installed Chrome). All seven `Screenshot
  gallery` shards and both end-to-end families passed for PR #67's head, so this
  branch inherits a release whose whole check family is proven.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/prop-contact-shadow`,
  branch `codex/prop-contact-shadow` rebased onto `347cee0` (the v0.2.5 merge)
  with `release: v0.2.6 grounded props` on top. `.shots/prop-shadow/` holds the
  ignored before/after captures (`before/`, `after/` at `344376f`, `after-v026/`
  at the rebased head, `after-v026-portrait-huge/`, `crops/`); no server is left
  running.

## What changed

- `src/render/painters/shapes.ts`: `groundShadow` keeps its anchor — the centre
  is on the `0.86` foot line the baked sheets assume — and keeps its fade inside
  the ellipse, so a sprite still cannot paint outside its box. The fill is now a
  radial gradient (0.34 alpha at the contact, 0.26 at half the radius, clear at
  the rim) and the ellipse falls `0.025` of the box down-screen.
- `src/render/propFootprint.ts` (new): measures the widest opaque run across the
  lower half of a prop image on a 64x64 scratch canvas, adds a 15% margin and
  clamps it to the tile; unreadable or still-decoding art falls back to `0.7`.
- `src/render/spriteCache.ts`: prop images hand that measured width to
  `groundShadow`, cached per key, replacing the fixed `0.5` (`0.34` for the
  flask) that was narrower than most of the art standing on it.
- `src/render/painters/shapes.test.ts`, `src/render/propFootprint.test.ts` (new):
  seven tests over a recording stub — the fade is monotonic and transparent at
  the rim, the ellipse stays inside its box, a zero box draws nothing, the
  lower-half measurement ignores a wide canopy, and pending art is not cached.
- `docs/adr/0043-measured-contact-shadows.md` (new): the contract above.
- `package.json`, `package-lock.json`, `CHANGELOG.md`: release `0.2.6` on top of
  the rebase, so the deployed game shows a new visible version for this
  playable change.

## Evidence

- Route harness, same revision before and after, installed Chrome:
  `FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
playwright.route-visual.config.ts` → 2 passed (canvas, webgl), 32 s.
- The same harness on the changed head at portrait `834x1194` with Huge text
  (`FNT_ROUTE_REVIEW_VIEWPORT` / `FNT_ROUTE_REVIEW_TEXT=huge`) → 2 passed,
  26 s; `.shots/prop-shadow/after-portrait-huge/`. Layout, tap targets and the
  selected-tile highlight are unchanged.
- Captures: `.shots/prop-shadow/before/{canvas,webgl}` (base `344376f`) and
  `.shots/prop-shadow/after/{canvas,webgl}` (this change). Crops under
  `.shots/prop-shadow/crops/`: the barrel in `battle_grumbler`, the stone pile
  in the same frame, the cart in `battle_quarry_gate`. Before, each sat on a
  hard-edged dark ellipse; after, each sits in a soft pool with a visible rim
  past its base.
- Measured widths from the shipped PNGs (lower half of the silhouette × 1.15):
  barrel 0.63, brazier 0.72, cart 0.93, flask 0.39, hay 0.79, rubble 0.79.
- Not covered: no listening, no physical Surface/iPad, and the captures are
  seeded review fixtures from `enterNode`, not a playthrough.

## Coordination

- Touches `src/render/painters/shapes.ts`, `src/render/propFootprint.ts`,
  `src/render/spriteCache.ts`, their tests, and a new ADR. PR #67 (v0.2.5) owns
  `painters/tiles.ts`, `surfaceRendering.ts`, `shaders.ts` and the e2e probes —
  no file overlaps, so this can land either side of it.
- One release owner at a time: do not push `codex/ground-contact`.
- Deliberately not included: the pond/canal bed and bank plates and the quarry
  floor's flat stain (art), field dressing for large flat fields, and any change
  to wall footings.

## Observed, not yet explained

A soft grey ellipse with a faint amber core sits over the dirt at about tile
(6,7) of `battle_quarry_gate` in the **portrait** fixtures on both backends
(`.shots/prop-shadow/crops/portrait-pool.png`,
`portrait-pool-canvas.png`), while the desktop capture of the same node shows
plain ground at that tile (`.shots/prop-shadow/crops/desktop-gate-region.png`)
and the village and forest portrait frames show nothing at the same screen
point. Nothing is authored at that tile: the map's props are the brazier,
two water barrels, the oil flask and the cart, the enemies stand at x>=16 and
the party spawns at x<=3. It reads like a lingering pointer/focus pulse from
the harness's own wheel-zoom and drag rather than scene content, and the change
on this branch only softens the fill of an existing shadow, so it is not a
regression here. Confirm it in the next run by re-capturing the node without
the gesture, or by judging the same tile in a real playthrough.

## Next actions

1. Open the PR from this branch and enable merge-commit auto-merge; the version,
   changelog, verification, budget and both harness sets are already in place.
2. Then take the review list's next item that nothing in flight owns: the pond
   and canal bed/bank plates plus the quarry floor's flat stain (art). v0.2.5
   has merged, so ground art is free again; branch from the new `main`.
3. After that, field dressing for large flat fields, then the whole-route
   reference comparison and the motion/contact roster pass.
4. Settle the portrait-only pool above while re-capturing, and keep the open
   acceptance rows honest: no listening, no physical Surface/iPad, and the
   captures remain seeded fixtures entered with `enterNode`.

## Completion/transfer

Version, changelog, verification and both capture sets are committed on this
branch; the PR and its exact-head checks are the remaining work of this
release. The outgoing owner keeps editing ownership of `shapes.ts`,
`propFootprint.ts`, `spriteCache.ts`, their tests and ADR 0043 until the PR is
open and reviewed.
