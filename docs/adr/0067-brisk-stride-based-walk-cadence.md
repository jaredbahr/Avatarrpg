# ADR 0067: Brisk stride-based walk cadence

**Status:** Accepted  
**Date:** 2026-09-30

Amends ADR 0015, ADR 0050, ADR 0053 and ADR 0054 where they specify the old
280 ms travel pace, measured per-heading G travel, or a separate riverside
scale correction.

## Context

The measured-root cadence made some headings race through cels, while the
later 760/680 ms per-tile travel retune made traversal ponderous and legacy
four-way residents play at about two thirds of their authored rate. Jared chose
a brisk target on 2026-09-30: about half a second per exploration tile, with
combat slightly faster.

## Decision

- Exploration travels at 500 ms per tile and combat at 480 ms per tile, plus
  the existing bounded 120 ms acceleration/braking ramp.
- Every G walk loop represents 1.825 logical tiles. A 12-cel party loop is
  therefore 6.575 cels per tile: 13.15 cels/s in exploration and 13.70 cels/s
  in combat. This deliberately accepts some foot slide to keep travel brisk,
  headings consistent, and the authored cel sequence readable.
- Eight-cel G enemies use the same stride: 4.384 cels per tile and 9.13 cels/s
  at the combat pace, close to their authored 8.77 cels/s.
- Legacy four-way sheets advance 475 ms of clip per tile. At the 500 ms
  exploration pace their authored 4 fps walks play at 3.8 cels/s (0.95x).
- G leaders settle on the directional `idle` clip after walking. Directional
  `rest` remains sheet metadata, not the post-walk presentation contract.
- Reduced-motion footsteps retain the same normalized distance timing as a
  full walk, compressed inside the abbreviated movement duration.
- Riverside rendering consumes the animator's clip phase unchanged. Draw
  scale does not create a second gait clock.

## Consequences

Routes complete at the chosen brisk pace and party cadence no longer varies by
heading. The visual compromise is deliberate: exact planted-foot travel is
secondary to traversal pace, consistent stride, and recognizable authored
motion. Tests derive route budgets and cadence expectations from the timing and
stride constants so another retune changes one source of truth.
