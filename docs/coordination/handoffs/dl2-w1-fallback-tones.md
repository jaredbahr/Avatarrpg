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
