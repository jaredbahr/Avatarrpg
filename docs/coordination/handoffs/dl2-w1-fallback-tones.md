# Handoff — W1: the procedural fallback keyed to the ground contract

Owner: DeepSeek Flash (one bounded send) under the OpenClaw avatar-supervisor, 22 September 2026. Branch `codex/dl2-w1-fallback-tones`, clone `D:/AvatarRPG-work/dl2-ground`, base `ae35ecb`.

## Why

Every uncovered map cell falls back to `TERRAIN_STYLES`, which was a fourth colour key beside the three authored ground atlases; the village measured a 1.9x luminance step between bare cells and authored plates (`village-ground-tone.md`). DL-2 work item 1 of the ground-language plan (supervisor workspace) re-keys the fallback to the contract triples so bare cells sit inside the authored family. Hexes were fixed by the Opus scoping pass; this change applies them.

## What changed

- `src/render/palettes.ts` TERRAIN_STYLES: grass `#6f9e4c/#4f7538/#a8c686`, dirt `#b39064/#8e7049/#c7a87d`, road `#b39064/#7a5f3e/#c7a87d`, stone `#d8cbb0/#b3a488/#9a8c72`, sand `#a89880/#857762/#c2b49c`. wood, water_deep, wall, pit unchanged.
- `src/render/backends/shaders.ts` `terrainBase()`: the WebGL mirror, same fills as floats, so both backends agree.
- Regenerated derived outputs that CI asserts against the palette: six `docs/art/prompts/maps/*.md` packs (`npm run art:map-pack`) and the twelve `public/art/maps/ba-dan-scene/exterior-apron-*.webp` bands (`scripts/art/ba-dan-exterior-apron.ts`), which paint the fallback tones outward past the village rim. No new colours; no authored plate touched.

## Verification

`npm run verify` 116 files / 933 tests green; `npm run art:validate` green; `npm run check:assets` **failed** on the first head (maps family 4.01 MiB against 4 MiB: the twelve regenerated apron bands grew ~18 KB). Repair: `QUALITY` in `scripts/art/ba-dan-exterior-apron.ts` 82 → 74 and the bands regenerated; maps family 3.97 MiB, `check:assets` green; supervisor captured `02-village`, `04-board-idle`, `14-boss-blast-floor`, `38-crossbow-portrait` on ipad-webgl and inspected them: village unchanged, quarry ledges read as pale limestone rather than neutral grey, no regression.

## Not claimed

The route-tone probe (`playwright.route-tone.config.ts` + `scripts/route-tone-compare.mjs`) was not run; the 1.3x bare-cell target is asserted by the contract values, not re-measured here. The forest road plane and the quarry floor stay authored ochre/brown until W2/W3.

## Repair: water over contract ground

Owner: Opus under the OpenClaw avatar-supervisor, 22 September 2026, same branch and clone.

### Why

The e2e dispatch on `d791b1a` failed `e2e/renderer.spec.ts` "paints the ground
under the tiles" on **both** backends. With the forest road's paintings removed,
the authored puddle at tile `(5,6)` over the re-keyed procedural fallback read
grey: canvas `134/142/128`, webgl `128/139/122`, against a gate that requires
blue 20 above red. The grass assertion passed throughout.

The cause is the film, not the re-key. `SURFACE_STYLES.water` is a 0.4 wash, so
roughly 64% of what the camera sees under a puddle is the ground below — tuned
against the old dark dirt `#4d3f2f`. The contract's packed earth `#b39064`
carries red 79 above blue by construction, and the wash over it lands on grey.
Raising the wash is not available: the same coat has to keep the authored red
patch red in `e2e/partial-ground.spec.ts` "keeps an opaque patch under permanent
water", and the window where both hold is about 0.008 wide in coat weight —
which is why the earlier alpha 0.6 attempt fixed canvas, left WebGL grey and
broke the patch contract.

### What changed

ADR 0045 already answers this for the forest pond: it packs a **bed** into the
plate, so the film has something water-coloured under it. Procedural ground now
grows the same bed.

- `src/render/palettes.ts` — new `WATER_BED`: `fill` `#2a5e77` (the contract's
  bed tone, shared with `water_deep`'s detail), `weight` 0.55, `mottle` 0.08.
- `src/render/painters/tiles.ts` — `paintWaterBed`, called at the end of
  `paintTerrain`: over the terrain's own grain, not instead of it, seeded per
  tile and scaled by `surfaceIntensity`, so a temporary splash fades with its
  own duration and leaves no stain. `water_deep`, `wall` and `pit` are already
  their own dark material and are skipped.
- `src/render/backends/shaders.ts` — the same mix in the terrain branch, from
  the same constant, with the mottle on `vnoise(w * 5.0)`.

It sits in the **terrain** pass, not the surface pass. That is what keeps the
authored plates out of it: neither backend draws terrain where a painting owns
the ground, and a partial scene's authored pieces cover the terrain base pass,
so the pond plate's packed bed is never tinted twice and the red test patch is
untouched. Surface alphas, coats and rims are unchanged. No content, CSS or
scene rows.

`e2e/partial-ground.spec.ts` also carries the one intended test edit from this
branch (commit `c466ae7`): the fallback's "not red" guard compares red against
green rather than blue, because the warm earth fallback is red 79 above blue by
contract and the guard is meant to catch the missing-piece error tint, which is
red against green.

### Pixel evidence

The puddle at `(5,6)` on the procedural fallback, 3px average at the tile centre
through the camera, both paintings removed:

| backend | before | after | blue − red |
| --- | --- | --- | --- |
| canvas | `134/142/128` | `92/127/133` | −6 → **+41** |
| webgl | `128/139/122` | `84/122/128` | −6 → **+44** |

The two backends agree within 8 channels on every channel. Grass at `(3,1)` is
unchanged in character: canvas `107/152/74`, webgl `105/149/72`.

### Commands

- `npm run verify` — 116 files / 933 tests green.
- `npx playwright test e2e/renderer.spec.ts e2e/partial-ground.spec.ts` — 12
  passed (`surface-touch` is the only local project), canvas and webgl.
- `npx playwright test e2e/painted-rubble.spec.ts` — 2 passed; that spec asserts
  a live water tint over an authored rubble image, the nearest neighbour to this
  change.
- `npx playwright test -c playwright.gallery.config.ts --project=ipad-webgl -g
  "04-board-idle|08-water-whip|16-grid-on"` — 3 passed.

### Captures

`gallery/ipad-webgl/04-board-idle.png`, `08-water-whip-f1.png`,
`16-grid-on.png`, inspected. The forest plate's pond still reads as a pond: a
silty bed with depth, the bitten shore and the reeds of ADR 0044/0045 intact,
teal rather than the flat faint film the route audit complained about, and
nowhere near an opaque blue slab. The authored plate is untouched by
construction and these captures confirm it.

### Not done

The bed is uniform across a water tile with seeded mottle; it does not shade by
distance inside the water the way ADR 0045's packed bed does. A depth gradient
would need matching edge-distance work in both painters and was judged more
divergence risk than the look is worth here — the painted bank and the ground
joins already carry the shore. The village canal and the quarry floor keep their
own authored treatment. CI was not rerun from this clone.
