# Ba Dan courtyard layers

Built-in OpenAI image generation, 18 September 2026. Exact prompts and generated
source filenames are in `ba-dan-scene-prompts.json`. Original roofed merchant
house, terracotta dwelling variant and village tree share warm upper-left light
and muted plaster/timber/roof materials. Sources are copied to ignored
`art/raw/scenes/`; shipped files live in `public/art/maps/ba-dan-scene/`, counting
against the existing maps family budget, not a new family.

The first whole-ground painting was rejected after viewing the actual game:
it displaced the pond and was too soft at the closer camera. The selected ground
uses a four-quadrant painted material atlas, packed against the real logical
rows by `scripts/art/ba-dan-ground.ts`. Two 1408 by 1536 textures share continuous
material coordinates at their seam. The material atlas is sampled at a finer
scale than the first candidate; no image enlargement supplies detail. Water
stays at x10–12, y6, with a narrow coping inside that footprint. The courtyard
spans x8–14, y4–10; surrounding slower ground remains visibly mossy.

Packing:

```sh
npx tsx scripts/art/ba-dan-ground.ts art/raw/scenes/ground-materials.png
npx tsx scripts/art/scene-image.ts art/raw/scenes/merchant-house.png public/art/maps/ba-dan-scene/merchant-house.webp
npx tsx scripts/art/scene-image.ts art/raw/scenes/dwelling.png public/art/maps/ba-dan-scene/dwelling.webp
npx tsx scripts/art/scene-image.ts art/raw/scenes/village-tree.png public/art/maps/ba-dan-scene/village-tree.webp
npx tsx scripts/art/scene-image.ts art/raw/scenes/pond.png public/art/maps/ba-dan-scene/pond.webp
```

Scenery packing trims alpha bounds and uniformly downsizes to 768 pixels wide.
Merchant output is 768 by 494, dwelling 768 by 495, tree 768 by 765. Their source
alpha is retained, including partial-alpha antialiasing. The old map encoder
forced alpha opaque; scene encoding now opts into retaining it. Legacy map
encoding stays opaque. Browser decoding verified clear corners for all three
scenery textures; a regression test distinguishes transparent and opaque output.

The pond is a separate 768 by 396 ground layer, registered to projected
(1216,512), 256 by 132 world pixels. The supplied geometric guide is preserved
as `ba-dan-pond-guide.svg`; it was rasterized without changing geometry for the
generator. Two earlier narrow-trough candidates failed registration and are not
shipped. The selected guide-only generation keeps the three-by-one footprint;
its low coping and recessed inner walls supply depth without a false obstacle.
`paintedWater` lets the renderer retain live surfaces/high contrast while showing
the painted permanent water at normal contrast.

`src/content/scenes/baDan.ts` records projected image rectangles, logical
footprints and foreground contact anchors. Four houses reuse two identities;
tree trunks occupy existing blocked boundary cells. Decorative baskets/pots sit
within the house visual footprint; none is an implied interactive game prop.

The source-house floor angles remain an approximation: source-art geometry and
footprint agreement must be assessed in the running scene, particularly around
doorways. Repeated materials and houses need full-scene review; asset tests do
not establish the approved visual target. See `scene-cohesion.md` for direct
baseline audit and motion/listening acceptance. No physical-device or listening
acceptance is claimed here.

A real exploration sequence was captured through ordinary `walkTo` commands,
with screenshots during movement and world-canvas video containing the actual
Web Audio master stream. Local artifacts are in `gallery/scene-audit/motion`.
It exposed follower overlap at turns and overly early whole-house fading;
gameplay owns those fixes. The 12.84-second recording has a nonzero signal and
no full-scale clipping (peak 0.346). This is technical evidence only. It does not
establish loudness, sound quality, mixing or synchronization by ear. Environmental
audio was absent at capture time; only existing event cues were available.

Output terms were checked earlier on 18 September 2026:
<https://openai.com/policies/row-terms-of-use/>. No exclusive copyright in
generated output is claimed. Existing generated-map credits cover these files.
