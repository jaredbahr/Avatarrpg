# Style test: the shared courtyard layout

One layout for the 2D and the 3D version of the art-direction test, so the two can be compared on the
same ground. The 2D build cuts it from the shipped Ba Dan scene (`BA_DAN_VILLAGE`, `src/content/maps/village.ts`);
the 3D team should rebuild it cell for cell. Screenshot of the 2D version: `layout.jpg` (1366x1024).

## Grid and units

- Cell `(x, y)`, zero-based, in the shipped 24x16 village grid. `x` runs toward the screen's lower right,
  `y` toward its lower left. Cell (0,0) is the top corner of the whole board.
- **The courtyard is x 2..9, y 5..12: 8x8 cells.** Everything outside it is the rest of the village, which shows
  round the edges as scenery only. Nothing outside the court is walkable in the test.
- **Tile size: 64 world units** per cell side, in the game's own units (`TILE = 64`). One cell on the
  screen is a 2:1 diamond, 64 wide by 32 tall in world units. Figures are drawn upright, never skewed.
- Painting resolution: 1.5 painting pixels per world unit, so 96 painting pixels to a cell.
- Figure height: Bo is about 77 world units tall (1.2 cells at the party's oblique draw scale of 1.25).
  The target is about 1.2x that.

## Camera and light

- Fixed oblique 2:1 view (screen = `(x - y, (x + y) / 2) * 64`). It is the ground's own tilt: a flat cell
  is 2:1, and upright things are drawn face-on. No rotation, no pan, no zoom during play.
- Zoom: the exploration default, 96 screen px per cell width (`camera.fitExplore(96)`), a world scale of 1.5.
  A cell is 96x48 screen px. At 1366x1024 about 14 cells across are on screen.
- The camera is centred on the middle of the court, the point `(6.0, 9.0)` in cell-corner units (the
  corner shared by cells (5,8), (6,8), (5,9), (6,9)). That puts the whole 8x8 diamond on screen,
  with village showing beyond it.
- Light direction: **upper left** (`KEY_LIGHT_SCREEN = (-0.72, -0.69)`). Cast shadows fall toward the lower
  right; roof planes facing upper left are the lit ones. The painted ground and houses already carry it.

## What stands where (cells)

| Thing | Cells | Notes |
| --- | --- | --- |
| South-west house | footprint x 6..9, y 10..13 (4x4); court shows rows 10..12 | Timber-and-plaster, red clay tile roof, brick chimney at the north-west ridge. The door and its awning face east (+x). The plinth is stone. |
| House yard | the footprint's west tiles, x 6..7 | Chopping block and a timber rail; part of the house sprite. |
| Tree | trunk at (5, 5) | Large broadleaf oak on the canal's north bank. Its canopy reaches over (3..7, 3..5) on screen. |
| Fence | (1,5) and (2,5) | Low timber rail, along the north bank. (1,5) is just outside the court. |
| Bench | (3,5) and (4,5) | Timber, facing the canal. |
| Market table | (6,5) and (7,5) | Fruit baskets. |
| Canal | row y = 6, x 0..12 | Painted water with a dry-stone kerb. Ripples are the engine's own. |
| Plank bridge | (9, 6) | The only way across inside the court. |
| Stone path | rows y = 7 and y = 8, x 2..9, and (9,5), (9,9) | Flagstone road, the open ground for the target. |
| Garden plot | x 2..4, y 10..11 | Timber-edged vegetable beds. |
| Stall and baskets | stall (3,9) and (4,9); baskets (2,9) | Market stall with sacks and scales. |
| Stone lantern | (5, 11) | Beside the garden. |
| Grass lane | (5..8, 9), (5,10), (2..5,12) | Walkable lawn. |

Blocked in the shipped grid (and so in the test): the house footprint, the tree, the table, the bench, the
fence, the stall and baskets, the garden plot, the lantern, and the canal (bridge excepted).

## Characters and target

- **Bo (earthbender) spawns at (3, 7)**, on the path at the west end, facing east.
- **Practice target at (6, 7)**: a timber post with a bound-straw pad and a crossbar, 1.2 figures tall,
  standing on the stone path with the canal just behind it. Its foot is the cell centre.
- **Strike spots**, both on the path row y = 7 and 3 cells from the target:
  - from the west, `(3, 7)`: the throw goes toward the screen's lower right (heading `southEast`);
  - from the east, `(9, 7)`: it goes toward the upper left (heading `northWest`).
- Legal strike range is 2 to 5 cells from the target (the `rock_throw` range is 5).

## Top-down plan (north corner of the board at the top; x to the right, y down)

```
        x: 2   3   4   5   6   7   8   9
  y=5      F   b   b   T   t   t   .   =       F fence   b bench    T tree trunk   t market table
  y=6      ~   ~   ~   ~   ~   ~   ~   B       ~ canal   B plank bridge
  y=7      =   S   =   =   X   =   =   =       S Bo spawn (3,7)   X target (6,7)   = stone path
  y=8      =   =   =   =   =   =   =   =
  y=9      k   s   s   .   .   .   .   =       k baskets   s stall   . grass
  y=10     g   g   g   .   H   H   H   H       g garden plot   H house (rows 10..13)
  y=11     g   g   g   L   H   H   H   H       L stone lantern
  y=12     .   .   .   .   H   H   H   H
```

On the screen, the diamond's top corner is cell (2,5), its right corner (9,5), its bottom corner (9,12)
and its left corner (2,12). The house is the lower-right of the diamond, the tree the upper right, the canal
runs from the upper left to the right across the middle.

## Light, shadows and ambience in this version

- Bo and the target cast the game's runtime shadow (a contact pool under the feet plus a projected cast to
  the lower right), the same one the village's walkers have. The painted houses and trees carry their own.
- Ambience is the village's: drifting motes, chimney smoke from the south-west house, leaves from the canopy,
  ripples on the canal.
- Strike effects: Bo's painted earth bend (`fx.earth.rock`), the rock, the dust where it lands, the bend's own
  hit-stop, a board kick and the target's recoil.
