# ADR 0119: Design a place, then dress it: set pieces, calm ground and a region palette

**Status:** proposed, 2026-11-17. The cohesion pilot on Ba Dan's square, approved by the owner the same day. Amends
the top-down ground bake (ADR 0104 §3) and ADR 0104's palette answer (question 4); builds on ADR 0093's grounding and
ADR 0103's art direction. The rules for map builders are in `docs/art-cohesion.md`.

## Context

The owner, 2026-11-17: "the biggest problem is object placement … I want the world to feel more lived in but also more
cohesive as a whole … not just like they're randomly scattered", and then: "right now we're kind of throwing all the
stuff on the screen to see if it fits — I want the world to feel like that's how it should be."

What the in-game shots showed:

- **Placement without intent.** Props were placed per cell as islands: five unrelated things in a row on the open
  lawn, a market display wedged behind the shrine, the bench Mira's table needs three cells from it. Past density
  passes added more islands.
- **Loud ground.** The cobble's Wang tile and its variants (rubble stones, cracks, puddles) were as busy as the props,
  with pinholes of grass left in the paving by the edge noise.
- **No shared colour.** Each PixelLab object brings its own palette; the composite held 2,839 colours.
- **No floor under the pieces.** Nothing tied a prop to the ground but its shadow: no trodden earth at a work place,
  no wet stone at the well, no weeds at a post.

ADR 0104 kept hard alpha and dropped a single 128-colour palette, because `art-lessons.md` records palette locks on
AI _character frames_ as a failure (they boiled frame to frame). Static plates and props are a different case: one
frame, no motion to boil.

## Decision

### 1. Design first: the dressing plan

A map's dressing starts from a written design note (who is here, a day, where people walk, where things are kept,
the focal point) and a plan drawn from it. The plan is data, `DressingPlan` (`src/content/setPieces.ts`), one file per
map beside its layout (`src/content/scenes/baDan.dressing.ts`):

- **Set pieces**: an anchor, its satellites and its ground aprons, with a stated purpose; optionally the zone's focal
  piece, or an edge run.
- **Paths** (desire lines), **quiet** ground and **zones**.

`validateDressing` holds the layout to it, as sentences: every prop in scope belongs to exactly one set piece;
satellites stand within two cells of their anchor; no piece stands on a path and every path cell is walkable; nothing
stands in quiet ground; a run stands on one line at an even spacing; each zone holds exactly one focal set piece. It is
CI-only data, like the rest of the layout; the runtime never reads it.

### 2. Ground aprons, baked

The baker draws each set piece's aprons into the plate, under every shadow and over the clean ground (so `clean`
stays the reference casts are measured against, and `bare` gains the aprons as it gained the house aprons): `earth`,
`flags`, `wet`, `hay` and `weeds`. Each is an ellipse wobbled by two octaves of value noise, cut per pixel, its outer
band broken; flagstones keep whole flags with a joint line round the pad. All deterministic (hashes and value noise,
no RNG draws, so the rest of the bake's sequence is unchanged).

### 3. Calm ground

A board option: the paving keeps only its quiet variants, the grass fewer and softer ones, and after the terrain each
soft ground's colours are drawn toward its own mean (paving 0.42, grass 0.72, earth 0.75). Houses' aprons, doorsteps
and every shadow are drawn after, at full strength. Ba Dan's terrain also fills lone grass vertices inside the paving
and makes the canal head one court.

### 4. The region palette lock

A board option, applied last: every plate and upright pixel is remapped to the nearest colour of the area's palette in
OKLab, no dithering, alpha untouched (`scripts/art/topdown/lib/look.ts`). Characters are never part of a bake and are
never remapped. Ba Dan's palette (`scripts/art/topdown/palettes/baDan.ts`) is 50 colours in eight ramps, derived by
k-means from the village's own calm bake and tidied by hand; it holds `#322125`. The composite goes from 2,839
colours to 49 (one palette colour goes unused).

This does not reverse ADR 0104's answer for characters: the lock is for static, single-frame art only.

### 5. Options per board

`GroundLook { calm, aprons, palette }` is passed to the baker by the board config, so a map is untouched until its own
pass turns the finish on. Ba Dan is the only board with it on.

### 6. The scale chart

`scripts/art/topdown/scale-chart.ts`: a target drawn height per prop kind, in persons (a figure stands 46 px), and a
test that fails a placed sprite more than 25 % off its target unless a waiver says why. The houses are outside it for
now (their doors are drawn 1.7 to 2 persons tall); new buildings aim for a door of about 1.4.

## Consequences

- Ba Dan's square loses nine pieces (eight props and a flower bed), four move, and the ground plate is repacked (`ground.webp` and `uprights.webp`
  under `public/art/topdown/ba-dan/`; the packed size is about the same). Two pinned numbers moved with the art: the
  seating table's row count (there are fewer props) and the bridge cap's expected pixel (now the locked colour).
- The rules map changes with the dressing (`baDanLayout.ts`): cells freed where props went, the bench and the hay
  block their new cells. Every door, NPC anchor, routine, rest spot, slot and exit stays reachable (the content
  validation and the resident routines test hold it).
- A new region's art pass costs one design note, one plan file and a palette; the validator and the chart catch the
  scattered placement and the oversized prop before the owner sees them.
- No PixelLab credits were spent: the existing kit covered every set piece.

## Not decided here

- Whether to turn the finish on for the forest road, the quarry and RG-02 (each its own pass, with its own note).
- A palette for characters (no: see ADR 0104 and `art-lessons.md`).
- Redrawing the Earth Kingdom houses to the chart's door height.
