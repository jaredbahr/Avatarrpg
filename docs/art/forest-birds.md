# Forest birds

Six small birds burst out of the forest road's pines as the ambush opens and
cross over the board, away from their trees and out of frame (`FOREST_FLOCK`
in `src/content/scenes/forestRoad.ts`,
flown by `src/render/living/wind.ts`). They are presentation only: they come
from the render clock, never the core RNG, and they stay grounded under
Reduce motion. Both backends draw them.

The strip is one row of six 32-pixel flap frames: open, closing, folded,
opening. It is drawn at 20 scene pixels, about 0.85 of the G party's texel
density, so a bird reads as a songbird beside Kaya and not as a hawk.

## Provenance

- Generator: PixelLab Pro Flash object `5337a220-f0f7-475f-afa5-19c0d5953a2e`,
  32×32, high top-down, one direction. A 32-pixel crop of Kaya's G stance was
  the style reference (outline, shading and palette only).
- Prompt: "a small brown forest songbird (sparrow) in flight, wings spread
  wide, seen from above at a high three-quarter angle, warm brown and cream
  feathers, dark ink outline, painted pixel art"
- Animation: v3, six frames, "small bird flying away with big fast wingbeats:
  wings pull in narrow and fold down beside the body on the downstroke, then
  open wide again on the upstroke". The first try (a steady loop) barely moved
  its wings and was not used.
- Source: `assets/source/forest-birds/bird-flap.png`, SHA-256
  `fbb4e606241390297734fb6b6fb0386c7c8df3aa2a4f14e241ff97b368970a1d`
- Packed output: `public/art/maps/forest-scene/bird-flap.webp`, the same
  pixels, lossless.
- Lineup gate, 2026-09-28: composited at game scale over a forest road capture
  beside the G party (Kaya, Sura and Bo). The palette, ink weight, pitch and
  scale all sit with the party.
