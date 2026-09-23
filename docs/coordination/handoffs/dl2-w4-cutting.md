# Handoff: The Cutting folded into the quarry ground contract

Owner: Opus worker, 2026-09-23. Branch `claude/dl2-w4-cutting`, clone
`D:/AvatarRPG-work/dl2-w4-cutting`, based on `f1f2a08`. This is **DL-2 W4**
from `SUBSYSTEMS/dl2-ground-language-plan.md`. No art was generated.

## What changed

- `scripts/art/quarry-route-ground.ts`: The Cutting is re-keyed through the W3
  packer and the §3 table, reading its layout the way the gate does. The lane
  (`=`) is packed earth with one haul track per one-row lane (rows 4 and 7). The
  shoulders (`,`) are spoil with inked heaps of cut stone, and the ledges
  (`^`/`A`) are cut-stone block face. A heap is kept only if it fits wholly on
  plain spoil. Rubble diamonds are inked even on spoil of their own material.
- `scripts/art/quarry-village-material.ts`: `nearestHeap()` exposes the heap
  geometry `heapMark` already used. It computes the same values, so the Driller
  and gate plates are byte-identical.
- `public/art/maps/cutting-scene/{dirt-west,dirt-east,road,stone}.webp`
  repacked. `CUTTING_GROUND_REGIONS` moves only its `bytes` fields: 167,520 →
  125,588 B in total. Per-page deltas are in
  `docs/art/cutting-driller-ground-registration.md`.
- `scripts/art/quarry-route-ground.test.ts`: the Cutting now runs through every
  W3 assertion (rectangles, tone table, window span, tone band, ink on every
  rubble diamond, shipped bytes). A new test reads the lane and the shoulders
  cell by cell, so the road cannot silently merge back into its shoulders.

## Why not the literal command

Running the W3 packer unchanged paints `,` as earth, like the Driller's `.`.
The lane and its shoulders then became one earth plane with heaps on the road,
and the approved road vanished. The trial is in the evidence folder. A second
option was also tried and rejected: a limestone-paved lane over earth shoulders.
It kept the old values and warmth, but the pale lane merged with the pale
ledges, which lost the elevation read.

## Measured (route-tone probe, 1368x912, canvas / webgl)

The Cutting's frame mean moved from 170.3 / 170.6 to **155.5 / 155.8**. The gate
is 154.9 / 155.4 and the floor 155.6 / 156.0. The route band across the village,
forest, gate, floor and Cutting moved from 1.21x to **1.105x / 1.106x** on the
frame mean. On the authored-ground mean it moved from 1.251x / 1.237x to
**1.195x / 1.182x**. The bar is 1.3x. Every other board moved 0.00% on canvas.

## Open

- **Spoil warmth.** Behind the dialog scrim, frame 38's background is slightly
  _less_ saturated than before. §3 spoil `#a89880` is a desaturated warm
  grey-brown, and the Cutting shows more of it than the gate does. The
  cracked-grey stone register is gone, but a warmer Cutting needs a §3 spoil
  decision. That is the same nit W3 left for W5.
- The upright exterior rim and the shared quarry surround are unchanged scenery.
  They still read as the older painterly register beside the inked ground.
- `scripts/art/soften-quarry-dirt-join.ts` is now obsolete for both maps. If it
  is run, it breaks the byte pins.
