# Prop contact shadows measured from their art

- **Updated:** 20 September 2026, scheduled DeepSeek Flash continuation.
  Incoming owner: the next scheduled session for the same goal.
- **Outcome:** a prop no longer meets the ground on a hard dark rim. The shared
  contact shadow is a feathered gradient instead of a flat ellipse, it falls a
  hair down-screen the way the board's ledge shadows do, and a prop drawn from
  art now measures its own footprint so the feathered rim shows around its base
  instead of hiding under it. This is the route review's third bounded task
  ("soften prop contact shadows"); it is not a release yet.
- **Acceptance:** `npm run verify` passes on this branch's code (`aecf50e` +
  `048f08e`): 891 tests in 109 files, typecheck, lint and format. `npm run build` +
  `node scripts/check-bundle-size.mjs` reports 298.3 KB gzipped of the 300 KB
  budget. The route review harness passes on both backends, captured before and
  after the change. Required exact-head CI has not run: no PR is open yet.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/prop-contact-shadow`,
  branch `codex/prop-contact-shadow` off `origin/main` at `344376f` (the v0.2.4
  merge). `.shots/prop-shadow/` holds the ignored before/after captures; no
  server is left running.

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

## Next actions

1. Observe PR #67's exact-head run `35536267591`. At the 16:32 CDT check every
   end-to-end gate had passed — Chromium touch 21m/29m/25m, WebKit iPad 48m32s,
   and the aggregate check 3s — with only the seven `Screenshot gallery` shards
   still running, so the release is blocked on the gallery alone. When it
   merges, confirm the real merge commit, the Pages deployment and a freshly
   served `v0.2.5` title/build. If a shard fails, diagnose it without weakening
   a required check.
2. Rebase this branch onto the merged `main`, add the version bump (`0.2.6`),
   the player-facing `CHANGELOG` entry and the PR description from this file,
   re-run `npm run verify` and `npm run build` +
   `node scripts/check-bundle-size.mjs`, then open the PR and enable
   merge-commit auto-merge. Bump version and changelog after the rebase, not
   before, because both change lines v0.2.5 also touches.
3. After the rebase, re-capture the same frames on the new base, because v0.2.5
   repaints the material tiles several of them stand next to, and compare the
   result with the three approved references.
4. Continue the review list: the pond/canal bed and bank plates plus the quarry
   floor's stain (art), then field dressing for large flat fields, then
   whole-route comparison and the motion/contact roster pass.

## Completion/transfer

Not merged. Branch pushed for continuity; the outgoing owner keeps editing
ownership of these files until the PR is open and reviewed.
