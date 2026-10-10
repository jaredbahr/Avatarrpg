# Ba Dan painting pipeline

The village is one continuous painting: twelve accepted region paintings, stitched, then split by the
upright geometry into ground plates and uprights. This is how Ba Dan's shipped art is made. Sources are
tracked (`art/source/ba-dan-regions/`, its README), the chain to the shipped files is deterministic, and
`--check` proves it. Design and numbers: `docs/art/ba-dan-scene.md`.

Everything runs from the repository root. `regions.py` needs python 3 with PIL and numpy (no scipy); the render and the packer
need node with tsx. Do not run python with `-I`: that drops the user site-packages numpy lives in.

```sh
sh scripts/art/ba-dan-regions/regen.sh            # accepted regions -> shipped files
sh scripts/art/ba-dan-regions/regen.sh --check    # the same, then compare every byte with what is on disk
```

`BA_DAN_WORK` (default `.review/regions`, untracked) holds the intermediates: `village/` (the geometry on the grid),
`stitched.png`, `stitch-report.json`, `split/` (trimmed uprights, plates, `split-report.json`).

## Units

Painting pixels are world pixels times 1.5 (the scale the village is authored at, and the game's zoom: a painting pixel is a
screen pixel), measured from the pan box corner. A region is exactly 1536 x 1024 painting px, the size the image tool edits without
reframing. Region origins are multiples of 3 painting px so they sit on whole, even world px.

## Commands

```
python scripts/art/ba-dan-regions/regions.py [--out DIR] [--accepted DIR] plan       # regions.json
python scripts/art/ba-dan-regions/regions.py guide r1c1  # (or `all`) DIR/guides/r1c1/: the guide to repaint a region over
python scripts/art/ba-dan-regions/regions.py gate r1c1 candidate.png    # registration check, exit 1 on fail
python scripts/art/ba-dan-regions/regions.py accept r1c1 candidate.png [--prompt prompt.txt] [--force]
python scripts/art/ba-dan-regions/regions.py render      # the frozen geometry laid on the grid: DIR/village/
python scripts/art/ba-dan-regions/regions.py stitch      # DIR/stitched.png, stitch-report.json
python scripts/art/ba-dan-regions/regions.py split       # DIR/split/
node --import tsx scripts/art/ba-dan-regions/pack.ts [DIR] [--check]
```

- **plan** lays the grid over the pan box (default 3000 x 1600 world px from (-200, -100)) with at least 192 world px of overlap on
  every shared side. It is plain geometry; the other commands make it at the default if there is none.
