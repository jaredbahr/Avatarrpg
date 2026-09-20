# Sheet: Kaya — `unit.fire.kaya`

|               |                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Palette**   | `fire` — base `#d1462f`, light `#f0785c`, dark `#8c2416`, accent `#ffb27a`, ink `#1b1410`, key `#00ff00`                                                                                                                             |
| **Reference** | `art/raw/reference/unit.fire.kaya.png` — the full-body figure; the image reference for every frame                                                                                                                                   |
| **Deliver**   | `art/raw/unit.fire.kaya/<clip>/<index>.png`, one 512×768 PNG per row of the pose table                                                                                                                                               |
| **Ships as**  | `public/art/units/kaya.png` and `kaya.json`, 128×192 frames written by `art:pack`                                                                                                                                                    |
| **Manifest**  | `'unit.fire.kaya': { kind: 'sheet', atlas: 'art/units/kaya.json', pixelsPerTile: 128, footprint: { w: 1, h: 1 }, anchor: { x: 0.5, y: 0.85 }, facing: 'mirror', palette: 'fire', clips: { … } }` — `art:pack` prints the whole block |

## Who

A young woman, lean and quick, with a high dark ponytail tied off in a red band and loose bangs falling either side of the brow. Warm tan skin, golden-brown eyes, a confident lopsided smirk.

A fitted dark-red jacket with a high collar, charcoal shoulder panels edged in gold and a row of gold frog clasps down the front, the long sleeves ending in dark leather bracers. A wide red sash at the waist with a small bronze disc buckle and two long trailing tails, over charcoal-black coat tails with gold-edged red panels. Loose black trousers tucked into dark boots bound with red bands.

Reckless confidence; she has already decided.

## Signature

The high ponytail and the red sash tails. She must read as fast even standing still. The two fire characters differ by hair: hers tied up, his swept back.

## Poses

Eleven frames. `idle` and `cast` are required; a missing `walk`, `melee`,
`hit` or `ko` falls back down the table in ADR 0003, so generate those
four last and ship without them if they will not hold. Generate one clip at a
time, every frame with the reference figure as the image reference, and
regenerate a frame that drifts rather than retouching it. The two idle poses
differ only by the breath; the three cast poses must read as one motion in
sequence. Facing is screen-right in every frame: the game mirrors the sheet
for the other side.

