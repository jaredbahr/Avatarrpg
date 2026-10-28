# ADR 0090: Ba Dan and the forest road's uprights at 1 art px per world px

**Status:** accepted, 2026-10-28 (owner: _"Re-cut to 1×"_, relayed by the coordinating session; issue #284)

Follows ADR 0088 (integer zoom) and ADR 0089 (the party at native G1). Changes an asset format (the delivery scale of Ba Dan's
painting and the forest road's uprights) and the maps family budget, so it is recorded here. The pipeline details are the
amendments of 2026-10-27 to ADR 0076 (Ba Dan's painting and budget), ADR 0085 (the region pipeline) and ADR 0087 (the forest
packer).

## Context

ADR 0076 shipped Ba Dan at 1.5 painting px per world px, the old camera's zoom, so a painting px was a screen px; CLAUDE.md
said not to downscale it. ADR 0085 and 0087 kept that scale for the G1 world and the forest's uprights by scaling the world-px
art up (EPX x2, then a 0.75 Lanczos). Under integer zoom (ADR 0088) art is sampled nearest only where one art px covers a whole
number of device px: 1.5 px art is crisp at N = 3 (the iPad) and smoothed at N = 2 (desktop and Surface at 1 dpr). The party
now ships at 1 px per world px (ADR 0089), so 1.5 px art no longer matches the characters' grain either.

## Decision

The owner chose **"Re-cut to 1×"** on 2026-10-28: Ba Dan's painting (ground and uprights) and the forest road's uprights ship at
1 art px per world px, crisp at every N and on the same pixel grain as the characters, at the cost of a little painted detail
(the 1.5 px copies were the 1 px art upscaled, so nothing the generator drew is lost; what goes is the upscale's extra
antialiasing).

- Ba Dan: `regions.py` `SCALE = 1`; six 1536 x 1024 regions cut from the G1 master; the frozen geometry unchanged in world px,
  rasterised at 1 px; the same 46 uprights, footprints, depth keys and flags. No PixelLab generation.
- Forest: `forest-g1-pack.ts` packs `pieces/uprights/` as drawn; `pieces/uprights-1.5x/` is removed.
- The maps family budget falls from 7.5 MiB to 6 MiB (it measures 5.48 MiB), so the freed space goes to the precache.

## Consequences

| measure                         | before              | after       |
| ------------------------------- | ------------------- | ----------- |
| `public/art/maps/ba-dan-scene`  | 3,605,650 B         | 2,174,672 B |
| `public/art/maps/forest-g1`     | 1,009,552 B         | 860,072 B   |
| maps family                     | 6.98 MiB            | 5.48 MiB    |
| Ba Dan decoded (ground + pages) | 67.2 MiB            | 29.7 MiB    |
| precache (at merge, with #296)  | about 23.5 of 25 MB | see the PR  |

- At N = 2 the share of 2 x 2 device-pixel blocks that are one colour (one art px each) in the Ba Dan slice rose from 9-29 % to
  86-100 % (paving, roof and canopy samples); the remainder is the lossy ground codec and the figures.
- CLAUDE.md's "do not downscale" rule is replaced: map art ships at 1 px per world px. A map that wants more detail draws it at
  1 px, rather than shipping a density that only some N sample crisply.