- **render** (`render-village.ts`) lays the **frozen geometry** (`art/source/ba-dan-regions/geometry/`) on the grid, bilinear from the
  frozen sprites exactly as the game's art was sampled: `uprights.png`, `ids.png` (the front-most piece owning each pixel),
  `front.png`, `pieces/NNN.png` (each piece's own silhouette), `pieces.json` (rectangles, depth keys, footprints, fade flags, the
  map's walkable cells). The game's scene data is not read.
- **guide** writes `DIR/guides/<id>/`: `guide.png` (the painting the accepted regions make, `DIR/stitched.png`, rebuilt when a
  region is newer, with the frozen geometry's uprights over it), `ground.png` (that painting's pixels), `uprights.png` (RGBA),
  `mask.png` (the uprights' alpha), `carry.png` + `carry-mask.png` (accepted neighbours' pixels pasted into the guide),
  `ids.png` / `ids.json` (each owner's index, depth key, pixel count, box, sprite). Paint over `guide.png`, return exactly 1536 x 1024.
- **gate** refuses anything not 1536 x 1024 (exit 2). Otherwise: the edge-map shift of the whole frame (pass within 1 px) and of every
  mask blob over 4,000 px padded 24 px (within 2 px), searched over -40..40; a frame correlation under 0.15 is "not this region", a blob
  under 0.05 is "lost". Inside the carry mask it reports the colour difference from the carried pixels and a seam score per overlap
  (warnings only). Writes `DIR/gates/<id>.json`; exit 1 on fail.
- **accept** runs the gate and, on pass (or `--force`), stores the painting at `accepted/<id>.png` with `<id>.json` (source path and hash,
  gate numbers, prompt, whether forced).
- **stitch** joins a full grid of accepted regions row by row and then the rows (`stitch_seams`): each join finds the cheapest seam
  through the overlap (`owner_mask`: it keeps to where the two paintings agree and off the uprights), gives any place they painted
  differently, 500 px or more, whole to one side, and blends colour over about +-50 px and detail over about +-4 px (`merge_mask`).
  `stitch-report.json` lists each seam, its colour step, the disagreements given whole to one side (`forced`) and any that run
  from one region's own territory to the other's (`needsRepaint`: repaint those; none today), and, as before, every
  16 px cell of an overlap where the two paintings differ by more than `--threshold` (`disagreements`). Fewer than a full
  grid (a trial, a test) is cross-faded with a smoothstep feather; whatever is uncovered is the margin colour and is counted.
- **split** first fades the painting's outer edge into the margin colour (`edge_fade`: exactly the margin on the outer 12 painting px,
  then a ragged ramp reaching 72 to 144 painting px = 48 to 96 world px in, longest where the painting is already dark canopy or
  undergrowth; fixed seed, no scipy; saved as `DIR/faded.png`), then writes to `DIR/split/`: `uprights/NNN-<id>.png` (trimmed to what each draws), `plates/plate-NN.png`, and
  `split-report.json`. A piece is an upright only if a figure on a walkable cell can stand behind it (`Village.needed`); the
  others (29) are the ground only. Per sprite the alpha is the geometry's, unchanged; every pixel under it that the piece owns
  takes the painting's colour (rim included); a pixel under a piece that is ground takes the painting's; a pixel hidden by a front upright or
  beyond the painting comes from the old sprite, moved by the repaint's colour change measured on the sprite's own painted pixels
  (`hiddenFilledFromSprite`, `hiddenBehindFading`). The report also lists painting that straddles a silhouette edge (`straddles`) and the
  plates: `PLATE_GRID` 4 x 3, cuts on multiples of 3 painting px, each plate running `PLATE_OVERLAP` = 2 px into the next.
- **pack.ts** encodes the plates (opaque lossy WebP, `GROUND_QUALITY` 85) and the uprights (q90 with sharp YUV and an exact alpha
  plane, stepping up only to hold the fine-grain contract), packs the uprights into 2048-pixel pages, writes
  `public/art/maps/ba-dan-scene/ground-NN.webp`, `uprights-N.webp` and `src/content/scenes/baDan.art.ts` (prettier-formatted).
  `--check` packs again and compares every byte, and reports a stale file.

## Tests

`npx vitest run scripts/art/ba-dan-regions/ba-dan-regions.test.ts` (python cases in `test_regions.py`; the geometry's render is
cached under `.review/regions/test-work`): the plan; the stitch reproducing identical regions, ramping a colour step, keeping detail
and giving a different patch whole to one side; the hidden fill following a colour change; the split keeping the geometry's alpha
and painting exactly the pixels it owns; the plates covering and overlapping; the straddle report; the upright set equal to the
pieces a figure can stand behind; every shipped upright's alpha equal to its geometry's silhouette; the shipped plates joining without a
step; the fade (flat at the perimeter, bounded, ragged, deterministic) and the shipped plates' whole outer edge being the margin colour; the guide, gate and accept tools; and `regen.sh --check` (about a minute and a half: the shipped files are a pure function of the tracked sources).
`scripts/art/ba-dan-projection.test.ts` holds each shipped upright's ground lines within a degree of the 2:1 tile line, over the windows in
`art/source/ba-dan-true/pins*.json`; `src/content/scenes/baDan.test.ts` holds the scene data (counts, footprints and depth keys equal the
frozen geometry's, the plates covering the pan box, nothing drawn over the exit and the road mouths, the house sorting and the chimney smoke
points).
