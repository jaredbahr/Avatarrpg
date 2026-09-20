# Forest flood-bank nest reeds

The forest road has one low, passable scenery prop at logical footprint `(6,9)`.
Its projected depth is `(6.10,9.08)`, with a 120 by 58 world-pixel registration
whose bottom edge meets the projected ground contact at `(576,512)`. It has no
wall, fade, collision, or ground disk.

## Provenance

- Source: `assets/source/forest-bank/old-nest-reeds.png`
- Source SHA-256: `3f805c7b1fb059e603c2c80bfd03a856dd36f59f48358b9c1632331fa7e95b51`
- Prompt: `assets/source/forest-bank/prompt.txt`
- Generated source: ImageGen, 2026-09-19
- Processing: `node --import tsx scripts/art/scene-image.ts assets/source/forest-bank/old-nest-reeds.png public/art/maps/forest-scene/old-nest-reeds.webp 512`
- Packed output: 512 by 247 transparent WebP; alpha-trimmed and uniformly scaled.

The source is preserved unchanged. The low-alpha red fringe pixels in the
generated source are transparent edge residue; no blanket color filtering was
applied. The packed output has no red pixels with alpha at least 128.
