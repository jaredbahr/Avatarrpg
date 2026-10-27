# ADR 0086: The bend effects at the world's grain (G1)

**Status:** accepted, 2026-10-27

Amends ADR 0021 (the element cels: their size and look), ADR 0055 (the painted bend effects: their pixels, not their
data) and the particle cells of ADR 0004. Follows ADR 0085 (Route A, G1). Issue #284.

## Context

ADR 0085 put Ba Dan's world on the figures' grain: 1 art px = 1 world px, flat tone groups, a `#1b1410` contour. The
bending practice on the canal bank (#289) then showed the effects in a different medium beside it: soft gradients,
anti-aliased edges and glows, sampled smoothly at whatever scale the effect drew. Every bend visual came from one of
these places:

| source                          | where                                                                                                                              | what it was                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| painted bend effects (ADR 0055) | `public/art/fx/bend-fx.webp` + `.json`, `bend-effects.json`; packer `scripts/art/bend-effects.ts` from the off-repo v8.1 prototype | 33 painted cels (fireball, rock, water bolt), lossy WebP at 128 px a tile, 54,376 B                                                 |
| element cels (ADR 0021)         | `public/art/fx/{fire,water,earth,air,flask}-cels.png`, clips in `src/content/fxCels.ts`, sizes in `src/content/bendingCels.ts`     | 52 painted 192 px cels (flame, burst, lightning, splash, ice, healing, boulder, ...), 1,497,073 B                                   |
| particle cells (ADR 0004)       | `src/render/fx/atlas.ts` `paintCell`, recipes in `src/content/fx.ts`                                                               | nine 128 px vector shapes (glow, disc, ring, spark, shard, leaf, puff, drop, square), radial-gradient glow, scaled to 3–29 world px |
| strokes                         | `src/render/fx/simulate.ts`, `elementalStrokes.ts`; drawn by `particleLayer.ts` (Pixi `Graphics`) and `canvasFx.ts` (Canvas paths) | anti-aliased vector licks, slabs, cracks, whips, bolts, gusts and ripples                                                           |
| the contact flash               | `src/render/fx/bendFlash.ts`                                                                                                       | a CPU brightening of one cel (no shader)                                                                                            |

No bend look is shader-only: `src/render/backends/shaders.ts` draws the ground and the rules surfaces (burning, wet,
frozen tiles) and the cast shadows, not the effects. Those surfaces, and the steam puff over obscuring tiles
(`steamPuff.ts`), are terrain state rather than bend effects and are left for the surfaces pass.

## Decision

**One rule for every effect pixel: flat tones on the world grid, sampled nearest.** Both backends draw effect cels,
particle rungs and stroke rasters with smoothing off (`imageSmoothingEnabled = false`, Pixi `scaleMode: 'nearest'`), so a
texel is never blended with its neighbour.

**The painted cels are redrawn by PixelLab and cleaned up deterministically** (`scripts/art/fx-g1.ts`, sources in
`art/source/fx-g1/`):

1. `tools/inputs.py` reduces the shipped art 2:1 on premultiplied alpha: bend cels to world px (the page is 128 px a
   tile, the world 64), element cels to a 96 px master. Cels are laid on sixteen 256 px sheets with clear gutters
   (`layout.json`).
2. `tools/generate.py` sends each sheet once to Pro Flash (`edit-image-pro-flash`, text, `no_background`, seed 11) with
   the element's look and tones in the prompt. 16 jobs, 144 generations, all in `ledger.json`. The generator kept every
   cel registered on its input; no sheet needed a second seed. One sequence is not used: Pro Flash redrew the earth
   crack's dark fissure as pale raised rays, so its five cels are the painting itself, reduced and snapped like the
   rest (`PAINTED_ONLY`).
3. The packer cleans each cel the same way. Its shape is the generated opaque pixels within one pixel of the painted
   cel's silhouette, plus anything the painting held solid; a strand (a cel whose solid pixels mostly lack four solid
   neighbours: the water lashes) takes its shape from the painting alone, by row and column peak, because a generator
   frays a one-pixel line. Each pixel snaps **by value** to its element's ramp or the ink: luma bands halfway between
   tones, after moving the generated values back by the median difference from the painting (at most 48), because
   Pro Flash darkens water. Alpha is one hard level a cel, the painting's median rounded to eighths, so cels the
   painting faded still fade. A strand takes neither the ink nor its ramp's deepest tone, which would make a one-pixel
   line dark.
