# Art bible

The specification every generated asset is made against. It doubles as the
prompt sheet: an image generator gets the visual grammar from here, never a
franchise name. Original characters only, no canon names, no canon likenesses
or costume replicas; cultural motifs (a fur-trimmed parka, a wide straw hat) are
fine, a recognisable canon design is not. Check the tool's output licence
permits non-commercial use before generating anything that will be committed.

The technical shape of every asset is fixed by `docs/adr/0003-asset-contract.md`.
This document is about how it looks.

For playable environment construction, follow the
[official world model](player-view-target.md#official-world-construction-model)
and [ADR 0039](adr/0039-modular-illustrated-world.md). Compose illustrated ground
regions and independent scenery on the real gameplay grid. Complete map paintings
are supporting vistas or temporary prototypes, not the final interactive world.
Judge assets together in actual play for perspective, scale, palette, grounding,
occlusion and readable paths; individually attractive images are insufficient.

## Shared visual contract (read first)

A generator or reviewer that only reads this file must still land on the
approved look. Checkable rules, cross-referenced to where each is decided:

- **World model.** Playable spaces are a modular illustrated 2.5D world built
  from authored ground regions and independent scenery on the real gameplay
  grid, not complete map paintings — [ADR 0039](adr/0039-modular-illustrated-world.md),
  [official world model](player-view-target.md#official-world-construction-model).
- **Projection.** The shipped renderer draws an axis-aligned logical grid with
  calibrated, oblique-view painted ground and scenery references. Never
  rotate or skew finished art to reconcile it with another projection; a
  projection change needs its own implementation ADR, shared forward/inverse
  transforms and both-backend hit-testing coverage — see
  [player-view-target.md](player-view-target.md#what-the-pictures-do-not-decide).
  This is separate from the character camera in the table below (see the note
  there).
- **One light.** The warm key is always upper-left. How shading, contact and
  shadows are carried differs by asset class below; do not apply one class's
  ownership rule to another.
- **Palette.** Every colour traces to `src/render/palettes.ts` and
  `src/styles/base.css`. A colour not in those files is drift, not a variant.
- **Authorship and marks.** Original designs only: no outside-franchise
  likeness, costume replica or name in a prompt. No text, lettering, watermark
  or signature in image assets, and nothing that reads incorrectly when a
  mirrored sprite is used.
- **Grid-true geometry.** Every scenery edge that communicates a footprint,
  route or elevation comes from the map guide. Never rotate, skew or resample
  finished art to force it onto the grid.
- **One grain.** No visible square texels and no asset blurrier than the
  characters at the default camera. Outlines are dark brown, one to two screen
  pixels wide, `#1b1410` at their darkest; never black or texel-stamped. No
  photographic texture or lens effects in any class.
- **Grid seams.** Square construction seams should disappear in normal
  presentation; the tactical overlay is the exception, not the default view.
- **HUD.** The world occupies most of the screen; a compact dock holds
  portraits, health and touch actions, per
  [player-view-target.md](player-view-target.md#what-the-approval-means).

## Asset-class contracts

### Characters in play

Party and NPC unit atlases are transparent raster sprites. The default frame
for a one-tile unit is 128×192; some units ship wider frames for weapon reach
and the boss is a 2×2 unit, so `src/content/assets/manifest.ts` is the
authority for each sheet's frame size and anchor. The shipped figures use fine, visibly
raster-scale detail, dark-brown silhouette and interior lines, and several
stepped colour values within major materials; they are not an exact two-tone
contract. Preserve transparent gutters and clean alpha, with no painted floor,
contact pool or directional cast shadow. Feet sit on the 85% baseline within
2 px, and the silhouette must remain readable at 40 px tall.

ADR 0071 gives the renderer ownership of character grounding: it draws the
close contact pool and projects the upright alpha silhouette down-right into
the single unioned cast-shadow layer. Overlaps must not double-darken.

### Scenery

Two scenery treatments ship, and each map follows its own.

**Ba Dan village (one continuous painting).** The village is a single painting, not pieces laid on a
lawn: twelve overlapping region paintings, each painted over a guide rendered from the map's own geometry
and registered to it within two pixels, stitched into one picture and cut back into ground plates and
the pieces a figure can walk behind (the houses, the trees, the dressing). Painted ramps, restrained
material variation and fine grain, authored at 1.5 painting pixels per world pixel and shown at the
camera's 1.5 screen pixels per world pixel, so a painted pixel is a screen pixel. The silhouette and
footprint edges of an upright are forced by the geometry (its alpha is the guide's silhouette); ridges,
eaves, corners, openings, steps and plinths are painted over the guide's lines, and roof-course count
and spacing are free surface paint.

The painting already holds the upper-left light, the cast shadow, the contact under every foot, the worn
ground, the joins between materials and the canal. So Ba Dan is a complete scene: the runtime draws no
contact ring, no projected cast (ADR 0071's cast stays off for all of its scenery), no ground-join wash and
no film over the permanent water; actors keep their own shadows. Follow
[Ba Dan: one continuous painting](art/ba-dan-scene.md#ba-dan-one-continuous-painting-integration-of-10-october-2026)
for the construction and the pipeline rather than duplicating them here.

**Forest road and quarry.** Ground keeps the DL-2 material table below: two
flat tones per material plus the rim or detail colour, enforced by the route
ground generators and their tests. Their scenery keeps ADR 0071's runtime
contact and projected cast. Moving either map to the village treatment is a
visual-direction change for the owner, not a consequence of this document.

### Effects cels

Effects use transparent, cleanly registered cels with flat fills, one shadow
tone and one highlight tone, thin dark-brown ink, and no gradients, glows,
blurry smoke, photographic texture or lens effects. Fire forms ribbons and
licks; water forms whips, sheets and droplets; earth forms slabs and shards;
air leaves open transparent space between spirals and arcs. Keep each effect
inside its cell and readable at 64 px.

### Illustrated cast art and portraits

Dialogue portraits, and the older illustrated action, tea and wave frames that
still sit in some unit sheets, were briefed as flat cel base plus one shadow
tone. As shipped they show smoother hand-drawn shading with softer variation
than that brief; the delivery notes record this as a first art pass
([dialogue portraits](art/dialogue-portraits.md),
[hero art delivery](art/hero-art-delivery.md)), accepted as shipped rather than
approved as a standard (see the open questions). The prompt packs' style block
remains the generation brief and is stricter than this shipped tolerance.
Portraits are 512×512 busts on a plain
warm parchment field and retain clear room for the circular crop. These are
larger illustrations, not enlarged in-play sprites; identity, costume,
silhouette and palette must agree between the two classes without requiring
the same density or number of tones.

## Camera and frame

| Rule       | Value                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| View       | Three-quarter top-down, about 30° above horizontal, character facing screen-right                                                              |
| Frame      | One-tile unit: 128×192 px (1 tile wide, 1.5 tall). Wider frames and the 2×2 boss: see the manifest. Generate at 4× (512×768) and downscale     |
| Baseline   | Feet on a line at 85% of frame height; the runtime stands that line 85% of the way down the tile, so the head overlaps the tile above          |
| Background | Delivered frame transparent: no floor, contact pool or cast shadow (the renderer draws them). Without alpha output, generate on flat `#00ff00` |
| Facing     | One facing only. Enemies are mirrored, so no lettering or asymmetric emblems that would read wrong flipped                                     |
| Margins    | At least 8 px of empty frame on every side after trim; effects that extend past the frame belong to the FX layer                               |

This View row is the generation camera for character sprites only — how a unit
is posed and lit in its own frame. It does not describe the world projection.
Ground, scenery and level art follow the axis-aligned grid and oblique painted
references from [ADR 0039](adr/0039-modular-illustrated-world.md) and
[player-view-target.md](player-view-target.md#what-the-pictures-do-not-decide);
never rotate or skew a finished sprite to match that projection, and never use
this row to justify rotating or skewing world art instead.

## Palette

Locked to `src/render/palettes.ts` and `src/styles/base.css`. Generated art is
colour-checked against these values; drift is a QA failure.

| Nation / role | Base      | Soft      | Notes                                      |
| ------------- | --------- | --------- | ------------------------------------------ |
| Fire          | `#d1462f` | `#f0785c` | Reds and charcoal, gold trim sparingly     |
| Water         | `#3e8fb0` | `#7ec8e3` | Blues, bone white, fur trim                |
| Earth         | `#6f9e4c` | `#a8c686` | Greens and ochre, broad silhouettes        |
| Air           | `#e8dcc0` | `#fdf6e3` | Parchment and cream, layered cloth         |
| Non-bender    | `#9b7bb8` | `#c3a8d8` | Violet and leather, tools and weapons      |
| Enemy         | `#8a4b3c` | —         | Rust and dust; bandits and mercenaries     |
| Neutral       | `#8d7d69` | —         | Villagers, allies, the narrator            |
| Ink           | `#1b1410` | —         | Darkest authored edge and line             |
| Gold          | `#d9a441` | `#f0c674` | UI accent; on a character only as a detail |

### Ground language (DL-2 section 3)

These are the route's authoritative material triples; generated plates,
procedural fallbacks and both render backends must use the same values. Forest
road and quarry ground use them as flat tones. Ba Dan's painting is the
stated exception: the village painting takes these values as palette anchors and adds
painted ramps and fine grain (see [art/ba-dan-scene.md](art/ba-dan-scene.md)).

| Ground material       | Base           | Shadow                    | Rim / detail                           |
| --------------------- | -------------- | ------------------------- | -------------------------------------- |
| Limestone paving      | `#d8cbb0`      | `#b3a488`                 | joints `#9a8c72`, pale rim `#efe6d2`   |
| Packed earth road     | `#b39064`      | `#8e7049`                 | rut `#7a5f3e`, dust `#c7a87d`          |
| Quarry spoil / rubble | `#c7a87d`      | `#8e7049`                 | chip `#d8cbb0`                         |
| Cut stone block face  | `#cfc2a6`      | `#a2957c`                 | tool mark `#8a7d66`                    |
| Grass verge           | `#6f9e4c`      | `#4f7538`                 | tuft `#a8c686`, wear `#b39064`         |
| Water margin          | film `#3e8fb0` | bed `#2a5e77` / `#173b4c` | damp bank `#8e7049`; no pale waterline |

**Ground ink rule.** Use `#1b1410` only where a visible ground edge communicates
gameplay: a hazard shore, cover silhouette or elevation break. Plain materials
feather into one another without ink. In particular, road-to-verge,
road-to-spoil and spoil-to-earth joins are not object outlines. The water hazard
shore may carry the ink edge, but the former `#7ec8e3` waterline band is not a
ground-material edge and must not return.

## Silhouette rules

- Each character owns one signature shape readable at 40 px: a hair silhouette, a hat, a sleeve, a weapon. Two characters of the same element must differ in silhouette, not only in colour (the kits already distinguish `lean`, `broad` and `robed` builds; the art keeps that).
- Enemies share a family silhouette per faction (bandits: ragged and asymmetric; mercenaries: armoured and square) so a table reads who is who without a legend.
- The boss is two tiles wide and reads as a machine, not a person.
- Props read at a glance as what they do: a barrel spills, a flask cracks, a brazier burns, hay catches, rubble covers, a cart blocks.

## Clips and poses

One row per clip from ADR 0003. A pose is one frame; the animator provides the movement between poses.

| Clip    | Pose        | Description                                                                 |
| ------- | ----------- | --------------------------------------------------------------------------- |
| `idle`  | A           | Weight on the back foot, hands ready, eyes on screen-right                  |
| `idle`  | B           | Same pose, chest lifted 2% (a breath). Nothing else moves                   |
| `walk`  | A, B (C, D) | Contact poses, opposite legs; arms counter-swing                            |
| `cast`  | wind-up     | Weight back, the element gathered at the hands, coat and hair trailing back |
| `cast`  | release     | Lunge toward screen-right, leading arm extended, element leaving the hand   |
| `cast`  | recover     | Settling, weight returning, element gone                                    |
| `melee` | A, B        | Wind-up and strike with the character's weapon or fist                      |
| `hit`   | —           | Recoil away from screen-right, eyes shut, one foot lifted                   |
| `ko`    | —           | On one knee, head down. Never gore                                          |

Element in the hands is drawn in the character's clip only as a hint (a glow,
a small flame). The bending itself is the FX layer, so the same cast pose
serves every ability of that element.

Planned, not yet in the contract: element-specific forms for the cast,
from the owner's four-panel storyboard (gather, strike, impact, recover).
They would be optional clips `cast_fire`, `cast_water`, `cast_earth` and
`cast_air` of four poses each, a fire punch, water's flowing arms, an earth
stance, an air spin, picked by the ability's element when a sheet carries
them and falling back to `cast` when it does not. They wait on the first
generated sheet, so the forms are drawn against real frames
(`docs/roadmap.md`, Milestone 2).

The placeholders draw this table as written: `src/render/painters/figure.ts`
holds one pose per row, solved from the feet up so every frame stands on the
baseline, and `cast.ts` gives each character the silhouette of their reference
figure. They are stand-ins, readable at 40 px, and the choreography, the
mirroring and the health bar are exercised by them before a real sheet lands.

## Portraits

- 512×512, bust, three-quarter view, dark-brown ink and cel-shadow families
  (shipped softer than the two-tone brief; see the class contract above), flat
  parchment background `#f4e9d8`.
- Generated from the character's reference sheet so sprite and portrait match.
- The 17 portraits (10 heroes, 7 speakers) are the first real art: consistency is per image, so they are the cheapest way to find the style.

## Workflow

1. **Reference sheet per character.** One 2048×2048 image: front three-quarter, side, back, face close-up, colour swatches with hex values from the palette table. This is the single source of truth for that character.
2. **Poses from the sheet.** Generate each pose with the reference sheet as the image reference (character-consistency features, image-to-image), one clip at a time. Regenerate rather than retouch; a retouched frame drifts.
3. **Normalise.** `scripts/art/normalise.mjs` (Phase A2): key out the background (or `--key alpha` for transparent sources), trim, align the feet to the baseline, scale to frame size, pad the margins.
4. **Pack.** `scripts/art/pack.mjs` builds the atlas PNG and JSON per family (heroes of one element, one enemy faction, props).
5. **Validate.** `scripts/art/validate.mjs` and `validateContent` check every required clip, every frame name, atlas size and alpha edges.
6. **QA on device.** Load on the iPad with `?stats=1`, check the checklist below at 40 px and at max zoom.

## QA checklist

Every asset passes the shared list plus its class list before it is committed.

### Shared

- [ ] One grain: no visible square texels, nothing blurrier than the characters;
      outlines dark brown, one to two screen pixels, no black line or fringe; no
      photographic texture or lens effects
- [ ] Prompt text contains no franchise or character names
- [ ] Colours trace to the palette sources; spot-check the principal anchors
- [ ] One warm upper-left key is legible across the assembled scene
- [ ] No text, lettering, watermark or signature; no outside-franchise likeness,
      name or costume replica
- [ ] Grid-significant scenery geometry agrees with the authored guide
- [ ] Review at delivery size and intended game size, on both renderers where used

### Characters in play

- [ ] Same face, hair, build and costume across every pose of the character
- [ ] Hands have four fingers and one thumb; hidden digits have believable
      occlusion, and shoulder, thumb side, palm/back view and wrist rotation agree
- [ ] Fingers bend naturally, wrists meet forearms, and props meet the grip;
      inspect enlarged art as well as its game-size crop
- [ ] Dark-brown silhouette and interior lines read cleanly, with no black line
      or fringe
- [ ] Transparent gutters are clean: no floor, painted contact/cast shadow,
      background remnant or white fringe
- [ ] Feet are on the baseline within 2 px; head stays inside the frame
- [ ] Readable at 40 px and distinct from the other character of the element
- [ ] Nothing reads incorrectly when mirrored

### Scenery

- [ ] The map's own treatment is followed: Ba Dan village painted ramps and
      fine grain, crisp at the default camera; forest road and quarry ground in
      the flat DL-2 triples
- [ ] Ba Dan uprights: the alpha is the geometry's silhouette and the colour is the
      painting's, rim included, so the static view is the painting; no halo, no double
      outline
- [ ] With a tile-grid overlay, ground edges, eaves and ridges sit on the 2:1
      projection lines from the guide
- [ ] At 2× base scale, contact runs all round; open legs and see-through gaps
      remain open; edges are clean; steps land on their landing; solid pieces do
      not overlap
- [ ] Ba Dan village: light, cast shadow, contact and material joins are in the
      painting and agree with the guide geometry; nothing is drawn over them at runtime.
      Forest road and quarry: no painted cast or ground shadow; the renderer
      owns contact and cast (ADR 0071)

### Effects cels

- [ ] Flat fill plus one shadow and one highlight tone; no gradients, glows,
      blurry smoke, photographic texture or lens effects
- [ ] Thin dark-brown ink and clean alpha; no ground or cast shadow
- [ ] Consecutive cels keep a stable registration and scale envelope, remain
      inside their cells, and read at 64 px

### Illustrated cast art and portraits

- [ ] Face, hair, build, costume, signature cue and palette match the in-play sprite
- [ ] Hands pass the same anatomy and grip checks as character sprites
- [ ] Portrait is a centred three-quarter bust with crop room and a flat
      `#f4e9d8` field: no scenery, border, vignette or background texture
- [ ] Shading stays clean cel families, no softer than the shipped portraits;
      no black outline
- [ ] Portrait still reads at the turn-strip size

## Fonts

Decided in ADR 0005. The display face is **Shippori Mincho 700**, self-hosted
as the Latin-subset woff2 in `public/fonts/` (provenance and licence in the
README beside it) and applied through `--font-display` to `h1`, `h2` and
`.display` slots: the title, scene headings, a speaker's name plate, the
decider banner. `h3` and body text stay on the system stack. Zen Antique was
the runner-up, with the same brush-serif register but a single weight;
Cormorant reads European and Cinzel Roman, so neither fits the world.

## Effects and terrain (later phases)

- Bending effects combine hand-drawn-style animation cels with aimed strokes and sparse debris (ADRs 0004 and 0021). Four transparent sheets supply twelve four-cel clips; every current technique has an authored assignment in `src/content/bendingCels.ts`. Fire has curling tongues, water has crests and ribbons, ice has pointed facets, earth has broad stone shapes, metal has folded bands, and air keeps open transparent space between its streamlines. Source prompts and registration notes are in `docs/art/elemental-cels.md`.
- Ground combines the grid-driven material base with authored local regions and painted details (edges, stones, grass tufts, path wear), in the same ink and palette. Keep dynamic surfaces and effects above decorative ground art. Square grid seams should disappear in normal presentation; tactical overlays remain available. Review the bounded Ba Dan proof before extending the modular construction across the route.

## Open questions for the owner

- The shipped in-play sprites visibly use several stepped values per material.
  Should future replacement sprites match that observed range, or is there a
  narrower tone count the owner wants documented?
- The old rule asked for one thin pale rim light on every character. The
  shipped sprites do not carry it consistently. Keep it as a requirement for
  new sprites, or drop it?
- Portraits and the older illustrated action frames shipped softer than their
  two-tone brief and are recorded as a first pass. Is that softness the
  approved portrait standard, or should later portraits return to the brief?
- Which of the older illustrated frames, beyond the shipping dialogue
  portraits, are owner-approved identity references for future sprite work?
