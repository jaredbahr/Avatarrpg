# Quarry rear loading strip

One original transparent illustration adds a closed rail-loading stub to the
raised, inaccessible quarry rear. Two worn iron rails, sleepers and fixed end
buffers sit on a shallow stone shelf, with integrated limestone offcuts and
timber cribbing along its rear edge. There is no cart, machine, tall hoist,
opening, stair or interactive prop. The palette follows the current quarry
surround and approved player-view reference.

The original source is tracked at `assets/reference/quarry-loading/source.png`.
[Exact prompt and provenance](quarry-loading-source.json) record the single
built-in generation, source hash and inspected references. The references were
visually inspected, not supplied as tool input images. No further generation
or pixel painting was used. This is original project art covered by the existing
`art/maps/driller-floor-scene` credit in `src/content/credits.ts` and `NOTICE.md`.
Output terms: https://openai.com/policies/row-terms-of-use/. No exclusive copyright
in generated output is claimed.

## Packing

```text
node --import tsx scripts/art/quarry-loading.ts
```

The source is 1536×1024 RGBA with genuine alpha. The packer crops all nonzero
alpha to (0,17), 1512×1007, downsamples with the existing premultiplied box filter
and adds a four-pixel transparent gutter. It preserves the generated alpha and
all visible source content. The generated image's RGB in near-transparent pixels
looks like a glow in a raw preview; correct alpha compositing has clean edges.
It is not a reason to discard alpha or regenerate the art.

Output `public/art/maps/driller-floor-scene/rear-loading.webp` is 512×344,
40,086 bytes at quality 88, SHA-256
`bbc63553530385f31fa08631a448bf7b888fc89acffa747566c0ebf4db307ca0`.
Packed alpha bounds at threshold 8 are (11,15), 496×308; at threshold 128,
they are (12,16), 494×307. Transparent padding is part of the registered image.
The packer refuses output above 100 KiB. Source files stay outside `public` and
precache. No family or total budget change is needed.

## Registration ownership

The gameplay owner registers the image through existing `SceneScenery` fields
in `quarryProjected.ts`; the art task does not edit scene registration or maps.
Root approved a shallow exterior envelope at logical x14..19, y[-1,0], with
approximately 48 world pixels maximum relief and fixed background depth.
This is outside the playable board. Row 0 itself contains several elevations,
so the art must not flatten or cover those usable tops.

The packed front-bottom edge is approximately (16,92)..(459,319). Mapping that
edge to projected rear-border points (1664,448)..(1984,608) gives an initial
rectangle near x1652, y382, width370, height249. These are suggested calibration
measurements, not accepted runtime registration. Gameplay/root must verify
the actual shelf contact, background depth and actor visibility on both backends.
The strip must not imply passage across the rear border. The rear gap, existing
machine and playable highlights remain authoritative.

Root accepted the correctly composited source direction. Repacking reproduces
the same output hash; full verify passes 843 tests in 102 files. Art validation,
build and asset/bundle budgets pass. Maps total 4,058,450 bytes, leaving 135,854
bytes under 4 MiB; precache is 17.47 MiB under 25 MiB. The added precache entry
leaves production JavaScript at 306,909 gzip bytes, 291 bytes under 300 KiB,
before gameplay's registration. Combined integration must remeasure that cap.
