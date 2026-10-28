# Grounding fault list (ADR 0093)

Every thing standing on the ground that floated, slid or was mis-lit, one number each, with what was done and the crop
that shows it. Before is on the left, after on the right. The runtime half (figures and combat props) merged in #300;
this list is its painted and scenery half.

- `painted/NN-*.png`: the Ba Dan 1 px master at 3x nearest, `world-g1-polish.png` (before) and
  `world-g1-grounded.png` (after), made by `tools/painted_sheet.py`.
- `scene/*.png`: in game, Canvas, integer zoom 2, before on `main` at the #300 merge and after on this branch, made by
  `tools/scene_crops.py` from `e2e/grounding.review.ts`.
- `flagged/*.png`: not fixed, the master at 2-3x.
- `review/`: #300's runtime sheets (figures, props, walk strip).

## Ba Dan: painted objects (fixed)

Cause, for 1-22: `objects.py` and `props_set.py` cast each object by measuring every pixel's height from the object's
lowest row. An oblique piece's back legs, side base edges and top were cast as if they stood on its front foot, so the
shadow lay as a flat band below the front feet, often a few pixels off, and the piece hovered over it. `reshade` then
cut the bench's and fence's casts to stubs. Fix: `ba-dan-route-a/tools/shadows.py` lifts those shadows exactly (their
masks are deterministic) and casts each object from the lower hull of its own bottom edge, feet only where it reaches
its footprint, with a 1 px contact line where it meets the ground; regenerated through `regions_back.py` (gate passed
without `--force`) and `regen.sh`.

| #   | Object                                   | Was                                                                                               | Crop                                                       |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Fence by the canal (d13)                 | Stub casts beside the rails (`reshade`), nothing at the posts' feet                               | `painted/01-fence-2x1-d13.png`                             |
| 2   | Bench by the court tree (d12)            | Shadow a detached strip to the right; no contact under the legs                                   | `painted/02-bench-2x1-d12.png`                             |
| 3   | Gao's market table, its basket and crate | Cast a flat band below and left of the legs; no contact under legs, basket or crate               | `painted/03-gao-display-gao-display.png`                   |
| 4   | Banner pole (d3)                         | A flat dark band under the stone foot, no cast from the pole                                      | `painted/04-banner-pole-d3.png`                            |
| 5   | South baskets and barrel (d1)            | Faint, offset shadow                                                                              | `painted/05-baskets-south-d1.png`                          |
| 6   | South market table                       | Cast a band under the front legs, clear of the back ones; no contact under the sacks              | `painted/06-south-market-display-south-market-display.png` |
| 7   | Shop stack (d8)                          | Cast offset from the crates                                                                       | `painted/07-shop-stack-d8.png`                             |
| 8   | Stone lantern (d15)                      | Small offset cast                                                                                 | `painted/08-stone-lantern-d15.png`                         |
| 9   | Laundry line (d9)                        | One shadow bar unconnected to either post                                                         | `painted/09-laundry-line-d9.png`                           |
| 10  | North market table                       | Band under the front legs                                                                         | `painted/10-north-market-display-north-market-display.png` |
| 11  | North baskets (d2)                       | Offset shadow                                                                                     | `painted/11-baskets-north-d2.png`                          |
| 12  | West planter                             | Shadow a detached horizontal band                                                                 | `painted/12-low-planter-west-planter.png`                  |
| 13  | North garden planter                     | Same                                                                                              | `painted/13-low-planter-north-garden.png`                  |
| 14  | Notice board (d10)                       | Cast a band below the posts' feet, detached from them                                             | `painted/14-notice-board-d10.png`                          |
| 15  | Lantern post (d5)                        | A pool round the foot with the cast offset from it                                                | `painted/15-lantern-post-d5.png`                           |
| 16  | Village well (d0)                        | Little contact at the rim; a faint, offset cast                                                   | `painted/16-village-well-d0.png`                           |
| 17  | Lantern post (d6)                        | As 15                                                                                             | `painted/17-lantern-post-d6.png`                           |
| 18  | Handcart (d11)                           | Cast a flat band under the cart, offset from the wheel and the handles' tips                      | `painted/18-handcart-d11.png`                              |
| 19  | Banner pole (d4)                         | As 4                                                                                              | `painted/19-banner-pole-d4.png`                            |
| 20  | Lantern post (d7)                        | As 15                                                                                             | `painted/20-lantern-post-d7.png`                           |
| 21  | South-east planter                       | As 12                                                                                             | `painted/21-low-planter-1x2-southeast-planter.png`         |
| 22  | Trough and hay rack (d16)                | Offset casts                                                                                      | `painted/22-trough-hay-d16.png`                            |
| 23  | Barrel by Gao's door                     | No cast on the lit plinth (painted inside the house sprite; its outline authored in `shadows.py`) | `painted/23-gao-door-barrel.png`                           |

