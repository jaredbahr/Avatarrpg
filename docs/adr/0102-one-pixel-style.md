# ADR 0102: One art style — crisp pixel art, held by a contract

**Status:** accepted, 2026-11-04. The owner delegated the call: "I want you to do whatever you think you can make
consistently… I just want characters, assets, and a world that all fit. I need the characters to be able to have
complexish animations since bending is a key part of the story and game." He approved the plan on #348 ("Go when
your ready I will review").

Supersedes the open question of #343 (style lock). Builds on ADR 0088 (integer zoom), ADR 0090 (1 art px a world px),
ADR 0093 (shadows on the world-pixel grid) and ADR 0097 (the party in the world's rendering).

## Context

After the batch-5 deploy the owner played Ba Dan and the Forest Road: tables, the bridge and buildings look sharp;
characters and the world look softer; shadows leave some figures and items floating. Measured on `main` `2ba71a01`:

- **The world is a painting stored as pixels.** One Ba Dan ground plate holds 68,887 distinct colours. Props hold a
  handful. Pixel art at this size holds 16–64.
- **The default party is resampled soft.** The native-G1 figures (59 art px) draw at the oblique figure scale 1.25
  (`src/app/anim/actorScale.ts`: "1.25× now, redraw later"); the residents at 1.45 (`src/render/living/geometry.ts`).
  A non-integer ratio is smoothed by design (`src/render/pixelSampling.ts`).
- **Three shadow sources disagree:** the painting's baked shadows, the props' contact lines and the figures' runtime
  pools.
- **The art the owner already approved meets the target.** Kaya C's world sheets (`public/art/units/world/kaya*.webp`,
  ADR 0097, approved 2026-11-03) are lossless, 64 colours, hard alpha, drawn at 80 px a tile, so 1 art px per world
  px at the 1.25 figure scale. They sit behind `?style=world`. Sura's and Bo's world sheets hold 2,210 and 4,166
  colours.

A local, unshipped proof (palette-mapping Ba Dan, the Forest Road and the props onto Kaya's 64 colours plus 54 world
colours, with the world-style party) read as one style. It also showed what an automatic pass gets wrong: banding in
water and stone, and Sura's blues pulled toward Kaya's palette. The conversion needs per-asset care, not a filter.

## Decision

**Crisp pixel art everywhere, with the characters setting the rule.** Bending needs frame-by-frame animation, which
only pixel art keeps consistent between frames, so the world and props come to the characters, not the reverse.

1. **Pixel grid.** Every layer (ground, uprights, props, figures, effects) ships at 1 art px per world px and draws at a
   whole number of device pixels per art pixel. No figure is resampled to a fractional size; a figure that needs to be
   larger is authored larger.
2. **One palette.** `art/style/contract.json` holds it, capped at 128 colours. It starts as Kaya C's 64 colours. A
   phase that converts new art adds the colours it needs in the same change, with the reason; it never adds a
   near-duplicate of a colour already there.
3. **Hard alpha.** Every pixel is fully opaque or fully clear. Soft edges come from the art, not from alpha.
4. **One light, one shadow system.** Light from the upper left. Runtime shadows (ADR 0093) are the only shadows on
   anything that moves or stands; art that is converted loses any baked shadow that would fight them.
5. **The contract is enforced.** `scripts/art/style-contract.test.ts` (in `npm test`, so in `ci:local` and CI) fails
   any listed asset with an off-palette colour or a semi-transparent pixel, naming the colours. An asset joins the list
   when it is converted and is never removed to get green.

## Plan

| Phase | Work                                                                                                     | Owner sign-off         |
| ----- | -------------------------------------------------------------------------------------------------------- | ---------------------- |
| P0    | This ADR, the palette and the contract test (Kaya C listed).                                             | —                      |
| P1    | Make the world-style party the default; lock Sura and Bo to the palette with their own colours added.    | Party at game zoom     |
| P2    | Convert Ba Dan's ground, uprights and props, by hand where the automatic pass bands.                     | Play-test              |
| P3    | One shadow system; remove baked shadows that fight it.                                                   | Play-test              |
| P4    | The Forest Road combat zone.                                                                             | Play-test              |
| P5    | Residents, bandits and the rest of the cast on Kaya's recipe (PixelLab budget above the 600-credit cap). | Budget, then play-test |

## Consequences

- The style question is closed: new art either fits the contract or does not merge once listed.
- Ba Dan stops being "one continuous painting" in its shipped form. The regions and frozen geometry stay; the plates
  and uprights are re-encoded on the palette, and `regen.sh --check` moves with them in P2.
- ADR 0097's deferred default switch (41 tests that pin the G1 party sheets) becomes P1.
