# ADR 0093: Pixel grounding for figures and props

**Status:** proposed, 2026-10-28 (draft PR for the coordinator's review)

Amends ADR 0071 (the shared cast-shadow union) and ADR 0077 (scene actor grounding). Changes a rendering contract
(the shadow mask's resolution and sampling on both backends) and the default grounding every scene gets, so it is
recorded here. Follows ADR 0085 to 0089 (the world at G1, the integer-zoom camera).

## Context

Jared, 2026-10-27: "I want to make sure that items and people and all that are standing on the ground that they look
like they're accurate and actually there. So that could be through shadows and all that. Whatever to make it work."

The audit (`art/source/grounding/review/`, captured with `e2e/grounding.review.ts` on both backends at integer zoom 2
and 3, 4x nearest crops) found:

| Where                      | What                                                                                                                                         | Why                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Both scenes, both backends | Every runtime shadow soft and anti-aliased beside pixel art drawn at whole device pixels per world pixel                                     | The union mask was CSS-px resolution on Canvas (sheared `drawImage` with smoothing) and half device resolution on WebGL, scaled up linearly                 |
| Forest road, quarry        | Figures stood on a blurred radial pool, a gradient no pixel in the world has                                                                 | Only Ba Dan had a contact layer (ADR 0077); every other scene kept the 0.3 pool                                                                             |
| Forest road                | The barrel, the oil flask and the hay bale hovered: no contact at all, and a round base's cast starts as a thin sliver a few pixels below it | Props got a projected cast and nothing under the base                                                                                                       |
| Ba Dan                     | Figures' casts steeper and longer than the painted tables', baskets' and bench's beside them                                                 | The runtime key is `CAST_PER_PIXEL` (0.42, 0.27 per px of height); the G1 pass set the painting's figure-scale objects in along (0.35, 0.16) (`objects.py`) |
| Ba Dan                     | Shadow strength                                                                                                                              | Not a fault: the painted table cast measures ~44% darkening, the runtime 0.5 cast ~45% (ADR 0077 measured well)                                             |
| Raised tiles               | Figures on the forest's tier-1 bank and tier-2 perch                                                                                         | Not a fault: cast and contact already lift with `liftAlong` on both backends                                                                                |
| Feet on the ground point   | Party sheets' soles sit on the 0.85 foot line within 1–2 px on side headings                                                                 | Not a fault in data; see the walk below for the vertical headings                                                                                           |

## Decision

1. **The shadow mask is pixel art.** Both backends draw the shared union at one texel per world pixel, its texel edges on
   the world-pixel grid (`shadowGrid` in `lighting.ts`: texel = camera scale, origin at the first world-pixel edge at
   or before the viewport's), sample every caster into it nearest, and lay it over the board nearest. A cast or a
   contact band is hard-edged and stepped, on the same grid as the art beside it, at every integer zoom. On WebGL a
   caster sampled between two of its art's pixels can still leave a fractional edge texel, so the composite snaps each
   texel to the nearest level the frame's casters wrote (`shadowLevels`, at most `SHADOW_LEVEL_SLOTS` = 8, 0 among
   them; more distinct levels fall onto eighths). Canvas samples nearest and needs no snap. This replaces ADR 0071's
   CSS-px Canvas mask and half-resolution WebGL mask, and ADR 0077's "full device resolution in a contact scene".
2. **Every scene has a contact layer.** `DEFAULT_ACTOR_GROUNDING` is `{ cast: 0.4, contact: 0.6 }` (was contact 0), so
   every figure that casts gets the sole band cut from its own frame (ADR 0077) and loses the radial pool, on every
   oblique board. Ba Dan keeps `{ cast: 0.5, contact: 0.8 }`. The forest and the quarry paint no shadows of their own,
   so 0.6 keeps the band clearly darker than the cast it sits in, in the ratio Ba Dan's has. A figure with
   `castShadow: false` draws no shadow at all (amendment below).
3. **A prop stands on its own base.** Two parts, both in the union:
   - **Its cast starts at its base** (`groundedCast`, `groundProfile`). A prop's art is a solid object whose base is a
     shape on screen, not a point: a box's base is a V (front corner low, side corners higher), a tripod's or a cart's
     is the line between its feet or wheels. Each column of the art is cast from the lower convex hull of the
     silhouette's bottom edge under it, so the base row is its own shadow. The figures' foot projection, which
     shears everything from one foot row, lands a box's raised side edges' shadow several world pixels below them
     (the coordinator's review of the hay bale: a band of grass between the bale and its cast).
     `propGrounding.test.ts` holds every shipped prop to "the pixel under every column's lowest opaque pixel is
     shadow" on both keys, and shows the foot projection failing that on the hay bale. Figures keep the foot
     projection: their hands are not on the ground.
   - **Its contact line.** Its own silhouette `CONTACT_LINE` = 2 world pixels lower, at the contact level: a line
     under every edge it stands on, whatever its base's shape. It is how `objects.py` set the painting's G1 objects in
     (1 px there); a prop's art is four pixels to a world pixel and its outline lands mid-texel, covering half of a 1 px
     line, so 2 shows a whole world pixel. The figures' flattened sole band was tried first; on a wide prop it poked
     out past the base's side corners at the front corner's height.
   - The soft radial pool the sprite cache baked into every prop image (`groundShadow`, measured by
     `propFootprint.ts`) is gone with its measurement: it was the one blurred shadow left on the board.
4. **A scene can name its key.** `actorGrounding.castKey` (validated down-right only) is the direction and length
   figures' and props' casts fall along. Ba Dan names objects.py's `SHADOW_KX, SHADOW_KY` = (0.35, 0.16), and
   `actorGrounding.test.ts` reads it back from that file so the two cannot drift. A scene that names none keeps
   `CAST_PER_PIXEL`, which its runtime scenery and procedural structure shadows share.
5. **The rule is tested.** `src/render/actorGrounding.test.ts`: every oblique board gives every caster a band and no
   pool, a contact darker than its cast, a key down-right and opposite `KEY_LIGHT_SCREEN`, no longer than half a
   figure's height; the mask's texel edges land on world-pixel edges at several zooms and offsets; both backends draw
   the grid, the scene key and the prop contact line.

This ADR covers what the runtime draws. The painted Ba Dan pieces are a follow-up (the coordinator's sequencing, after
ADR 0090's 1 px re-cut): their shadows are baked into the 1 px master and are fixed there and regenerated, never in the
shipped files.

## Not changed, and why (known faults)

- **Walk foot slide (ADR 0067).** Measured with `art/source/grounding/tools/walk_stride.py`: over one 12-cel loop the
  party's soles travel 10–23 world px in the art (13–29 at the 1.25 draw scale) while the game carries the figure
  83–165 px (1.825 tiles a loop through the oblique projection). The feet account for roughly 15–25% of the travel;
  the rest is slide. No data fix exists inside ADR 0067's choice: matching the art at 500 ms a tile would play the
  loop at ~70 cels/s, and matching it at the authored ~13 cels/s would take ~2.3 s a tile. ADR 0067 records Jared
  accepting the slide for a brisk pace; reopening it is his call, and the options are a slower pace, longer-stride
  walk art (a re-generation), or both. The walk strip shows the slide as it is today.
- **Vertical-heading soles leave the foot line.** North and south walks lift the lowest sole 5–7 px above it in the
  passing cels (ADR 0067's `authoredBob`). The band and the cast stay on the ground, so the figure rises off its
  shadow as it would; flagged with the stride above, since both are the walk art.
- **Figures are drawn at 1.25 on oblique boards** (`partyScale`), so one art pixel is 2.5 or 3.75 device pixels at
  N = 2 or 3 and every figure resamples soft, whatever its shadow does. This is ADR 0089's art scale and is out of
  this pass's scope; the shadows are on the world grid regardless. Resolved by ADR 0094: figures are drawn at 1.0 (owner,
  2026-10-28).
- **The riverside** draws through the living layer (`VillageLife`) with its own shadows and is not covered here.
- **Combat ambience and orthographic boards.** No board ships orthographic today; one that did would get the same
  grid at its camera scale.

## Consequences

Every scene now takes ADR 0077's exact-max Canvas path (since the amendment, the only one); its per-caster
blits are bounded to each caster's box, and the mask is now a quarter (N = 2) to a ninth (N = 3) of the pixels it
was, so the path costs less than the old default did. WebGL renders the mask at world resolution, also a fraction of
the old half-device target. A shadow's edge now steps a whole world pixel at a time; under a camera ease between
integer zooms the grid follows the scale, so the blocks grow with the art. The review fixture is
`npx playwright test -c playwright.grounding.config.ts` (`FNT_GROUNDING_LABEL`, `FNT_GROUNDING_DIR`).

## Amendment, 2026-10-28: the painted half and the forest's scenery

The owner, relayed: "a lot of items still appear to be floating. Shadows are wrong or non-existent. Uncertain items
and things." Painted Ba Dan pieces came into scope. The numbered list, with a before and after crop per item, is
`art/source/grounding/faults.md`.

1. **Painted objects stand on their own base.** `objects.py` and `props_set.py` cast each object by measuring every
   pixel's height from its lowest row, so an oblique piece's shadow lay as a flat band below its front feet (Gao's
   table, the displays, the planters, the baskets), and `reshade` had cut the bench's and fence's casts to stubs.
   `art/source/ba-dan-route-a/tools/shadows.py` lifts those shadows exactly (their masks are deterministic, as
   `props_set.lift` already used; a pixel a later polish step repainted is capped at the unshaded ground round it, so
   no pale ghost is left), casts each of the 22 objects from the lower hull of its own bottom edge along the painted
   key at `objects.py`'s tone, and lays its 1 px contact line where it meets the ground. Only columns whose bottom
   reaches the piece's footprint are feet, and what lies past the feet stands level with the end foot, so a hanging
   lamp, a sign's arm or a roof's eave is not a foot. The output is `world/world-g1-grounded.png`, the master the
   regions are now cut from (`regions_back.py`, all six through the gate without `--force`; `regen.sh --check` holds
   the shipped art to it). The pass also grounds the barrel by Gao's door, whose plain outline is authored there, and
   gives a stray beige roof tile the roof's colour.
2. **Solid scenery stands on its own base at runtime.** `SceneScenery.castFrom: 'base'` grounds a piece as a prop is
   (`groundedCast` with the piece's footprint as its feet, `footprintSpan` / `pieceFeet`, and the contact line), on
   both backends. The forest's keeper's lodge and its roadside props opt in; the lantern (its lamp hangs) and every
   tree keep the foot projection. `propGrounding.test.ts` holds the signpost case and the forest's opt-ins.
3. **Flagged, then revisited.** Gao's yard posts and cart are traced in `shadows.py` (`EXTRA_SHAPES`: two boxes under
   their caps and the wheel's ellipse) and grounded as the barrel is, the porch post beside them kept out of the cast
   (`NOT_GROUND`). The court trees' bases (roots spread into ferns; a trunk cast would streak across the path) and the
   garden plot (2 px bean poles over dark furrows) are kept. No PixelLab generation was needed.
4. **The radial pool is gone.** No figure on an oblique board reached it once every scene had a contact layer; only a
   figure with `castShadow: false` still did, and that now means no shadow at all. Both backends drop the pool and
   Canvas drops the non-exact union path, which no scene took. The bundle needed the room: the forest's scenery
   grounding put it over its 360 KB budget. ADR 0077's `groundTreatment` is now `contactBand`, the one question left.

## Amendment, 2026-10-28: a figure's cast is steady

The owner, relayed, on the jog: **"Jog is still visually wrong. Shadows are off and it makes it look like their legs
are growing."** A figure cast the frame it was drawing, sheared along the key, so every stride swept a long leg-shaped
shadow across the ground and the shape jumped from cel to cel; at the jog's reach it read as the legs themselves
stretching.

- **One steady shape a heading.** While it stands, walks, jogs, rests or settles, a figure casts its heading's idle,
  first cel (`castFrame` in `lighting.ts`), posed exactly as its body is: the same foot anchor (`liftAlong` and all),
  scale, facing and lean. Its cast therefore never changes with its legs, only with its heading and position. An
  action (a bend, a hit, a knockout, a cast) still casts its own frame, so a body that falls lies on its shadow.
- **The contact band is unchanged.** It is still cut from the drawn frame's soles (`contactBandRows`), so the dark
  2 px under the feet follows the planted foot.
- **Everything else stands.** The world-pixel grid, nearest sampling, the scene's `castKey`, the level snap and both
  backends: Canvas resolves the idle cel through the sprite cache and projects it as before; WebGL poses an off-stage
  caster sprite (`steadyCaster`) on the idle cel's texture with the body's transform. Props and scenery are unchanged.
- `actorGrounding.test.ts` holds it: for every eight-way sheet in the manifest, every cel of every walk and jog clip
  resolves to the one idle cel of its heading, and both backends route figures and residents through `castFrame`.

## Amendment, 2026-10-28: a figure's shadow is a calm pool in the painting's tone

The owner, relayed, on the world-style figure test (#317): **"the sharper pixels are better. we need to fix their
shadows though. the shadows make them look off."** Next to the painting's own shadows (Gao's door barrel, the market
table), a figure's was a dark, stair-stepped stain clinging to its feet: its silhouette sheared along the key at 0.5,
with its sole band at 0.8 under it, in the bible ink. The painting shades its objects lighter and calmer.

1. **A figure casts a pool, not its silhouette.** `figureShadow` (`lighting.ts`) rasterises, on the world-pixel grid,
   an ellipse under the feet (`FIGURE_SHADOW.pool`, 2:1 like the ground) swept a short way along the scene's
   `castKey` and tapering, at the cast level, with a smaller core under the soles (`FIGURE_SHADOW.core`) at the
   contact level. The sweep is the key times 0.6 tiles, capped at a quarter of a 1.15-tile figure, so the cast is
   about ¼ of the figure's height or less on every board. Every pixel is in or out by its centre: the edge steps a
   whole world pixel, as the painting's do. `figureShadowArt.ts` turns it into two canvases (cast, contact) both
   backends draw into the union at their levels, one canvas pixel a world pixel, nearest; the union still keeps
   the stronger of overlapping casters.
2. **It reads nothing of the figure's art.** Its size comes from the figure's scale and width (a two-tile body's
   pool is twice as wide), its place from the ground point under the feet (the walk bob lifts the figure off it).
   So it is the same shape on every cel of every clip, bends, hits and knockouts included. This replaces the steady
   cast's idle cel (`castFrame`, the off-stage `steadyCaster` on WebGL) and the sole band (`contactBandRows`,
   `CONTACT_BAND`, `spriteBandArt`), which are removed. A knocked-out figure lies over its pool at
   `FALLEN_SHADOW_ALPHA`, no longer on its own sheared body.
3. **A painted scene names its shadow tone.** `actorGrounding.ink` (0–255 a channel, validated) tints the union in
   place of the bible ink `SHADOW_RGB`; WebGL takes it as a uniform. The painting multiplies the ground by
   `SHADOW` × `COOL` under a cast and `CONTACT` × `COOL` under a contact line (`objects.py`: 0.70, 0.50, cooled
   0.93/0.96/1.06); measured over the 8,294 pixels its shadows darken in `world-g1-grounded.png`, the median ratio is
   0.653 / 0.674 / 0.742. `art/source/grounding/tools/figure_shadow_tone.py` fits one ink and two levels to that over
   the ground those shadows fall on: ink (0, 3, 11), cast 0.335, contact 0.535, 1.6 levels RMS. Ba Dan sets them
   (`BA_DAN_ACTOR_GROUNDING`, was cast 0.5 and contact 0.8 in the bible ink: about 41% and 66% darker against the
   painting's 30% and 52%). `canvas2dShadowUnion.test.ts` composites them over the mean ground and holds the result
   within 3 levels of the painting's multiply.
4. **Props and scenery are unchanged.** Their cast from their own base and their contact line stay as above; in Ba
   Dan they share the scene's ink, which is the painting's tone. The forest road and the quarry set no ink and keep
   their levels; their figures get the pool shape at those levels.

`actorGrounding.test.ts` holds the new premise: on every oblique board a figure's cast is at most a quarter of its
height, and neither backend draws a figure's shadow from its frame (`projectFigureShadow` for residents and units,
no `castFrame`, `steadyCaster`, `contactBandRows` or `projectContactMask`). `lighting.test.ts` holds the shape:
three levels only, the core under the feet inside the pool, the cast down-right and short along both keys, one run
a row (no gap between legs), larger for a larger or two-tile figure. Before and after crops are in
`art/source/grounding/review/figure-shadows/`.

Known faults: the pool does not follow a figure's stance, so a wide-legged action pose can show a boot past it; the
painted world has no figures to sample, so the pool's size is judged by eye against the barrel's and the table's;
the forest's tone is not fitted (it names no ink).

## Amendment, 2026-10-28: a figure stands on its own soles

The owner, relayed, on #319 and the world-style figures: **"Better. They're still floating."** Measured on every idle
and walk cel of the eight-way sheets and the `?style=world` sheets, at the oblique figure scale:

- **The cels did not stand on their anchor.** A sheet's anchor is one foot line for every cel, but the drawn soles
  were not on it: the shipped walks' lowest sole ran from 8 world px below the line (sunk) to 9.5 above it (hovering),
  the world-style walks from 5.5 below to 3.5 above, and several idles 2 px above.
- **The pool sat beside the feet.** On a three-quarter heading the anchor is near one foot. The resting feet's middle
  was 3 to 9 world px to the side of the anchor the pool was centred on, so it read as offset down-right or
  down-left of the figure.

Decision:

1. **Every standing or walking cel stands on its lowest sole.** When an atlas loads, the store measures each idle,
   walk, jog, rest and stance cel's pixels (`feetFromPixels` in `src/render/sheets/feet.ts`, `atlasFeet` in the
   store) and stands it by `plantAnchor`: the sheet's anchor with its foot line moved to the row under the cel's
   lowest opaque sole, when that is within 0.16 tile of it (further is not a foot). Both backends draw from the
   resolved anchor, so the planted foot is on the tile's ground point in every cel. The art's bob, the body against
   its planted foot, is kept. Actions (hits, knockouts, bends, casts) keep their authored anchor. Measured from the
   art at load, it holds for any sheet a redraw ships, with no data to keep in step.
2. **The pool centres on the feet.** `poolOffset` moves the pool to the middle of the heading's resting soles
   (its idle cel's), mirrored with the body: one offset a heading, so the pool is still steady while the legs move.
3. **A contact line under each planted sole.** A sole is a column whose lowest pixel is within `SOLE_REACH`
   (0.05 tile) of the lowest: the near foot and the far foot a few rows higher, never a lifted swing foot.
   `soleContactArt` lays the painting's contact tone on each sole's bottom row and the row under it, one pixel wider
   either side, placed exactly as the cel is drawn, so a 1–2 world px dark line shows where the boot meets the
   ground. It follows the drawn soles cel by cel; the pool around it does not. A figure with no measured feet (a
   painter placeholder, a bend cel) keeps the pool's elliptical core as its contact.

`src/render/sheets/feet.test.ts` decodes every shipped eight-way sheet and the `?style=world` sheets and holds every
idle and walk cel's lowest opaque row on its resolved anchor within one world pixel (it fails without the planting:
Kaya's idle by 1.8, the world Kaya's walk by 3.5). `store.test.ts` holds the store to it end to end, and
`canvas2d.test.ts` the contact's placement and the pool's offset. Before and after crops, a mid-walk strip among
them, are in `art/source/grounding/review/figure-planting/`.

Known faults: a cel whose soles are more than 0.16 tile off its anchor keeps the authored line (none ships); the
contact line steps with the art's own pixel grid at 1.25 world px an art px on the shipped sheets; the jog is not
played (ADR 0095), so its cels are planted but unseen.
