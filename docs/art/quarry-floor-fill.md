# Quarry floor fill (Gate, Cutting, Driller)

Shipped 2026-10-03. The walkable floor cells of the three quarry battle maps
carry one cracked-paving material, generated once for the Gate and reused for
the other two, so the three read as one place. Everything that is not a
floor-level walkable cell is unchanged.

## What changed

| Scene                 | Pages replaced                          | Bytes (was)                                                  |
| --------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `quarry-gate-scene`   | earth-west, earth-east, road, limestone | 40,864 / 41,264 / 16,010 / 36,966 (144,764 -> 135,104 total) |
| `cutting-scene`       | dirt-west, dirt-east, road, stone       | 18,340 / 18,166 / 25,874 / 61,940                            |
| `driller-floor-scene` | dirt-west, dirt-east, road, stone       | 29,084 / 26,446 / 2,798 / 67,486                             |

Page origins, sizes, alpha and the registered region tables are unchanged;
only the pixels and byte counts moved.

## Provenance

- Generator: an image model (the same generated-output terms as the rest of the
  quarry art, see `NOTICE.md`); no exclusive copyright in generated output is
  claimed. Date: 2026-10-03.
- Prompt summary: a worn, cracked, warm limestone-and-packed-earth paving in the
  art bible's quarry palette, painted at the board's oblique scale, with no
  figures, props, grid or lettering. Approved as "Gate floor B"; its four packed
  pieces were the donor material.
- Mechanical steps (nothing repainted by hand): the donor pieces are composed
  onto the 2304 x 1280 page; for each target map the floor-level walkable cells
  (the masks: the `.`, `=`, `,` cells, plus the Driller's oil `o` and shaft `m`
  cells; a 4 px inset keeps every cell edge, raised top, face and ink line out)
  are filled from donor blocks (lane blocks 5 x 2 cells, flag blocks 4 x 3), a
  block never reused within 5 cells; each cell's donor colour is then scaled by a
  per-channel gain so its mean luminance equals the mean the same class of cell
  (lane, flag, oil, shaft) carries in the page it replaces, the gain being
  interpolated bilinearly between neighbouring cell centres of one class so no
  step appears at a cell edge; a 3 px feather blends donor blocks of one class
  across their seams. Pixels outside the masks are byte-identical before encode
  (0 changed, alpha identical); the pages are then encoded lossy at quality 34
  with `exact=1`, like the pages they replace. The Gate's pages need no gain: its
  16 filled cells come straight from the same donor.
- Floor luminance on gallery captures (Surface, the beats `21a`/`21b`/`21c`):
  Cutting +0.2% (WebGL) / +0.4% (Canvas), Driller +0.4% / +0.5% against today's
  pages, so the raised-to-floor contrast is unchanged (Cutting 1.131 -> 1.129,
  Driller 0.994 -> 0.991 on WebGL). The Gate is +2.9% / +2.7%, as approved.

## Reproduction

`scripts/art/quarry-route-ground.ts` and `quarry-modular-ground.ts` still build
the underlying plates (ink, rims, faces, raised tops), and the tests that read
their output still hold. They cannot reproduce the shipped pages, which are those
plates with the generated floor filled in and re-encoded, so both packers are a
**dry run by default**: they build the plates, print the packer's byte count next
to the shipped file's, and write nothing (no pages, no registration file, no
`bytes` pins).

```bash
node --import tsx scripts/art/quarry-route-ground.ts cutting|driller   # dry run
node --import tsx scripts/art/quarry-modular-ground.ts                 # dry run
... --overwrite-shipped-art   # really writes; replaces the generated floors
```

Only pass `--overwrite-shipped-art` when deliberately replacing the generated
floors with plain packer plates (or after a new fill is composed), then re-pin
the hashes. The surround packer (`quarry-surround-pack.ts`) only verifies; it has
no write path.

The shipped pages are pinned by SHA-256 in `scripts/art/quarry-route-ground.test.ts`
(`SHIPPED_FLOOR_FILL`), and on-disk sizes by the region tables in
`src/content/scenes/quarryRouteGround.ts` and the gate pins in the same test. The
same test also decodes each shipped page and holds its footprint to the packer's
plate: alpha identical, and outside the floor masks (every walkable elevation-0
cell, 4 px inset) each whole cell within lossy-encode tolerance, so a fill that
paints a raised top, a face or ink fails even if its hash is re-pinned. Measured
bounds are in the test.

## Gate edge-ink re-encode

The first Gate encode of earth-west, earth-east and road left the fill's colour
under alpha 0, which bled across the lossy blocks into the 1-2 px ink pixels at
the plate's outer edge (253,236,224 for 27,20,16: 934 / 1,373 / 380 bright ink
pixels). The three pages were rebuilt mechanically: the previous shipped page's
RGB inside the floor masks (floor-level walkable cell, 4 px inset), the packer's
plate everywhere else, including the packer's RGB under alpha 0 and the whole
rim and ink ring, then re-encoded at quality 34 with `exact=1`. Bright ink is
now 0 and no 8 x 8 window exceeds the bound on any page; the pins in the test
carry no known-bleed allowance. Bytes: 42,362 -> 40,864, 43,016 -> 41,264,
19,502 -> 16,010. Limestone is unchanged.

## Known remaining

Small crisp green leaf-like specks appear over the Cutting on the WebGL path.
They are present in captures of the previous floors too, are not in any shipped
page, and were not changed here.
