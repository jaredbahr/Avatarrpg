# ADR 0120: Ground as data, one baker

**Status:** proposed, 2026-11-18. Stage 4 (the ground) of `docs/level-design.md` for Ba Dan, and the ground half of
its tool T3. Builds on ADR 0104 §3 (the ground packer), ADR 0093 (shadows on the world-pixel grid) and ADR 0119 (calm
ground, aprons, the region palette).

## Context

Every top-down board had its own baker, and what its ground said (where people walk, what changed the ground at a
door, where weeds grow) lived as code in it: Ba Dan's worn paths were a list of cells in its dressing plan, RG-02's a
list of rectangles in its config, and nothing kept an object off a path. The level-design guide asks for the ground
to be one shared map that the painter and the placer both read (core G1), with desire lines and aprons as data
(§9: validators 6 `desireLinesClear` and 10 `aprons`).

## Decision

- **A board's ground is data** (`GroundSpec`, `src/content/ground.ts`), in the map's scene module
  (`src/content/scenes/<map>.ground.ts`):
  - its **classes**, each with the plain tile of an existing set it is drawn from, what the rules read it as, how
    calm it is and how it is graded;
  - which class each **row character** lies on, and which characters the rows **build exactly** (a dug canal with a
    kerb, a terrace with a cut face and steps, a plinth); a built piece the rows cannot tell apart (a causeway) is a
    **structure** on a box of cells;
  - its **tracks**: named polylines (or a disk, or a ring) with a width in cells and a wear of 1 to 3, optionally
    rutted;
  - its **aprons**: a centre and radius, or a rectangle, with a kind (`packed`, `wet`, `damp`, `mud`, `chips`,
    `tilled`) and the anchor it belongs to;
  - its **growth** (where weeds grow), its **quiet** ground, its rim mouths, margins, the hillside's face and its
    region palette.
- **One classifier, one baker.** `GroundTerrain` classes every plate pixel: natural classes blend between 32 px
  vertices broken by value noise, with each cell's own class held round its centre (the rules win); made shapes are
  drawn exactly on the cell lines. The validation reads it through `classify`. `groundBoard`
  (`scripts/art/topdown/boards/ground.ts`) bakes any spec: classes quilted and calmed, the hillside's and rim's faces,
  the made shapes with their kerbs, faces and casts, the tracks worn by wear, then the aprons, then the growth (never
  on a track or in quiet ground), then the palette lock. A new board is a spec and one `groundBoard` line.
- **The tracks are what placement keeps clear.** `src/content/groundChecks.ts` holds the two validators, report-only:
  `desireLinesClear` (no blocked cell or object footprint on a track; every door, anchor, slot and exit touches the
  network) and `apronReport` (which anchors stand on changed ground). A test pins each board's findings; they become
  gates once the owner has set the numbers.
- **Made edges may be straight** (core G8): the natural-edge check leaves out the pixels a board marks made
  (`Baked.made`), as it leaves out what objects cover.
- **Ba Dan is the first board** on it, as its ground alone: houses, walls, the table, the trough, the posts and the
  stone blocks are flat plinths until stage 5 places their set pieces. Its palette gains a dust ramp and the lawn's
  mid-tones, which the old bake never needed.
- **RG-02's and the Act I boards' bakers stay as they are** until a later migration; this change does not alter
  their baked output.

## Consequences

- Moving a track or an apron is a data edit and a re-bake; the placement checks see the move at once.
- A board's look is limited to what the shared baker can draw. A board that needs something new adds it to the
  baker for every board, rather than forking a baker.
- The validators report only. Their numbers are owner decisions.