| Frame         | Pose          | Prompt line (replaces `[POSE]`)                                                                                                                                                 |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle/0.png`  | Idle A        | Standing ready: weight on the back foot, knees soft, hands open and ready at the sides, eyes on screen-right. Nothing at the hands.                                             |
| `idle/1.png`  | Idle B        | Exactly the idle A pose with the chest lifted by one breath; nothing else moves.                                                                                                |
| `walk/0.png`  | Walk A        | Mid-stride contact pose: the near leg forward and planted, the far leg trailing, the arms counter-swinging.                                                                     |
| `walk/1.png`  | Walk B        | The opposite contact pose: the far leg forward and planted, the near leg trailing, the arms swapped.                                                                            |
| `cast/0.png`  | Cast wind-up  | Weight drawn back onto the rear foot, the torso coiled, a small flame cupped in the rear hand, the sash tails and the ponytail trailing back.                                   |
| `cast/1.png`  | Cast release  | A lunge toward screen-right with the leading arm fully extended, a small flame leaving the open leading palm, nothing else drawn, because the fire itself is added by the game. |
| `cast/2.png`  | Cast recover  | Settling back from the lunge, weight returning to centre, the leading hand dropping, the element gone.                                                                          |
| `melee/0.png` | Melee wind-up | Wind-up for a strike: the rear fist drawn back to the hip, the lead hand open and forward, weight on the back foot.                                                             |
| `melee/1.png` | Melee strike  | The strike landing: a straight punch toward screen-right with the rear hand, the body turned into it, the lead foot planted.                                                    |
| `hit/0.png`   | Hit           | Recoiling away from screen-right: shoulders twisted back, eyes shut, one foot lifted off the ground, the arms thrown loose.                                                     |
| `ko/0.png`    | KO            | Down on one knee with one hand on the ground and the head bowed; no wounds and no blood.                                                                                        |
| `wave/0.png`  | Greeting A    | Relaxed standing stance, leading hand raised beside the head, open palm.                                                                                                        |
| `wave/1.png`  | Greeting B    | Same planted feet and raised arm, hand tilted outward in a friendly wave.                                                                                                       |

## Prompt

Copy the paragraph and replace `[POSE]` with the row’s prompt line. It
carries the style block, the frame rules and the palette itself so nothing
needs to be prepended.

```text
A young woman, lean and quick, with a high dark ponytail tied off in a red band and loose bangs falling either side of the brow. Warm tan skin, golden-brown eyes, a confident lopsided smirk. A fitted dark-red jacket with a high collar, charcoal shoulder panels edged in gold and a row of gold frog clasps down the front, the long sleeves ending in dark leather bracers. A wide red sash at the waist with a small bronze disc buckle and two long trailing tails, over charcoal-black coat tails with gold-edged red panels. Loose black trousers tucked into dark boots bound with red bands. [POSE] Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Full figure, head to feet, seen in three-quarter view from slightly above (about 30 degrees), facing screen-right. Portrait frame, 512×768: the figure fills about three quarters of the height, the feet rest on a line 85% of the way down, and there is clear space on every side. Flat, completely plain background of exactly #00ff00 (pure green) with no ground, no ground shadow, no cast shadow, no scenery and no texture. The character alone: no large effect, no swirl of the element, nothing floating round the figure; the element appears only as the small hint at the hand the pose names. No lettering and no asymmetric emblem, because the frame is mirrored for the other side. Colours: the fire palette for the sash, the trim and the element hint — base #d1462f, shadow #8c2416, highlight #f0785c, accent #ffb27a; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Same character as the reference image in every frame: same face, hair, build and costume; only the pose changes.
```

## Negative prompt

```text
black outlines, tapered or sketchy lines, gradients, airbrushing, soft shading, painterly texture, photorealism, 3D render, background, ground, floor, horizon, shadow under the feet, cast shadow, scenery, vignette, border, frame, text, lettering, watermark, signature, logo, large effect, swirl, ribbon of fire or water round the body, floating rocks, leaves, sparks, dust cloud, second character, cropped feet, cropped head, tattoos or markings on the skin, any likeness of a known animated character, gore
```

## Commands

Save each pick as `art/raw/unit.fire.kaya/<clip>/<index>.png` (indices from 0,
no gaps), then:

```bash
npm run art:normalise -- --unit unit.fire.kaya
npm run art:pack -- --unit unit.fire.kaya
npm run art:validate
```

`art:normalise` keys the green out, trims, scales the whole unit by one
factor (the idle pose sets it), stands the feet on the baseline and pads to
128×192 under `art/normalised/unit.fire.kaya/`; look at those frames before
packing. Add `--key auto` if the generator could not hold the exact green,
and `--px 256` for a sharper sheet. `art:pack` writes the sheet and prints
the manifest entry to paste into `src/content/assets/manifest.ts`; set its
`palette` to `fire`. `art:validate` checks the files the
manifest names, and CI runs it.

## Check

Run the **Sheets** section of `checklist.md` before committing. For this
sheet in particular: The high ponytail and the red sash tails. She must read as fast even standing still. The two fire characters differ by hair: hers tied up, his swept back.

## Optional north and south locomotion

For these frames, override the side-facing camera instruction above: south
faces directly toward the viewer, north shows the back with no face visible.
Keep the reference costume, physique, scale and foot line. Use transparent
alpha with no ground shadow. Preserve anatomical accessory placement; never
mirror these views. Generate a relaxed walk with modest arm counter-swing.

| Frame             | Pose                                                   |
| ----------------- | ------------------------------------------------------ |
| `idleNorth/0.png` | Neutral standing back view, feet level.                |
| `idleSouth/0.png` | Neutral standing front view, feet level.               |
| `walkNorth/0.png` | Back view, left foot contact.                          |
| `walkNorth/1.png` | Back view, right leg passing the supporting left leg.  |
| `walkNorth/2.png` | Back view, right foot contact.                         |
| `walkNorth/3.png` | Back view, left leg passing the supporting right leg.  |
| `walkSouth/0.png` | Front view, left foot contact.                         |
| `walkSouth/1.png` | Front view, right leg passing the supporting left leg. |
| `walkSouth/2.png` | Front view, right foot contact.                        |
| `walkSouth/3.png` | Front view, left leg passing the supporting right leg. |

These clips are optional. Existing action poses keep the side-view contract.
See `docs/art/directional-character-walks.md` for the hero grid importer.

## Optional exploration rest poses

These are optional exploration drawings; combat keeps its existing idle poses.
Only the Nima pilot currently supplies them. Preserve identity, body height and
foot baseline, with arms hanging naturally and feet near hip width.

| Frame             | Pose                                                |
| ----------------- | --------------------------------------------------- |
| `rest/0.png`      | Relaxed three-quarter view facing screen-right.     |
| `restNorth/0.png` | Relaxed three-quarter back view facing up-right.    |
| `restSouth/0.png` | Relaxed three-quarter front view facing down-right. |

See ADR 0025 for fallbacks and `docs/art/nima-rest-pilot.md` for pilot provenance.
