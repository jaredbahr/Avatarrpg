# Sheet: Lin Mei — `unit.earth.linmei`

|               |                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Palette**   | `earth` — base `#6f9e4c`, light `#a8c686`, dark `#456330`, accent `#e0e8b0`, ink `#1b1410`, key `#00ff00`                                                                                                                                  |
| **Reference** | `art/raw/reference/unit.earth.linmei.png` — the full-body figure; the image reference for every frame                                                                                                                                      |
| **Deliver**   | `art/raw/unit.earth.linmei/<clip>/<index>.png`, one 512×768 PNG per row of the pose table                                                                                                                                                  |
| **Ships as**  | `public/art/units/linmei.png` and `linmei.json`, 128×192 frames written by `art:pack`                                                                                                                                                      |
| **Manifest**  | `'unit.earth.linmei': { kind: 'sheet', atlas: 'art/units/linmei.json', pixelsPerTile: 128, footprint: { w: 1, h: 1 }, anchor: { x: 0.5, y: 0.85 }, facing: 'mirror', palette: 'earth', clips: { … } }` — `art:pack` prints the whole block |

## Who

A young woman with jaw-length black hair and a small topknot, green eyes, tan skin and a small confident smile. Slight and upright.

A cropped dark-green short-sleeved jacket with gold key-pattern trim over a pale grey-green undershirt. A brown sash knotted at the waist with long tails over a green gold-trimmed hip panel; loose olive-green trousers; cloth wraps at the wrists and ankles; dark flat shoes.

Calm to the point of unnerving; she never raises her voice.

## Signature

The topknot over jaw-length hair and the cropped jacket. She must not be mistaken for Bo: slight, upright, still.

## Poses

Eleven frames. `idle` and `cast` are required; a missing `walk`, `melee`,
`hit` or `ko` falls back down the table in ADR 0003, so generate those
four last and ship without them if they will not hold. Generate one clip at a
time, every frame with the reference figure as the image reference, and
regenerate a frame that drifts rather than retouching it. The two idle poses
differ only by the breath; the three cast poses must read as one motion in
sequence. Facing is screen-right in every frame: the game mirrors the sheet
for the other side.

| Frame         | Pose          | Prompt line (replaces `[POSE]`)                                                                                                                                                                   |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle/0.png`  | Idle A        | Standing ready: weight on the back foot, knees soft, hands open and ready at the sides, eyes on screen-right. Nothing at the hands.                                                               |
| `idle/1.png`  | Idle B        | Exactly the idle A pose with the chest lifted by one breath; nothing else moves.                                                                                                                  |
| `walk/0.png`  | Walk A        | Mid-stride contact pose: the near leg forward and planted, the far leg trailing, the arms counter-swinging.                                                                                       |
| `walk/1.png`  | Walk B        | The opposite contact pose: the far leg forward and planted, the near leg trailing, the arms swapped.                                                                                              |
| `cast/0.png`  | Cast wind-up  | Weight drawn back onto the rear foot, the torso coiled, three pebbles hanging in the air beside the raised rear hand.                                                                             |
| `cast/1.png`  | Cast release  | A lunge toward screen-right with the leading arm fully extended, the leading palm out flat and the pebbles gone from the hand, nothing else drawn, because the earth itself is added by the game. |
| `cast/2.png`  | Cast recover  | Settling back from the lunge, weight returning to centre, the leading hand dropping, the element gone.                                                                                            |
| `melee/0.png` | Melee wind-up | Wind-up for a palm strike: the rear hand drawn back beside the ribs, fingers up, the lead hand open and forward, weight on the back foot.                                                         |
| `melee/1.png` | Melee strike  | The strike landing: a flat palm driven toward screen-right with the rear hand, the body turned into it, the lead foot planted.                                                                    |
| `hit/0.png`   | Hit           | Recoiling away from screen-right: shoulders twisted back, eyes shut, one foot lifted off the ground, the arms thrown loose.                                                                       |
| `ko/0.png`    | KO            | Down on one knee with one hand on the ground and the head bowed; no wounds and no blood.                                                                                                          |
| `wave/0.png`  | Greeting A    | Relaxed standing stance, leading hand raised beside the head, open palm.                                                                                                                          |
| `wave/1.png`  | Greeting B    | Same planted feet and raised arm, hand tilted outward in a friendly wave.                                                                                                                         |

## Prompt

Copy the paragraph and replace `[POSE]` with the row’s prompt line. It
carries the style block, the frame rules and the palette itself so nothing
needs to be prepended.

```text
A young woman with jaw-length black hair and a small topknot, green eyes, tan skin and a small confident smile. Slight and upright. A cropped dark-green short-sleeved jacket with gold key-pattern trim over a pale grey-green undershirt. A brown sash knotted at the waist with long tails over a green gold-trimmed hip panel; loose olive-green trousers; cloth wraps at the wrists and ankles; dark flat shoes. [POSE] Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Full figure, head to feet, seen in three-quarter view from slightly above (about 30 degrees), facing screen-right. Portrait frame, 512×768: the figure fills about three quarters of the height, the feet rest on a line 85% of the way down, and there is clear space on every side. Flat, completely plain background of exactly #00ff00 (pure green) with no ground, no ground shadow, no cast shadow, no scenery and no texture. The character alone: no large effect, no swirl of the element, nothing floating round the figure; the element appears only as the small hint at the hand the pose names. No lettering and no asymmetric emblem, because the frame is mirrored for the other side. Colours: the earth palette for the sash, the trim and the element hint — base #6f9e4c, shadow #456330, highlight #a8c686, accent #e0e8b0; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Same character as the reference image in every frame: same face, hair, build and costume; only the pose changes.
```

## Negative prompt

```text
black outlines, tapered or sketchy lines, gradients, airbrushing, soft shading, painterly texture, photorealism, 3D render, background, ground, floor, horizon, shadow under the feet, cast shadow, scenery, vignette, border, frame, text, lettering, watermark, signature, logo, large effect, swirl, ribbon of fire or water round the body, floating rocks, leaves, sparks, dust cloud, second character, cropped feet, cropped head, tattoos or markings on the skin, any likeness of a known animated character, gore
```

## Commands

Save each pick as `art/raw/unit.earth.linmei/<clip>/<index>.png` (indices from 0,
no gaps), then:

```bash
npm run art:normalise -- --unit unit.earth.linmei
npm run art:pack -- --unit unit.earth.linmei
npm run art:validate
```

`art:normalise` keys the green out, trims, scales the whole unit by one
factor (the idle pose sets it), stands the feet on the baseline and pads to
128×192 under `art/normalised/unit.earth.linmei/`; look at those frames before
packing. Add `--key auto` if the generator could not hold the exact green,
and `--px 256` for a sharper sheet. `art:pack` writes the sheet and prints
the manifest entry to paste into `src/content/assets/manifest.ts`; set its
`palette` to `earth`. `art:validate` checks the files the
manifest names, and CI runs it.

## Check

Run the **Sheets** section of `checklist.md` before committing. For this
sheet in particular: The topknot over jaw-length hair and the cropped jacket. She must not be mistaken for Bo: slight, upright, still.
