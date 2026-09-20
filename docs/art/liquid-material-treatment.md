# Liquid ground materials

Water and oil are the two ground materials the rules let a party walk onto,
freeze, ignite or electrify, and both are painted at runtime over the modular
ground plates of every playable scene. This note records their treatment after
the Canvas/WebGL correction on 20 September 2026.

## What was wrong

- The Canvas 2D backend painted permanent water as one flat translucent fill
  clipped to the tile square, plus a thin bright line along every edge that met
  dry ground. A pool therefore ended on a straight, outlined polygon; the same
  clipped square drew the village canal as a flat teal band. WebGL had always
  gone further — it shades water with a slow ripple and a foam bank — so the
  two backends disagreed about the same pond, and the fallback path (software
  GL, which is what the automatic backend choice lands on) was the flat one.
- Oil used a near-black wash (`#242522` at 0.46). Once laid over the painted
  quarry floor it read as a hole rather than a film: the sheen marks underneath
  it were invisible on both backends, and the slabs are large on the quarry gate
  and Driller maps.

## What changed

- `src/render/painters/tiles.ts` lays water as two coats: a lighter first coat
  over the whole cell, then a firmer interior coat inset by 0.10 tile on each
  side that meets dry ground. Shared sides are not inset, so a pond four tiles
  wide is still one surface with no interior seams. Two stacked soft drift
  patches and one flow line per cell give the interior quiet tonal movement.
- Water no longer draws the universal tactical band and edge line. That outline
  is what made a pond read as a filled polygon, WebGL never drew it for water,
  and the wash still covers the water cells exactly — the lighter first coat
  keeps the hazard footprint honest while the shore erodes it visually.
- `src/render/palettes.ts` moves oil to a dark slate-green film (`#2c3532` at
  0.42) with a brighter sage edge (`#8a9a8e`) and a deeper body (`#151a18`).
  Both backends generate their oil tint, sheen and glint from those values
  (`shaders.ts` builds `MATERIAL_STYLES` from `SURFACE_STYLES`), so the film and
  its sheen now read on Canvas as well as WebGL, while the surface outline that
  marks the hazard cells is unchanged in position and stronger in contrast.

No rule, save, map row, collision, preview or budget changed. Neither treatment
reads game state: everything is seeded from the tile position.

## Evidence

`e2e/route-visual.review.ts` (run with `playwright.route-visual.config.ts`) walks
the shipped village, forest, quarry, Driller and return nodes on both backends
and writes provenance with the build, camera and captured screens of each node.
The 20 September run at `966d33a` framed the same route before and after the
correction: the forest pond and the village canal lose their flat fill and
outline, and the quarry oil slabs read as a film with visible sheen on both
backends. Crops of those captures were reviewed at 96px tiles and at the 64px
combat camera. `FNT_ROUTE_REVIEW_VIEWPORT=834x1194 FNT_ROUTE_REVIEW_TEXT=huge`
reviews the same route on a portrait tablet at the largest type size.

`src/render/painters/tiles.test.ts` holds the material contract: every coat
stays inside its own square, a water cell gets exactly two coats and no bank
outline, the other surfaces keep their band and line, a shore is inset while a
side shared with more water stays flush, and the drift patches and flow line are
still drawn.

Local focused browser runs (`renderer.spec.ts`, `partial-ground.spec.ts`,
`painted-rubble.spec.ts`, `reactions.spec.ts`, `combat-preview.spec.ts`) pass
their water assertions against this change. In this Windows container those
specs also fail intermittently at the untouched base `966d33a` (the same
canvas patch-restore tolerance and a WebGL elevation green-shift case), so their
local result is not treated as a gate; required Linux CI is.

## Known gaps

- The shore is still the tile boundary: a pond is a painted film over an
  honest eight-cell footprint, not an organic outline. Making the _edge_ itself
  irregular is an art job on the bank plates, not a painter job, and the
  approved references want an authored bank there.
- Compared with [Ba Dan exploration](../../assets/reference/player-view-2026-09-17/ba-dan-exploration.png)
  and [Causeway](../../assets/reference/player-view-2026-09-17/causeway-exploration.png),
  the approved water is a shallow, translucent body: submerged stones, plants
  and animals read through it, and its edge is an authored irregular basin. Our
  runtime water now has the soft shore, mottling and flow line, but the plate
  under it is a uniform teal field, so the bed shows nothing worth seeing. The
  next water improvement is authored bed and bank material on the pond and canal
  plates, not another painter pass; that work needs image generation.
- The quarry floor's pale elliptical stain near the mud sits in the authored
  ground plate and reads as an unexplained patch; it needs an art pass.
- No audible review was performed here, and no physical device was tested.
