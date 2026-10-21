# ADR 0083: Ba Dan: calm ground plates

**Status:** accepted, 2026-10-20

Amends ADR 0076 (Ba Dan is one continuous painting). The maps family budget (7.5 MiB) is unchanged; this step only makes it smaller.

## Context

With the village painted as one continuous picture, the ground carries as much fine detail as the characters and the objects, so the
eye has no resting place and the figures do not stand out. The owner approved a direction on 2026-10-20: keep the detail in the
characters and objects, tone the ground down so it reads as a calm backdrop. A trial on the canal crop (variant s1) picked the
treatment below.

## Decision

- `regions.py split` applies `quiet_ground` to the **ground plates only**: PIL `MedianFilter(QUIET_MEDIAN = 3)` on the full-resolution
  painting, then `ImageEnhance.Color(QUIET_SATURATION = 0.85)`, then `ImageEnhance.Contrast(QUIET_CONTRAST = 0.88)`. It is
  deterministic (no randomness; the contrast pivot is the painting's own mean grey).
- It runs on the raw painting **before** the edge fade, so the perimeter is still exactly the margin colour. The softened painting is
  written to `DIR/quiet.png`; `DIR/faded.png` stays the unsoftened one.
- The plates are cut from the softened painting in one piece, so the 2 px overlaps between neighbours are identical and there is
  no seam.
- **Uprights are excluded.** They are cut from the unsoftened (faded) painting, so a house, tree or prop a figure can walk behind keeps
  its crisp pixels and its silhouette, rim included. The soft ground underneath an upright's footprint is hidden by the upright, so
  no extra handling is needed there; the plate is softened under the footprint as well.
- The geometry, the upright set, `baDan.art.ts` and the scene flags are untouched.

## Consequences

- Plate bytes fall from 2,228,946 to 1,650,030 (-26%) at the same WebP quality, because the median and the lower contrast remove
  grain the encoder was spending on. The maps family gets smaller by about 0.55 MiB.
- Tests: `quiet_ground_calms_and_is_deterministic` and `split_softens_plates_and_not_uprights` hold the step; `regen.sh --check` still
  proves the shipped files follow from the tracked sources.
- Tuning the look is a change to the three constants and a `regen.sh`; the uprights do not move.
