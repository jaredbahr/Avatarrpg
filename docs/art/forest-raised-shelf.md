# Forest eastern raised shelf

This bounded material pass replaces the gray procedural tops on the existing
forest-road elevation cells. It registers one transparent local image over the
two shallow authored shelf groups:

`(19,2) (18,3) (19,3)` and `(18,5) (19,5) (19,6)`.

The projected scene rectangle is `{ x: 1528, y: 664, width: 400, height: 208 }`.
The east exit at `(19,4)` is inside that rectangle but remains fully transparent
in the packed image. The map rows continue to own elevation, collision,
pathfinding and the exit; the image contains only top material and a low
south/east rim. Runtime surfaces and tactical overlays remain above it.

The final corrective candidate is preserved at
`assets/source/forest-raised-shelf/raised-shelf.png` (1254×1254 RGBA,
SHA256 `d5600c336f0e34bad28300088fa863d824b763a4bba2666f6869fc6b4a390792`),
with its corrective prompt in the same directory. The initial candidate remains
beside it for provenance. The built-in corrective ImageGen output is retained
at
`C:/Users/Jared/.codex/generated_images/01a0b7dd-d15a-72a2-8aa3-8fcbe01c8545/exec-efab72ae-5411-46be-bbcb-3408cdeaf3af.png`.
The deterministic packer clips color to the map-derived elevation mask and
writes `public/art/maps/forest-scene/raised-shelf.webp` at 400×208, WebP alpha
quality 84 (9,870 bytes):

```text
npx tsx scripts/art/forest-raised-shelf.ts assets/source/forest-raised-shelf/raised-shelf.png
```

The packer registers the two alpha components independently against their
matching projected L-shaped cell groups. It uses verified opaque interior
crops for complete top coverage and blends the component's opaque rim only on
the exposed edges, which prevents the neighboring gray elevation material from
showing through without smearing transparent edges. The existing
`assets/source/forest-material-v2/material-sheet.png` supplied the
forest's olive/ochre vocabulary. Quarry limestone was inspected as a style
reference only; no quarry asset is reused by the forest scene.

## Generated shelf and rubble heaps, shipped 3 October 2026

`raised-shelf.webp` and the three rubble heaps (`rubble.webp`, `rubble-1.webp`,
`rubble-2.webp`) are generated art, not packer output. Candidate A of the review
was accepted on 3 October 2026. The heaps are also drawn on the Cutting and the
Driller floor (`quarryProjected.ts` reuses `rubbleHeap` from `forestRoad.ts`), so
they change there too.

- **Generator:** built-in image generation (output terms:
  https://openai.com/policies/row-terms-of-use/). No exclusive copyright in
  generated output is claimed.
- **Prompts, in summary:** the shelf as an old quarried limestone outcrop with
  broad warm top planes, darker away-facing faces, substantial edge stones,
  restrained moss-filled cracks and sparse base grass, keeping the canvas,
  tiers, projection and silhouette; three separated low, wide rubble-cover
  variants of five to eight large angular stones and one short dark timber each,
  lit from the upper left, with selective ink. Both asked for a transparent
  background and no ground plane, cast shadow, people or text.
- **Mechanical steps only:** generated alpha bounds were cropped, box-filtered
  down to the shipped alpha bounds, given the exact decoded alpha of the
  corresponding previous file, and encoded as lossy WebP at quality 88 with
  alpha. Candidate index N maps to `rubble` / `rubble-1` / `rubble-2` for
  N = 0, 1, 2 (confirmed by alpha). Registration is unchanged: shelf 400 x 336
  world pixels, heaps 384 x 128 plate pixels into 128 x 42.667 world boxes. No
  pixel was repainted.
- **Sizes:** 23,442 (shelf), 6,798 / 6,162 / 7,032 (rubble, rubble-1, rubble-2)
  bytes.
- **Tests:** `forest-raised-shelf.test.ts` and `forest-rubble.test.ts` pin each
  file's size and SHA-256, hold its decoded alpha to the packer's footprint, and
  run the raised-face and contact-shade checks on the shipped pixels. Both
  packers keep the registration and refuse to overwrite the generated files
  unless `FOREST_REPACK_PROCEDURAL=1` is set.
- **Source of record:** the review notes, prompts and process script were kept in
  `.review/ship/` on the working branch and are not shipped.
