# Sheet: Wen — `unit.non.wen`

|               |                                                                                                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `nonbender` — base `#9b7bb8`, light `#c3a8d8`, dark `#5f4677`, accent `#e9dcf5`, ink `#1b1410`, key `#00ff00`                                                                                                                          |
| **Reference** | `art/raw/reference/unit.non.wen.png` — the full-body figure; the image reference for every frame                                                                                                                                       |
| **Deliver**   | `art/raw/unit.non.wen/<clip>/<index>.png`, one 512×768 PNG per row of the pose table                                                                                                                                                   |
| **Ships as**  | `public/art/units/wen.png` and `wen.json`, 128×192 frames written by `art:pack`                                                                                                                                                        |
| **Manifest**  | `'unit.non.wen': { kind: 'sheet', atlas: 'art/units/wen.json', pixelsPerTile: 128, footprint: { w: 1, h: 1 }, anchor: { x: 0.5, y: 0.85 }, facing: 'mirror', palette: 'nonbender', clips: { … } }` — `art:pack` prints the whole block |

## Who

A stocky young engineer with short tousled blond hair, brass-rimmed goggles pushed up on the forehead, brown eyes, light skin and a wide grin.

A cropped open blue work jacket with the sleeves rolled, over a cream collarless shirt; brown leather harness straps across the chest; a wide brown belt with a brass buckle, pouches and a brown cloth tied at the hip; black cargo trousers with brown knee patches; brown buckled boots over grey socks. On the arm nearer the viewer, the same arm in every frame, a bulky riveted brass-and-iron gauntlet with a pale-blue glowing cell at the wrist; the other hand in a fingerless glove.

Busy; already thinking of the next problem.

## Signature

The goggles on the forehead and the gauntlet. Engineer, not soldier. Wen and Riko differ in build and colour: Wen stocky in blue and brass, Riko wiry in maroon.

## Poses

Eleven frames. `idle` and `cast` are required; a missing `walk`, `melee`,
`hit` or `ko` falls back down the table in ADR 0003, so generate those
four last and ship without them if they will not hold. Generate one clip at a
time, every frame with the reference figure as the image reference, and
regenerate a frame that drifts rather than retouching it. The two idle poses
differ only by the breath; the three cast poses must read as one motion in
sequence. Facing is screen-right in every frame: the game mirrors the sheet
for the other side.

| Frame         | Pose          | Prompt line (replaces `[POSE]`)                                                                                                                                                                                                |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `idle/0.png`  | Idle A        | Standing ready: weight on the back foot, knees soft, hands open and ready at the sides, eyes on screen-right. Nothing at the hands.                                                                                            |
| `idle/1.png`  | Idle B        | Exactly the idle A pose with the chest lifted by one breath; nothing else moves.                                                                                                                                               |
| `walk/0.png`  | Walk A        | Mid-stride contact pose: the near leg forward and planted, the far leg trailing, the arms counter-swinging.                                                                                                                    |
| `walk/1.png`  | Walk B        | The opposite contact pose: the far leg forward and planted, the near leg trailing, the arms swapped.                                                                                                                           |
| `cast/0.png`  | Cast wind-up  | Weight drawn back onto the rear foot, the torso coiled, the gauntlet arm drawn back with its cell lit, a single small spark at the wrist drawn as a flat white-and-gold star.                                                  |
| `cast/1.png`  | Cast release  | A lunge toward screen-right with the leading arm fully extended, the gauntlet as the leading hand with the fingers spread, one small spark at the cell, nothing else drawn, because the lightning itself is added by the game. |
| `cast/2.png`  | Cast recover  | Settling back from the lunge, weight returning to centre, the leading hand dropping.                                                                                                                                           |
| `melee/0.png` | Melee wind-up | Wind-up for a punch: the gauntlet drawn back to the hip, the other hand open and forward, weight on the back foot.                                                                                                             |
| `melee/1.png` | Melee strike  | The punch landing: the gauntlet driven straight toward screen-right, the body turned into it, the lead foot planted.                                                                                                           |
| `hit/0.png`   | Hit           | Recoiling away from screen-right: shoulders twisted back, eyes shut, one foot lifted off the ground, the arms thrown loose.                                                                                                    |
| `ko/0.png`    | KO            | Down on one knee with one hand on the ground and the head bowed; no wounds and no blood.                                                                                                                                       |
| `wave/0.png`  | Greeting A    | Relaxed standing stance, leading hand raised beside the head, open palm.                                                                                                                                                       |
| `wave/1.png`  | Greeting B    | Same planted feet and raised arm, hand tilted outward in a friendly wave.                                                                                                                                                      |

