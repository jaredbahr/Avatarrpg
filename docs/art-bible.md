# Art bible

The specification every generated asset is made against. It doubles as the
prompt sheet: an image generator gets the visual grammar from here, never a
franchise name. Original characters only, no canon names, no canon likenesses
or costume replicas; cultural motifs (a fur-trimmed parka, a wide straw hat) are
fine, a recognisable canon design is not. Check the tool's output licence
permits non-commercial use before generating anything that will be committed.

The technical shape of every asset is fixed by `docs/adr/0003-asset-contract.md`.
This document is about how it looks.

## The look in one paragraph

Flat cel shading with clean ink lines and painterly ground. Characters read as
two-tone: a base colour and one shadow tone per material, with a thin rim
light on the lit edge. Outlines are a uniform dark brown (`#1b1410`), never
black, never tapered. No gradients, no photographic texture, no lens effects.
Bending effects are shaped: fire as ribbons and licks, water as whips and
sheets, earth as slabs and shards, air as spirals and arcs. Everything must
survive being 40 pixels tall.

## Camera and frame

| Rule       | Value                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| View       | Three-quarter top-down, about 30° above horizontal, character facing screen-right                                                     |
| Frame      | One-tile unit: 128×192 px (1 tile wide, 1.5 tall). Boss: 256×192. Generate at 4× (512×768) and downscale                              |
| Baseline   | Feet on a line at 85% of frame height; the runtime stands that line 85% of the way down the tile, so the head overlaps the tile above |
| Background | Flat `#00ff00`, no ground shadow, no cast shadow. The game draws its own ground shadow under every unit                               |
| Facing     | One facing only. Enemies are mirrored, so no lettering or asymmetric emblems that would read wrong flipped                            |
| Margins    | At least 8 px of empty frame on every side after trim; effects that extend past the frame belong to the FX layer                      |

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
| Ink           | `#1b1410` | —         | Every outline                              |
| Gold          | `#d9a441` | `#f0c674` | UI accent; on a character only as a detail |

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

## Portraits

- 512×512, bust, three-quarter view, same ink and cel rules, flat parchment background `#f4e9d8`.
- Generated from the character's reference sheet so sprite and portrait match.
- The 17 portraits (10 heroes, 7 speakers) are the first real art: consistency is per image, so they are the cheapest way to find the style.

## Workflow

1. **Reference sheet per character.** One 2048×2048 image: front three-quarter, side, back, face close-up, colour swatches with hex values from the palette table. This is the single source of truth for that character.
2. **Poses from the sheet.** Generate each pose with the reference sheet as the image reference (character-consistency features, image-to-image), one clip at a time. Regenerate rather than retouch; a retouched frame drifts.
3. **Normalise.** `scripts/art/normalise.mjs` (Phase A2): key out the background, trim, align the feet to the baseline, scale to frame size, pad the margins.
4. **Pack.** `scripts/art/pack.mjs` builds the atlas PNG and JSON per family (heroes of one element, one enemy faction, props).
5. **Validate.** `scripts/art/validate.mjs` and `validateContent` check every required clip, every frame name, atlas size and alpha edges.
6. **QA on device.** Load on the iPad with `?stats=1`, check the checklist below at 40 px and at max zoom.

## QA checklist

Every asset passes all of these before it is committed.

- [ ] Same face, hair, build and costume across every pose of the character
- [ ] Outline weight uniform and brown, no black, no tapering
- [ ] Two tones per material plus rim light; no gradients, no texture
- [ ] Colours match the palette table (spot-check the base and shadow of each material)
- [ ] No ground shadow, no cast shadow, no background remnants, no white fringe
- [ ] Feet on the baseline within 2 px; head does not exceed the frame
- [ ] Readable at 40 px (downscale and look), distinct from the other character of the element
- [ ] No text, lettering, watermarks or signatures; nothing that reads wrong mirrored
- [ ] No canon likeness; prompt text contains no franchise or character names
- [ ] Portrait matches the sprite's colours and silhouette

## Fonts

Decided in ADR 0005. The display face is **Shippori Mincho 700**, self-hosted
as the Latin-subset woff2 in `public/fonts/` (provenance and licence in the
README beside it) and applied through `--font-display` to `h1`, `h2` and
`.display` slots: the title, scene headings, a speaker's name plate, the
decider banner. `h3` and body text stay on the system stack. Zen Antique was
the runner-up, with the same brush-serif register but a single weight;
Cormorant reads European and Cinzel Roman, so neither fits the world.

## Effects and terrain (later phases)

- Bending effects are particle recipes in code and data (ADR 0004). Optional per-element burst sheets (6 frames, 128×128) can layer on top in Phase C.
- The ground stays the procedural shader; painted terrain decals (edges, stones, grass tufts, path wear) are sprites layered over it in Phase C, drawn in the same ink and palette.
