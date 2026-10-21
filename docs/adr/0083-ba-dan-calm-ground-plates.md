# ADR 0083: Ba Dan: calm ground plates

**Status:** accepted, 2026-10-20

Amends ADR 0076 (Ba Dan is one continuous painting). The maps family budget (7.5 MiB) is unchanged; this step only makes it smaller.

## Context

With the village painted as one continuous picture, the ground carries as much fine detail as the characters and the objects, so the
eye has no resting place and the figures do not stand out. The owner approved a direction on 2026-10-20: keep the detail in the
characters and objects, tone the ground down so it reads as a calm backdrop. A trial on the canal crop (variant s1) picked the
treatment below.

## Decision

- `regions.py split` applies `quiet_ground` to the **ground only**: PIL `MedianFilter(QUIET_MEDIAN = 3)` on the full-resolution
  painting, then `ImageEnhance.Color(QUIET_SATURATION = 0.85)`, then `ImageEnhance.Contrast(QUIET_CONTRAST = 0.88)`. It is
  deterministic (no randomness; the contrast pivot is the painting's own mean grey).
- **Ground means a pixel no geometry piece owns.** The plates carry the whole painting, but the uprights cover only what a figure can
  stand behind, so softening the whole plate also softened roofs, walls, the market stall, barrels, benches, planters, carts, fences and
  the 29 pieces left in the ground. `ground_weight` reads the frozen geometry's owner map (`village/ids.png`, the front-most piece at
  each pixel, upright or not) and `quiet_plates` blends `quiet_ground` into the painting by it: weight 1 on ground (grass, paving,
  paths, soil, banks, the canal water), 0 on every pixel a piece owns, so painted pieces keep the unsoftened painting exactly.
- The seam is feathered on the **ground side only**: ground pixels 1 and 2 px from a piece take 0.35 and 0.7 of the softening
  (`QUIET_FEATHER`). A piece pixel is never touched, so there is no halo of softened colour inside a piece and no hard step outside it.
- The canal water is ground and is calmed. The ripple highlights are drawn by the runtime, not baked into the plates, so they are
  unaffected.
- The step runs on the raw painting **before** the edge fade, so the perimeter is still exactly the margin colour. The softened
  painting is written to `DIR/quiet.png`; `DIR/faded.png` stays the unsoftened one.
- The plates are cut from the blended painting in one piece, so the 2 px overlaps between neighbours are identical and there is no seam.
- **Uprights are excluded** and are cut from the unsoftened (faded) painting as before. The geometry, the upright set, `baDan.art.ts`
  and the scene flags are untouched.

## Consequences

- Plate bytes: 2,228,946 before ADR 0083, 1,968,134 now (-12%). (A first version that softened the whole plate reached 1,650,030 but
  also flattened painted objects; the detail kept on pieces is what the extra bytes are.) The maps family stays well inside 7.5 MiB.
- Tests: `quiet_ground_calms_and_is_deterministic` and `split_softens_plates_and_not_uprights` hold the step, the second checking that
  every pixel of a piece (including the non-upright ones) equals the unsoftened painting, every ground pixel beyond the feather
  equals the softened one, and the feather never softens more than the ground does; `regen.sh --check` still proves the shipped files
  follow from the tracked sources.
- Tuning the look is a change to the constants and a `regen.sh`; the uprights do not move.

Repaint guides (`guide`, `current_painting`) still show the unsoftened stitched painting, so a future repaint is painted at
full detail and calmed again by this step; a guide does not look exactly like the shipped plates.
