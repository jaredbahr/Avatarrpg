# Quarry terrace and rim composition

This bounded correction replaces the flat grey corner patches on the Driller
floor and gives both projected quarry maps broad limestone terrace tops. It is
not acceptance of the complete quarry environment against the player-view target.

## Registration and layering

The original ground sources remain authoritative outside the exact `^` / `A`
elevation masks in `src/content/maps/combat.ts`. Imagegen edited full-size source
copies, but the packer discards every generated centre pixel. It samples only
these elevation cells, then lifts their tops by `64 * ELEVATION_LIFT` per tier
(currently 3.84 source pixels). Exposed front strips inherit the painted edge
with a restrained material shadow. These are shallow, traversable ledges, not
procedural tall cliffs or new obstacles.

The tops and shallow faces stay in the existing ground pages. Registering full
tops as scenery would draw them over movement and target overlays. This uses no
new renderer contract, cache slot, image format, budget or scenery footprint.
Runtime overlays and actors continue to use the existing projection and rules.

The original exterior sources are repacked to 55% of their height **relative to
their measured sloped ground-contact line**. Width, base endpoints, exterior
footprints, rear gap and west approach are preserved. This corrects wall-to-actor
scale without closing the intentionally open routes. The final alpha check still
rejects any rim pixel inside the playable diamond. Both atlases encode at WebP
quality 82. Updated crop metadata is in `quarryExteriorRims.ts`.

## Source provenance and reproduction

Built-in imagegen edited the existing ground illustrations. Local source copies
are retained under ignored `art/raw/terraces/` in the composition worktree; raw
intake is not a runtime asset and is not committed. Original ground and rim hashes
remain documented in the earlier registration records.

| Source                | SHA-256                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `cutting-tops-v1.png` | `51704d6196785b1bb2a451fd415ddf6a3b7aba95f38f6fd5dc8bdb40d3ae92ce` |
| `driller-tops-v1.png` | `66cbceec656663778e0d01f089a168698bb11f7ba36b6fa8efb2d17dcf00205e` |

```text
node --import tsx scripts/art/projected-scene-ground-pack.ts ambush_road art/raw/terraces/cutting-original.png art/raw/terraces/cutting-tops-v1.png
node --import tsx scripts/art/projected-scene-ground-pack.ts quarry_floor art/raw/terraces/driller-original.png art/raw/terraces/driller-tops-v1.png
node --import tsx scripts/art/exterior-rim-pack.ts ambush_road art/raw/terraces/cutting-rim-original.png --final
node --import tsx scripts/art/exterior-rim-pack.ts quarry_floor art/raw/terraces/driller-rim-original.png --final
```

All six final WebP hashes reproduce identically on a second complete pack.
Cutting ground: 139,876 bytes; Driller ground: 119,590 bytes. Cutting rim:
95,152 bytes; Driller rim: 64,114 bytes. Ground pages stay within 220 KiB per
map and rims within their original 120/80 KiB allocations. Total map family is
3.66 MiB of 4 MiB. No budget change is needed.

Rim cleanup at this scale discards 12,514 low-alpha / 1,078 guide-contact /
1,972 inside-diamond samples for Cutting, and 6,421 / 0 / 1,666 for Driller.
This is measured resampling and the same explicit boundary cleanup, not a hidden
removal of material faces. The input component bounds are enforced before sampling.

## Generation prompts

Driller edit target: `driller-original.png` (1683 x 935).

> Use case: precise-object-edit. Asset type: calibrated oblique tactical-game terrain source, edit target is the provided full diamond ground painting. Keep its exact canvas, diamond silhouette, corners, road/track grooves and every central painted pixel unchanged. Change ONLY the four bland grey-taupe stepped patches touching the top, left, right and bottom corners of the diamond. Replace these four patches with attractive broad quarried limestone terrace TOP surfaces: irregular rectangular cream/ochre stone slabs, clean warm dark-brown fine ink joints, restrained two-tone painterly shading, chipped limestone edges and occasional hairline fractures. The terrace surfaces remain flat and walkable, no upright walls, no objects, no steps protruding outside these four patch footprints, no grass. Slabs follow the existing diamond perspective, edges slope +/- one half; vary their dimensions naturally and retain the precise stepped patch outlines. Make the four corner surfaces visibly part of the same stone quarry as the middle floor, slightly lighter and with broader slab seams than the busy small middle stones. Black/transparent outside background unchanged. Do not draw a grid, actors, props, text, shadows onto neighboring cells, oil, water, rubble piles or new tracks. Preserve exact registration and all existing composition.

Cutting edit target: `cutting-original.png` (1683 x 935).

> Use case: precise-object-edit. Asset type: calibrated oblique tactical-game ground/terrace source. Edit the supplied image with its exact canvas and diamond registration unchanged. Change ONLY the pale stone perimeter patches (the stepped limestone terrace regions along the long top-right and bottom-left borders and the left and right corner edges). Paint these existing stone patches as broad quarried warm-cream limestone slab TOP surfaces with irregular rectangular block joints, thin dark-brown ink seams, chipped edges and hairline fractures, restrained two-tone painterly illustration. Preserve their exact stepped outlines. Keep the central twin paved road strips, all green grass, dirt marks and central brown rectangle exactly as provided. No upright walls, no additional elevation, no people, props, water, oil, shadows on adjacent paths or objects, no extra routes, no lettering or grid. All surfaces remain flat walkable tops. Match the same cream/ochre quarry limestone family as the input but replace the perimeter's small busy stones with calm broader coherent quarried slabs. Transparent/black exterior stays unchanged. This is an exact source edit, not a redesigned map.

The generator changed some centre pixels despite the prompt. The exact elevation
mask intentionally discards those changes; neither output is used as a wholesale
replacement ground painting.

## Remaining composition work

The camera still clips the rear rim at a full-board fit and omits most scenery
at the preferred 96px zoom. The exterior spans still read as detached scenery
at the wide view, especially around the intentionally open Driller rear gap.
This pass improves ground material, shallow contact and scale; it does not add
industrial equipment, foreground framing or the reference's continuous inhabited
stone mass. Those remain open visual review findings. Physical Surface/iPad review
has not been performed.
