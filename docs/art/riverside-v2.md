# Riverside illustration pass 2

Built-in OpenAI image generation produced the environment revision and Sura/Kaya
motion sheets. Project-bound outputs are `public/art/maps/ba_dan_riverside.webp`
and `public/art/units/riverside-{sura,kaya}.{png,json}`. The source atlases for
the existing combat poses remain unchanged.

## Environment prompt

Edit the previous riverside map, preserving every landmark, camera geometry,
bridge, river bank and path. Use hand-drawn animated-television environment design
with Hades-inspired graphic readability: confident brown ink contours, large
cel-shadow shapes, sculpted foliage masses, ochre sunlit paths, deep blue-green
shadows, terracotta roofs and angular stone. Keep the banyan, foreground tree,
tea house and bridge in their exact positions. No people, animals, text, UI,
grid, frame or vignette; no 3D rendering or photographic shading.

## Motion-sheet prompts

Use each existing hero atlas as the identity reference. Draw six full-body poses
on a 3-column, 2-row transparent sheet with equal cells and consistent scale.
Preserve Sura's brown skin, blue-grey robe with cream edges, dark wavy hair and
wrapped boots; preserve Kaya's high ponytail, rust-red martial tunic with gold
edges, dark trousers and wrapped boots. Match drawn cel shading and warm ink
contours, three-quarter camera facing right. Poses: left-foot contact, narrow
passing stance, right-foot contact, opposite passing stance, hand raised beside
head, hand tilted outward. No effects, floor, shadows, text or grid. Sura's
passing poses were revised using Kaya's layout as a pose reference to make the
wide/narrow stride alternation readable.

## Packing

The PNG sources are 1536×1024 with real alpha. After inspecting the six cells:

```sh
node --import tsx scripts/art/riverside-motion.ts sura <sura-motion.png>
node --import tsx scripts/art/riverside-motion.ts kaya <kaya-motion.png>
node --import tsx scripts/art/map.ts --map ba_dan_riverside --in <environment.png> --px 40 --quality 88
```

The motion packer preserves alpha, crops the grid cells, uses the existing idle
height as the common scale reference, aligns feet and combines the new poses
with existing idle/cast/KO frames. Each finished atlas has twelve 128×192 frames.
Runtime enlargement is anchored at the feet. Foreground silhouettes live in
`src/render/living/scenery.ts`; review them against this exact environment.
