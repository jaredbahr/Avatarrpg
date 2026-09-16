# ADR 0009: Painted map backdrops

**Status:** accepted, 2026-09-16 (lands in Milestone 2, slice M2.2)

## Context

The owner's target render is a painted battlefield: a road, a pond, bushes
and boulders, trees framing the board, with the party and the HUD over it.
The board today is procedural: a terrain fill and noise per tile, decor
painted on top (ADR 0008), the ground shader on WebGL. That reads as
terrain, and it is the same on every map of the same terrain. A painting
per map is the biggest single step from the gate toward the mockup, and it
is content an image generator can produce from a prompt pack, as the
portraits and sheets are.

The rules are tile-based and stay so. Every tap, every e2e spec and the
whole of `src/core/` map a tile to a pixel through one camera; a painting
that shifted anything would break all of it. Surfaces (water, fire, ice,
oil, mud, steam, rubble) are live state that changes every turn, so they
cannot be in a painting. And a painting is not always there: none exist
yet, one may fail to load, and the probe used in CI is a flat stand-in.

## Decision

- **A painting is a field on the map, drawn under the rules grid.**
  `MapDef.backdrop?: { url, pixelsPerTile }` (`src/core/types.ts`), a
  presentation-only field like `ambience`, validated by `mapSchema`
  (`pixelsPerTile` 32 to 256). The image is `width × pixelsPerTile` by
  `height × pixelsPerTile`; `art:validate` checks the file on disk against
  that and the 2048 px texture cap. Combat maps ship at 96 px a tile
  (1920×1152), the village at 80 (1920×1280).
- **One loader for both backends.** `src/render/backdrops.ts` fetches the
  image with an `Image` through `assetUrl`, exactly as a sheet's atlas is
  loaded (ADR 0003), never through Pixi `Assets`; it keeps the three most
  recent paintings decoded for the iOS canvas cap. Until a painting lands,
  or if it fails, the procedural ground draws, so a missing file shows as
  the old board and never as nothing.
- **The painting replaces the terrain, and only the terrain.** Canvas 2D
  draws it once over the board's rectangle and skips `paintTerrain`; the
  WebGL backend shows it as a screen-space sprite under the ground quad,
  placed from the same camera numbers the ground shader reconstructs its
  tiles from, and tells the shader through `uBackdrop`. Surfaces, the
  colourblind hatch, firelight and the Show grid lines are drawn over it on
  both backends, so a puddle drains, freezes and burns on a painting as it
  does on procedural ground.
- **The ground shader accumulates premultiplied coverage.** Every step of
  the pass lays a tint with a weight or scales what is under it; over bare
  ground the accumulator starts as the terrain at full coverage and the
  output is the colour it always was, over a painting it starts clear and
  the output is only what was laid, composited by Pixi's normal blend. One
  set of surface code serves both, and the e2e pixel test on the puddle and
  the grass still passes on the bare path.
- **Decor stands down where a painting exists, except under High contrast.**
  Canopies, cliff faces, wall masses, cover stones and decals (ADR 0008) are
  what a painting paints; drawing them over one would double every tree.
  Under High contrast they return over the painting, so a blocked tile, a
  ledge and cover still read without the picture. Edge shading and the
  vignette stay over the painting and High contrast still turns them off,
  which is why a painting must be evenly lit with no vignette of its own.
- **A probe painting is committed and exercised in CI.** `public/art/test/backdrop.png`
  is the forest road's layout image at 32 px a tile with a magenta block
  over tiles (3,2) to (4,3), written by `scripts/art/probe-backdrop.ts`.
  `e2e/backdrop.spec.ts` puts it under the forest road through
  `App.overrideBackdrop` on both backends, reads the block back where the
  camera says tile (3,2) is, and checks a Show grid line darkens the painting.
  The gallery's beat 18 shows it.
- **WebP, through a wasm encoder, inside the asset budget.** `art:map`
  reads `art/raw/maps/<id>.png`, refuses the wrong aspect and any upscale,
  downsizes with the sheets' box filter and writes `public/art/maps/<id>.webp`
  at quality 82 through `@jsquash/webp` (libwebp compiled to wasm, dev-only;
  `sharp` stays rejected for its native binary). Five paintings at 1920 wide
  land near 3 MB of the 4 MB family budget; a painting that will not fit
  drops quality before the budget rises.
- **The packs are generated from the content.** `art:map-pack` writes one
  pack and one layout image per map under `docs/art/prompts/maps/` from the
  map's rows and legend: the layout image is the grid as flat colour blocks
  with the grid drawn, the composition reference for image-to-image; the
  pack says where everything is to the tile, in words, beside the authored
  scene prose. `scripts/art/lib/maps.test.ts` regenerates both and compares,
  so a map edit that forgets the pack fails the build.

## Consequences

- A map gets a painting by adding one line to its definition once the file
  exists; nothing in `src/core/` or the rules changes, and every tap lands
  where it did.
- The mood wash, the edge shading and the vignette frame a painting as they
  frame the procedural board; a painting is judged in the game, with the
  HUD docked, not on its own.
- Anything new that marks a tile (a new decor painter, a new surface) has
  to decide which side of the painting it lives on: rules-relevant marks
  follow the decor rule, live state follows the surfaces.
- The e2e suite and the gallery no longer depend on real paintings
  existing: the probe is the fixture, as the probe atlas is for sheets.
- Zooming to the maximum on a 1920-wide painting shows it at roughly one
  painting pixel a screen pixel on a 2x tablet; on a 1x screen at the
  fitted zoom it is minified without mipmaps, which is acceptable for
  painterly ground and can be revisited if it ever shimmers.
