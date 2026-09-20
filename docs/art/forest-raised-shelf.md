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
