# The village canal gets a bed and a dressed kerb

- **Updated:** 20 September 2026, fourth scheduled DeepSeek Flash continuation
  run. Incoming owner: the next scheduled session for the same goal.
- **Outcome:** `canal-banks.webp` now carries the ground the canal's water sits
  on, not only its coping. The plate is opaque across all six permanent water
  cells: a channel bottom cut from the village's own paving, shaded darker and
  cooler with distance inside the water, and a kerb of the same stone dressed
  toward grey with a wet band at the waterline. Explicitly excluded: any rule,
  collision, surface, save, preview, camera, UI or painter change; the water's
  tile outline; reeds and bank planting; the quarry floor's flat stain.
- **Acceptance:** the shipped plate re-packs byte-for-byte from the tracked
  courtyard painting; every water pixel is opaque bed and nothing outside the
  coping radius is painted; the channel's middle measures darker than its shelf;
  the kerb measures greyer than the paving it is cut from and darker where it is
  wet. Held by `scripts/art/ba-dan-canal-banks.test.ts`.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/water-shoreline`,
  branch `codex/water-shoreline`, HEAD **`054cf7c`** plus this commit (base
  `347cee0`, the v0.2.5 merge). No PR yet, on purpose: the `0.2.7` version bump,
  changelog and PR text land on top of PR #68's merge so the release number
  follows the one already in flight.
- **Worktree state:** committed and pushed with this handoff; `node_modules` is a
  junction to the sibling `prop-contact-shadow` worktree's install. Local-only
  evidence: `.shots/canal/` (packed plate, 3x crops, before/after stacks,
  `route1`–`route4` harness captures at `1368x912`) and `.shots/water/bed3/`
  (the shipped-head captures the before/after stacks compare against). Both are
  git-ignored; nothing else is uncommitted.
- **Completed:**
  - `scripts/art/ba-dan-canal-banks.ts` rewritten: it takes no arguments and
    decodes the tracked `public/art/maps/ba-dan-scene/courtyard-ground.webp`, so
    the shipped asset is reproducible from a clean checkout (the old recipe
    needed `art/raw/scenes/ground-materials.png`, which is ignored and absent).
    Exported contracts: `canalPosition`, `canalMetric` (the true 64/32 tile
    diamond), `pavingAt`, `canalInset`, `bedShade`, `kerbShade`, `packCanalBanks`.
    Constants: `BED_ROW` 1.5, `BED_SHELF` 0.78, `BED_SHADE` 0.42, `BED_DEPTH` 32,
    `BED_MOTTLE` 0.06, `BED_COOL` 0.88/0.99/1.12, `WET_RIM` 0.12,
    `KERB_WET_SHADE` 0.86, `KERB_DRY_SHADE` 1.02, `KERB_WET_COOL` 0.05,
    `KERB_DESATURATE` 0.24.
  - `public/art/maps/ba-dan-scene/canal-banks.webp` repacked: 5,204 → 9,080
    bytes. 24,576 bed pixels — exactly the six water diamonds — 8,008 deeper than
    19 pixels, 15,280 kerb pixels, 4,224 in the wet band, deepest shade 0.317.
  - New `scripts/art/ba-dan-canal-banks.test.ts` (5 tests): the diamond metric
    against its own screen-space bounding box, byte-reproducible packing, water
    opaque and outside clear, the bed being the source paving scaled by one shade
    and the water's cool shift (sampled, 0 mismatches), the depth gradient in
    both the inset field and the shipped pixels, the kerb's dress and wet band.
  - `docs/adr/0046-canal-bed.md`; the canal and generator sections of
    `docs/art/ba-dan-scene.md`.
- **Decisions:** keep the rules tile, the runtime water layer and the courtyard
  plate untouched; put the bed in the plate that is already registered to the
  water cells, exactly as ADR 0045 did for the pond. Cut the material from the
  road rows beside the canal because the courtyard packer paints `~` as grass —
  that is why the canal was a flat pale band. Reuse the artist's pixels rather
  than synthesising a bed; desaturation, not a second material, is what makes the
  kerb read as dressed stone.
- **Verification:** `npx vitest run scripts/art/ba-dan-canal-banks.test.ts` passes
  5/5; `npm run verify` on this head passes typecheck, lint, format and the full
  suite; `npm run build` + `node scripts/check-bundle-size.mjs` and
  `npm run check:assets` are re-run before the push and recorded in the rolling
  checkpoint. Route harness
  (`FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c playwright.route-visual.config.ts`,
  `FNT_ROUTE_REVIEW_DIR=.shots/canal/route4`) passes 2/2 in 35 s, installed
  Chrome, canvas and WebGL, capturing the whole route at `1368x912`. Visual
  evidence: `.shots/canal/v4-canvas-before-after.png` and
  `v4-webgl-before-after.png` stack the shipped head (`bed3`, before) over this
  head (after) at the canal. Not covered: no playthrough, no listening, no
  physical device, and the captures are seeded fixtures entered with `enterNode`.
- **Coordination:** this branch owns `scripts/art/forest-shoreline.ts`, its
  plate, its test, ADR 0044/0045 and now the canal packer, `canal-banks.webp`,
  its test and ADR 0046. It shares no file with PR #68
  (`codex/prop-contact-shadow` owns `shapes.ts`, `propFootprint.ts`,
  `spriteCache.ts`, ADR 0043), and `git merge-tree --write-tree origin/main
origin/codex/water-shoreline` is expected to be clean. Do not push this branch
  while a CI run for #68 is active on the same host, and do not open its PR
  before #68 merges.
- **Next actions:**
  1. Read the rolling checkpoint and live GitHub: PR #68 (v0.2.6) must be merged
     with its exact-head checks green and Pages serving it before this branch
     moves.
  2. Rebase this branch onto that merge, bump `package.json`/lock to `0.2.7`, add
     the changelog entry covering the pond bed, the shore bite and the canal bed,
     and open the PR with merge-commit auto-merge.
  3. Re-run `npm run verify` plus the route capture on the rebased head (the #68
     merge repaints prop contact in the same frames) and attach the stacked
     before/after for the pond and the canal.
  4. After it ships, the remaining review art is bank planting and reeds at both
     waters, the quarry floor's flat stain, and field dressing for large flat
     fields — all of which want authored material the unattended environment
     cannot generate.
- **Completion/transfer:** committed on this branch and pushed; no PR yet. The
  outgoing owner has relinquished editing ownership of the files above to the
  next scheduled session for the same goal.
