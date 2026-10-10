# Ba Dan upright geometry (frozen)

The painting is cut into ground and uprights by the geometry of the village's scenery **as it stood when the painting
was made** (git `7925789c`, before the integration). Nothing here is read from the game's scene data any more, so
the scene can change (and it did, at the integration) without moving what the painting is split by.

- `scene.json`: one entry per old scenery piece, in the scene's draw order: `id`, the `file` it drew from
  (`sprites/`), its `sourceRect` in that file, its world rectangle (`x`, `y`, `width`, `height`), `flip`, `depth`
  (x and y; both backends sort by x + y), `footprint`, `fade` (`fadeWhenOccluding`) and `exterior`; and `walkable`, the
  cells of the map (`BA_DAN_VILLAGE`) a figure can stand on (not blocked, not water). `baDan.test.ts` holds the
  scene's footprints, depth keys and flags, and the map's cells, to these.
- `sprites/`: the fifteen WebP atlases those entries drew: the houses, tables, planters and bridge (`true-*.webp`), the
  dressing and wall atlases, the tree atlas and the backdrop atlas. Their silhouettes (the alpha, antialiased, from
  the geometry) are the uprights' alpha exactly; their colours are only a fallback for the parts of an upright another
  upright hides (`docs/art/ba-dan-scene.md`, "Split"). They were packed by `scripts/art/ba-dan-true-pieces.ts`,
  `ba-dan-trees-pack.ts` and `ba-dan-surround.ts` from `art/source/ba-dan-true/`, `art/source/ba-dan-restyle/` and
  `art/source/ba-dan-surround/`; those packers are retired (in git history at `7925789c`).

`regions.py render` lays these on the painting's grid (`scripts/art/ba-dan-regions/render-village.ts`).
