# Driller 2x2 animation sheet

The approved Option 1 is a clean bronze quarry rig with white steam. The
committed 160×160 RGBA sources are the review output. The packer does not redraw,
recolour, resample, or trim them; each cel is mirrored to the screen-right
contract and surrounded by an 8 px transparent gutter.

## Source

- Generator: PixelLab `create_1_direction_object`, review object
  `bbbe457b-f24d-440b-a332-d025e602c877`, followed by `animate_object` v3 clips.
- Terms: https://pixellab.ai/termsofservice
- Sources: `media/art-sources/driller-2x2-v1/`
- Packer: `scripts/art/driller-2x2.ts`
- Output: lossless `public/art/units/driller.webp` and `public/art/units/driller.json`

Each source clip starts at frame 0 with the same unanimated base image and a
baked ground shadow. Only those stills have alpha as low as row 141. The game
draws its own contact treatment, so the packer drops source frame 0 of every
clip and renumbers source frames 1 onward from packed frame 0. The 32 retained
cells remain unrecoloured and unresampled in uniform 176×176 atlas cells.
The packer uses the repository's deterministic lossless WebP encoder; its
round-trip test compares every decoded RGBA byte with the packed image. The art
validator reads the RIFF chunks, recognises this page's `VP8L` lossless stream,
and therefore does not require lossy decoded-cel pins. WebP is supported by the
shared browser atlas loader and offline precache glob, while avoiding the RGBA
PNG's unnecessary storage overhead.

## Registration

The body and tracks span about x=13..142 (130 px) and the tracks end near y=138.
At 80 atlas pixels per tile, the 160 px frame is exactly 2×2 tiles and the
130 px track span is 1.625 tiles. Padding moves the source foot line from y=138
to y=146. The anchor is `(88/176, 146/176) = (0.5, 0.8295454545454546)`. With
square footprints enabled in A-6, `footprintFoot` puts that
point at `(x + 1, y + 1.5)`, the centre of the 2×2 block's front row.

## Packed-frame camera review

The supervisor reviewed every source frame against one camera. Each source faces
three-quarter front-left. Its packed horizontal mirror faces three-quarter
front-right and keeps the same pitch.

| Packed frame | Source frame | Packed facing             | Pitch     |
| ------------ | ------------ | ------------------------- | --------- |
| idle/0       | idle-1       | three-quarter front-right | unchanged |
| idle/1       | idle-2       | three-quarter front-right | unchanged |
| idle/2       | idle-3       | three-quarter front-right | unchanged |
| idle/3       | idle-4       | three-quarter front-right | unchanged |
| idle/4       | idle-5       | three-quarter front-right | unchanged |
| idle/5       | idle-6       | three-quarter front-right | unchanged |
| walk/0       | walk-1       | three-quarter front-right | unchanged |
| walk/1       | walk-2       | three-quarter front-right | unchanged |
| walk/2       | walk-3       | three-quarter front-right | unchanged |
| walk/3       | walk-4       | three-quarter front-right | unchanged |
| walk/4       | walk-5       | three-quarter front-right | unchanged |
| walk/5       | walk-6       | three-quarter front-right | unchanged |
| cast/0       | cast-1       | three-quarter front-right | unchanged |
| cast/1       | cast-2       | three-quarter front-right | unchanged |
| cast/2       | cast-3       | three-quarter front-right | unchanged |
| cast/3       | cast-4       | three-quarter front-right | unchanged |
| cast/4       | cast-5       | three-quarter front-right | unchanged |
| cast/5       | cast-6       | three-quarter front-right | unchanged |
| cast/6       | cast-7       | three-quarter front-right | unchanged |
| cast/7       | cast-8       | three-quarter front-right | unchanged |
| hit/0        | hit-1        | three-quarter front-right | unchanged |
| hit/1        | hit-2        | three-quarter front-right | unchanged |
| hit/2        | hit-3        | three-quarter front-right | unchanged |
| hit/3        | hit-4        | three-quarter front-right | unchanged |
| ko/0         | ko-1         | three-quarter front-right | unchanged |
| ko/1         | ko-2         | three-quarter front-right | unchanged |
| ko/2         | ko-3         | three-quarter front-right | unchanged |
| ko/3         | ko-4         | three-quarter front-right | unchanged |
| ko/4         | ko-5         | three-quarter front-right | unchanged |
| ko/5         | ko-6         | three-quarter front-right | unchanged |
| ko/6         | ko-7         | three-quarter front-right | unchanged |
| ko/7         | ko-8         | three-quarter front-right | unchanged |

The authored FX particles touch a cell edge in source `cast-5`, `cast-6`,
`cast-7`, and `hit-2` (packed `cast/4..6` and `hit/1`). They are intentionally
preserved. The new `unit.enemy.driller` manifest entry is dormant: no enemy
references this sheet until A-6 switches the Driller content and square-footprint
gate together.
