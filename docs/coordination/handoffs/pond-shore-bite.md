# The pond stops wearing the tile's outline

- **Superseded in part:** the same branch has since added the pond's bed; see
  [pond-bed.md](pond-bed.md) for the current head, evidence and next actions.

- **Updated:** 20 September 2026, scheduled DeepSeek Flash continuation.
  Incoming owner: the next scheduled session for the same goal.
- **Outcome:** the forest pond's bank now reaches a bounded, wandering way inside
  its own water cells, so the pond no longer reads as the rules' eight-cell
  cross. This is the route review's second bounded task, split: the _outline_ is
  addressed here with the art pipeline the plate already had; the bed itself
  (submerged stones, reeds, visible substrate) and the village canal and quarry
  floor stain are explicitly excluded and remain open.
- **Acceptance:** `npm run verify` passes; the pond shows a wandered, mottled
  shoreline on Canvas and WebGL in the route harness; the plate still covers
  every water cell's centre; the packer is reproducible byte-for-byte.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/water-shoreline`, branch
  `codex/water-shoreline` off `347cee0` (the v0.2.5 merge). Base dependency:
  `scripts/art/forest-shoreline.ts` and its source art, both unchanged since
  `9e005b1`. No PR yet — see Coordination for the merge order.
- **Worktree state:** committed on this branch; `.shots/water/` holds the ignored
  captures; `node_modules` is a junction to the sibling `prop-contact-shadow`
  worktree's install, not a committed file.
- **Completed:**
  - `scripts/art/forest-shoreline.ts`: `SHORE_BITE` (0.3 cells), `BITE_FLOOR`
    (0.3), `BITE_FEATHER` (0.05), `biteDepth` (seeded two-octave value noise at
    2.6 per cell), `pondInset` (chamfer distance inside the water), and a
    multi-source breadth-first walk that gives every packed pixel the nearest
    authored bank colour and its distance. Bitten pixels take that colour with a
    small seeded along-shore offset, so the walk's parallel chains arrive as
    mottle rather than streaks.
  - `public/art/maps/forest-scene/pond-bank.webp`: repacked. 12 013
    registration-filled pixels, 41 653 bitten pixels, 1 012 deeper than 0.22
    cells, farthest borrowed sample 0.273 cells.
  - `scripts/art/forest-shoreline.test.ts`: the old "transparent water interior"
    contract is replaced by the bounded-bite one — the exterior band and the
    no-teal guard are unchanged, the deepest bite is ≤ `SHORE_BITE`, the bite
    wanders (400+ pixels deeper than 60% of it), it stays under 35% of the wet
    pixels, the inner edge is feathered, and every authored water cell's centre
    is still clear.
  - `docs/adr/0044-pond-shore-bite.md`, `docs/art/forest-pond-shoreline.md`.
- **Decisions:** the runtime water layer is untouched — no rule, preview, save or
  shader change. The tile is still water; only its painted shore moved. Borrowing
  the artist's own bank pixels (rather than the source's shallow-water mottling)
  is what removed the columnar streaks the first attempt produced.
  [ADR 0044](../../adr/0044-pond-shore-bite.md) owns the numbers.
- **Verification:** on this head, `npm run verify` passes (typecheck, lint,
  format, unit tests) and `FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test
-c playwright.route-visual.config.ts` passes 2/2 in 32 s with
  `FNT_ROUTE_REVIEW_DIR=.shots/water/after-bite2`. Crops:
  `.shots/water/before-pond.png` (base `347cee0`) against
  `.shots/water/after2-pond-{canvas,webgl}.png`. Not covered: no playthrough, no
  listening, no physical device, and the captures are seeded fixtures entered
  with `enterNode`.
- **Coordination:** touches `scripts/art/forest-shoreline.{ts,test.ts}`,
  `public/art/maps/forest-scene/pond-bank.webp`, `docs/art/forest-pond-shoreline.md`
  and a new ADR — nothing PR #68 (v0.2.6, `shapes.ts`/`propFootprint.ts`/
  `spriteCache.ts`) owns. Merge after #68 so the version bump and `CHANGELOG`
  lines can be added on top of it, exactly as #68 had to wait for #67.
- **Next actions:**
  1. When PR #68 merges, rebase this branch onto the merge, add the `0.2.7`
     version bump, a player-facing `CHANGELOG` entry and the PR text from this
     file, re-run `npm run verify` and `npm run build` +
     `node scripts/check-bundle-size.mjs`, then open the PR and enable
     merge-commit auto-merge.
  2. Re-capture the pond plus the rest of the route on the rebased head, because
     #68 repaints what stands on the ground.
  3. Then take the review list's remaining art: the pond bed itself, the village
     canal's bed and bank, the quarry floor's flat stain, and field dressing for
     large flat fields.
- **Completion/transfer:** not merged, no PR yet. The outgoing owner keeps editing
  ownership of the packer, its plate, its test and the two art documents until
  the PR is open and reviewed.
