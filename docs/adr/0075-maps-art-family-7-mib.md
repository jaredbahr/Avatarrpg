# ADR 0075: Raise the maps art family to 7 MiB

**Status:** accepted, 2026-10-08

Amends ADR 0003 for one family. Amends ADR 0073's consequence about the budget.

## Context

`scripts/check-asset-budget.mjs` gives every folder under `public/art` the same 4 MiB, except `units`,
which ADR 0035 and ADR 0051 gave 6.75 MiB, and audio, which has 4 MiB of its own.

`maps` is over 4 MiB and has been since the village's dressing pass (ADR 0073 said so: the budget "it
already exceeds"). Two things put it there, both on purpose:

- The village's pieces are painted at 1.5 times the world scale and drawn at 2/3, so the houses, the
  props and the boundary wall are crisp at the camera's 1.5 screen pixels per world pixel. A wall at
  1 px per world px read soft beside the houses, and the wall is three times the pixels it was.
- The scene carries three atlases (dressing, walls, trees) and two more pages for the ground (the
  ring's twelve apron bands and the south and east frame's one page), because `SCENE_IMAGE_CAP`
  (ADR 0072) bounds distinct images, not bytes.

The south and east frame (`exterior-frame.webp`, 0.30 MiB) and eight tree clumps along the near edges
(the trees' page 0.44 MiB to 0.95 MiB, all of it fine leaf grain that only meets the fine-grain
contract at q97) add the last of it. Measured with `node scripts/check-asset-budget.mjs`:
**maps 6.78 MiB** after this work (the village folder 3.50 MiB of it), against 6.00 MiB (2.71) before it.

## Decision

`maps` gets **7 MiB**, as `units` has its own number. Every other family, and audio, keep 4 MiB; the
precache budget stays 25 MiB. The script keeps one table of per-family budgets so the next exception
is a reviewed line, not a new branch.

The precache total needs a build (`dist/`), which the script cannot size without one; the number is
checked by CI's `npm run build` and `node scripts/check-asset-budget.mjs`, not here.

## Consequences

- Ba Dan is allowed to be the proof that the village can be finished at this fidelity. No other map
  gets a larger share by this ADR: Forest Road (0.8 MiB) and the others are far under.
- The decoded size matters more than the bytes. The scene's pages decode to 12.6 MiB (trees),
  8.8 MiB (walls), 5.6 MiB (dressing) and 6.5 MiB (the frame) beside the ground plates; the page for the
  frame is packed to the smallest page its bands fit (`packTight`) and the trees' page likewise, so
  neither carries the waste a shelf-packed page does.
- Everything over 7 MiB still has to be justified as this was.