4. Ramps, every tone already in `src/render/palettes.ts`: fire `#8c2416 #e0521f #ffb648 #fff6e0` (fire's dark, the
   burning surface, the rim white: the element palette's pinks read as salmon at this size); water `#22566e #3e8fb0
#7ec8e3 #cdeefb`; lightning and ice on water's light end; earth on the neutral dark and the road browns
   `#4a3a2c #7a5f3e #b39064 #d8cbb0` (earth bends stone, not the nation's green); metal on the wall and stone terrain;
   air `#9a8e72 #e8dcc0 #fdf6e3`; the flask on the enemy clay. With the ink that is at most five colours a cel. The
   art bible's effects contract asks for thin dark-brown ink, so every effect keeps the generator's 1 px `#1b1410`
   outline, interrupted where the key light catches it, as ADR 0085 asks: an outline pixel whose clear neighbours are
   all above or left of it gives way to the ramp's darkest tone, and so does the outline of any speck of six pixels or
   fewer, which would otherwise be all ink (`interruptInk`).
5. Bend cels go back onto the page at 2 x 2 page px an art px, in exactly the frames the page JSON already has, so
   `bend-effects.json`, pivots, facings, segments, sockets and holds are untouched and `bend-effects.ts` stays the
   source of the data. The page is lossless WebP (method 6, exact alpha); its decoded cels are re-pinned in
   `art/source/bend-effects/pins.json`, which `art:validate` holds them to. Element cels ship at `CEL_SIZE = 96` (was 192) with a 4 px gutter, the old 8 px at half the size; the flask stays one rigid vessel in all four cels.

**Particle cells are pixel sprites on a ladder** (`src/render/fx/pixelCells.ts`). Each shape is rasterised at 2, 3, 4,
5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28 and 32 px into its atlas square: white body (the tint's colour exactly), a fixed
grey shadow side, `#1b1410` ink from 6 px up (lower right only at 6–7 px), none below, where it would be all outline.
A particle draws the rung nearest its size by ratio at one art px a world px; it never scales a rung. The glow is a
solid core and one hard ring at 104/255, not a gradient. Shapes, sizes, counts, tints, blends, timing and the
emitters' seeds are unchanged; a particle's drawn size moves by at most half a rung step.

**Element cels are resampled to the size they draw at** (`src/render/fx/celResample.ts`). A cue draws a cel anywhere
from 0.3 to 2.2 tiles, and the 96 px master scaled nearest to half size drops every other pixel and comes apart into
specks (seen in the first combat capture). So each cel is resampled once to the whole number of world pixels it
draws at: a pixel is solid when 40% of its box in the master is, and takes the colour most of that box has, the ink
counting one and a half, so the outline survives; larger than the master it is plain nearest. Results are cached by
cel, frame and size (64 at most, on both backends) and drawn unscaled: on WebGL each cel is a pooled sprite between
the strokes and the shapes rather than a particle, since its texture is its own.

**Strokes are rasterised at the world's grain** (`src/render/fx/pixelStrokes.ts`). Each emitter's sampled shapes are
drawn into a pooled canvas at one pixel a world pixel, then hardened: a pixel at least half covered becomes the
emitter's colour or its ink, whichever it is nearer, at the shape's fade in eighths; everything else clears. Both
backends draw that raster nearest-sampled where the vector paths went (Canvas `drawImage`, Pixi one pooled sprite an
emitter on a `CanvasSource`). Geometry and timing come from the same samplers.

**What does not change:** timing, holds, hit-stop, flashes, shakes, sound, sockets and trajectories (ADR 0055,
`docs/attack-animation-rhythm.md`); each element's character (fire's licks and burst, water's lash, bolt and splash,
earth's crack, rock and shatter, air's open streamlines); the parity split (ADR 0002): bend cels on both backends,
particles where they already drew; reduce motion, which still collapses the choreography and drops the particles.

## Measured

| what                       |      before |     after |
| -------------------------- | ----------: | --------: |
| `bend-fx.webp`             |    54,376 B |   6,374 B |
| five element cel sheets    | 1,497,073 B | 117,541 B |
| `fx` family (budget 4 MiB) |     1.52 MB |   0.13 MB |
| precache (budget 25 MB)    |    24.74 MB |  23.38 MB |

## Consequences

- Effects and world share a grain, a contour and a palette; at 4x an effect reads as the same medium as Kaya, the
  canal and the paving.
- An effect is 1:1 with the world, but the screen is not yet: ADR 0085's open camera item (an integer zoom) still
  decides whether a world px is a whole number of screen px.
- A new effect is drawn the same way: paint or generate at world px, clean up through `fx-g1.ts`, ship lossless.
- The painted prototype pipeline (`bend-effects.ts --source`) still writes the data; its page output is now the
  input of the G1 pass, not what ships.
- The stroke rasters read pixels back each frame (`getImageData` on a canvas the size of the stroke, a few hundred
  pixels a side at most). On the Canvas fallback that is bounded by the existing 60-shape cap.
