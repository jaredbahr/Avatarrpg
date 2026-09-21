# Forest road exterior apron

`public/art/maps/forest-scene/exterior-apron.webp` is the ground outside the
Forest Road board. Packed by `scripts/art/forest-exterior-apron.ts`, registered
last in `FOREST_ROAD_SCENE.ground`, checked by
`scripts/art/forest-exterior-apron.test.ts`.

## Why it exists

`FOREST_ROAD_SCENE` is a `partial` scene: the procedural board is off and the
authored plates own every playable pixel. Outside them the page showed through,
so the route ended on a hard diamond — the same defect the Ba Dan apron
(`ba-dan-exterior-apron.md`) fixed inside the village.

## What it does differently from the village apron

The village's own cells are procedural, so its apron paints
`TERRAIN_STYLES`' terrace colours outward. The forest's ground is authored
texture from a reviewed material sheet; a flat fill beside it would add exactly
the tone step the route is already criticised for. So the forest apron invents
no colour. For each point outside the rim it walks back into the board along the
outward normal and continues the pixels it finds there, compositing
`grass-north`, `grass-south` and `route-ground` in their own draw order.

Two consequences are deliberate:

- The road leaves the board instead of ending on it. The route is a stretch of a
  longer road, and rows 4 and 8 continue outward as road until the fade takes
  them.
- The pond, the raised shelf and the rubble are **not** sampled. They are objects
  standing on the ground, so their authored edges meet the apron's ground rather
  than being smeared outward. Where a ledge or the pond blocks the walk, it keeps
  going (up to 3.4 tiles) to the terrain those objects stand on.

The band is 2.5 logical tiles wide, opaque at the rim, faded out by 2.2 tiles,
with grain and recession ramping in from 0.35 tiles so the board's own edge is
not redrawn as a line.

## Known defect in this candidate

The grass packs feather to alpha 0 across their outermost ~0.2 tiles, which was
invisible while the page was behind them. With textured ground now outside the
rim, that feather reads as a pale hem just inside the rim on the grass faces.
The apron deliberately paints no playable pixel, so it cannot cover the hem as
written. `docs/coordination/handoffs/forest-road-apron.md` records the two
repairs considered; the band has to extend a short way inside and fill only
pixels that no ground plate already paints.