## Ba Dan: uncertain items

Every object in the village was looked at in the 1 px master at 1x (play zoom 1) and 3x.

| #   | Item                                               | What it is                                                                                                                                                                                              | Outcome                                                                                        | Crop                                       |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 24  | A flat beige square on the south-west house's roof | One stray tile, a single flat colour among weathered orange ones                                                                                                                                        | Fixed: given the roof's own tile colour (`shadows.py`)                                         | `painted/24-roof-tile.png`                 |
| 25  | "An unclear lump behind the south chimney"         | Not painted: a party member standing north of the house. Before #297 only their dark hair showed over the ridge beside the chimney; since #297's roof veil the whole figure shows faintly over the roof | Not a painting fault; see 34                                                                   | `scene/badan-market-corner.png` (top left) |
| 26  | "Blobby clusters on tables"                        | Gao's fruit baskets, the south table's sacks, bowls and scale, the north table's pots and jars                                                                                                          | Readable at play zoom 2 and 3 once the soft resampling of the 1.5 px art went (ADR 0090); kept | `painted/03`, `06`, `10`                   |
| 27  | Orange dome in the north house's yard              | A clay kiln with jars beside it                                                                                                                                                                         | Readable; kept                                                                                 | (master `1780,540`)                        |
| 28  | Lean-to by the south-west house's side door        | A woodshed: a chopping block with an axe and stacked logs                                                                                                                                               | Readable; kept                                                                                 | (master `720,660`)                         |

## Ba Dan: not fixed (flagged)

| #   | Item                                                                              | Why not                                                                                                                                                                                                                                                                                           | Crop                                  |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 29  | The two capped posts and the handcart in Gao's yard                               | Painted inside the house sprite among wood and stone of the same colours: no silhouette to cast or seat them by, and no outline plain enough to author (the barrel's was). Needs a region repaint (`regions.py guide` and gate)                                                                   | `flagged/gao-yard-posts-and-cart.png` |
| 30  | The court trees' bases (by the bench; the north-east one is under another canopy) | The frozen silhouettes run on below the painted roots over a strip of grass and path, so neither the silhouette's bottom nor the bark's colour says where a tree meets the ground; both deterministic attempts drew a contact streak along the path. Needs a root-foot inpaint, as `roots.py` did | `flagged/court-tree-5-5-base.png`     |
| 31  | The garden plot (d14)                                                             | Repainted whole by `garden.py`, so it carries no `objects.py` shadow to lift; its posts read as standing                                                                                                                                                                                          | `flagged/garden-plot-d14.png`         |

## Forest road: scenery (fixed)

Cause: scenery was cast from the bottom centre of its box, right for a tree (its canopy is not on the ground) and wrong
for anything whose base runs across its box at different heights. Fix: `castFrom: 'base'` (`SceneScenery`), the props'
grounded cast and contact line, feet only inside the footprint; on both backends.

| #   | Item                               | Was                                                                                 | Crop                                         |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| 32  | Keeper's lodge and its woodpile    | The house's shade fell under the fence on its left; the right-hand plinth had none  | `scene/forest-keeper-lodge-and-woodpile.png` |
| 33  | Split-rail fences and the signpost | Fences without contact, their casts off the posts; the signpost's cast a soft smear | `scene/forest-fences-and-signpost.png`       |
| 34  | Milestone                          | Cast detached below                                                                 | `scene/forest-milestone.png`                 |
| 35  | Quarry blocks on the tier-1 bank   | A gap between the blocks and their cast                                             | `scene/forest-quarry-blocks-on-the-bank.png` |

Checked, unchanged: the lantern post (its lamp hangs from an arm, so it keeps the foot projection;
`scene/forest-lantern-unchanged.png`), the pines and alders (foot projection, canopy off the ground), the bandits on
the bank and the perch (#300, `review/*/feet-forest.png`), the barrels, flask and hay bale (#300,
`review/*/props-forest.png`).

## Observed, not grounding

| #   | Item                                             | Note                                                                                                                                                                                                              |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 36  | Figures behind a Ba Dan house draw over its roof | Since #297 (the roof veil) a figure standing north of a house is drawn faintly over the roof; before, it was hidden behind it. This is item 25's "lump". A presentation choice for #297's owner, not changed here |
| 37  | Walk foot slide                                  | ADR 0067's pace; for Jared to decide (ADR 0093, `tools/walk_stride.py`)                                                                                                                                           |