## Prompt

Copy the paragraph and replace `[POSE]` with the row’s prompt line. It
carries the style block, the frame rules and the palette itself so nothing
needs to be prepended.

```text
A stocky young engineer with short tousled blond hair, brass-rimmed goggles pushed up on the forehead, brown eyes, light skin and a wide grin. A cropped open blue work jacket with the sleeves rolled, over a cream collarless shirt; brown leather harness straps across the chest; a wide brown belt with a brass buckle, pouches and a brown cloth tied at the hip; black cargo trousers with brown knee patches; brown buckled boots over grey socks. On the arm nearer the viewer, the same arm in every frame, a bulky riveted brass-and-iron gauntlet with a pale-blue glowing cell at the wrist; the other hand in a fingerless glove. [POSE] Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Full figure, head to feet, seen in three-quarter view from slightly above (about 30 degrees), facing screen-right. Portrait frame, 512×768: the figure fills about three quarters of the height, the feet rest on a line 85% of the way down, and there is clear space on every side. Flat, completely plain background of exactly #00ff00 (pure green) with no ground, no ground shadow, no cast shadow, no scenery and no texture. The character alone: no large effect, no swirl of the element, nothing floating round the figure; the element appears only as the small hint at the hand the pose names. No lettering and no asymmetric emblem, because the frame is mirrored for the other side. Colours: the nonbender palette for the sash, the trim and the element hint — base #9b7bb8, shadow #5f4677, highlight #c3a8d8, accent #e9dcf5; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Same character as the reference image in every frame: same face, hair, build and costume; only the pose changes.
```

## Negative prompt

```text
black outlines, tapered or sketchy lines, gradients, airbrushing, soft shading, painterly texture, photorealism, 3D render, background, ground, floor, horizon, shadow under the feet, cast shadow, scenery, vignette, border, frame, text, lettering, watermark, signature, logo, large effect, swirl, ribbon of fire or water round the body, floating rocks, leaves, sparks, dust cloud, second character, cropped feet, cropped head, tattoos or markings on the skin, any likeness of a known animated character, gore
```

## Commands

Save each pick as `art/raw/unit.non.wen/<clip>/<index>.png` (indices from 0,
no gaps), then:

```bash
npm run art:normalise -- --unit unit.non.wen
npm run art:pack -- --unit unit.non.wen
npm run art:validate
```

`art:normalise` keys the green out, trims, scales the whole unit by one
factor (the idle pose sets it), stands the feet on the baseline and pads to
128×192 under `art/normalised/unit.non.wen/`; look at those frames before
packing. Add `--key auto` if the generator could not hold the exact green,
and `--px 256` for a sharper sheet. `art:pack` writes the sheet and prints
the manifest entry to paste into `src/content/assets/manifest.ts`; set its
`palette` to `nonbender`. `art:validate` checks the files the
manifest names, and CI runs it.

## Check

Run the **Sheets** section of `checklist.md` before committing. For this
sheet in particular: The goggles on the forehead and the gauntlet. Engineer, not soldier. Wen and Riko differ in build and colour: Wen stocky in blue and brass, Riko wiry in maroon.

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
