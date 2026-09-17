# ADR 0016: Riverside ground contacts and picking

The riverside collision mask treated the banyan canopy as a solid obstacle,
blocking the painted western lane. Trace ground footprints instead: the tree's
trunk and stone planter remain solid, with a continuous lane around them.
The southern footpath and the lower eastern-bank lane also remain accessible.

Illustrated and procedural villagers now stand at the tile centre used by
navigation. Their shadows, depth ordering and bending origins move with that
ground contact. Previously feet were 0.36 tiles below the navigation point.

Interaction picking receives continuous world coordinates rather than floored
tiles. Tight bounds above NPC feet cover their visible bodies; Pebble uses its
painted body bounds. Nearby empty ground no longer triggers broad pet/tea
interaction radii. The tea button remains available. Shrine picking covers the
painted shrine, with the existing walk-up destination unchanged.

The four-frame riverside sheets play one full stride over two tiles, matching
the existing two-frame walk cadence. Their distance clock is not rounded again
to the twelve-fps action clock, avoiding uneven contact/passing-frame holds.
This does not add directional sprite artwork; north/south movement still uses
the existing side-facing sheets.

Regression coverage includes a loop around the western lane, water and planter
obstacles, zoom-independent ground coordinates, tight interaction bounds,
distance-based stride frames, and browser taps on the painted lane and Mira's
body. The painting itself is unchanged.
