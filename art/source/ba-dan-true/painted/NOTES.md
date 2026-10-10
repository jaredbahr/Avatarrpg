# Painted v3 candidate notes

> **The four houses here are gone.** The round 3 house paintings (sheets A and B below) and the yard paintings made
> for them were replaced by the round 4 houses (`NOTES-houses.md`). What follows still describes the tables, planters and
> bridge (sheet C), which are as shipped; the house rows, sheets and prompts are history.

> **Shipped follow-up — 2026-10-09.** The silhouette and ground lines of every
> shipped piece are forced by the guide and covered by tests. Internal structure
> carries the drift measured below and was accepted as shipped: a visual overlay
> of guide edges on the four shipped house sources (no measured tolerance)
> showed ridges, eaves, corners, doors, windows, steps and plinths following the
> guide at viewing scale. Roof-tile course count and spacing are free surface
> paint, not structural guide geometry.

## Method

Built-in image editing was used once per complete sheet, with the v3 sheet as the immutable edit target and the fine masters as material/style references. Returned sheets were confirmed at 1536x1024. Each piece was cut at its JSON rectangle, assigned the supplied mask as binary alpha, transparent RGB was cleared, and a one-pixel dark-brown outline was painted inside the mask boundary. `sheet-compare.png` contains guide / new painting / old painted sheet columns at 1x for A, B, and C, followed by 3x eave and door crops.

No game, test, guide generator, or network operation was run.

## Verification and acceptance

The mask-forced outer silhouette drift is 0 px for every cut. The guide's audited long-axis slopes are retained by that silhouette: raster slope 0.4967 to 0.5040 (26.40 to 26.73 degrees), versus the exact analytic +/-0.5 (26.565 degrees). However, visual 50% overlay review shows that the image model did **not** preserve all internal structural edges to the requested <=1 px tolerance. Typical internal drift is approximately 2-6 px on A and B, with isolated roof-course/window/awning details approaching 8-10 px; C is generally 1-4 px. Therefore these are candidates, not accepted final geometry. A piece-by-piece edit pass is still required.

Per piece: `dwelling-4x3` 0 px silhouette / ~2-6 px internal; `merchant-house-4x3` 0 / ~3-8; `dwelling-4x4` 0 / ~2-6; `merchant-house-4x4` 0 / ~3-10; `merchant-display` 0 / ~1-3; `merchant-display-b` 0 / ~1-3; `merchant-display-c` 0 / ~1-4; `low-planter` 0 / ~1-3; `low-planter-1x2` 0 / ~1-3; `canal-bridge` 0 / ~1-4. Posts and steps remain readable, but A/B roof courses and shop-awning seams are the main rejection points. No text-like marks were intentionally added.

## Verbatim prompts

### Sheet A

Use case: style-transfer. Asset type: exact-geometry isometric game environment sprite candidate sheet, 1536x1024. Image 1 is the immutable edit target and exact geometry/layout guide. Images 2 and 3 are the current material, palette, crisp ink, brush-grain, and lighting references. Image 4 is the earlier softer repaint; retain its warm hand but improve crispness and specificity. Paint directly over Image 1 without moving, redrawing, simplifying, cropping, resizing, or deleting any guide structure. The two buildings must remain pixel-registered to Image 1: identical outer silhouette and identical ridge, eave, roof ribs/course lines, wall corners, timber beams, door, windows, shutters, posts, shop bay, awning, steps, plinth blocks, terrace, and prop positions. Left building: potter household. Warm fired-clay ribbed roof tiles with ridge tiles, course shadows, a few subtly replaced tiles; weathered cream plaster and brown timber framing; stone plinth and paved rear terrace with sparse moss in joints; plank door; dark lattice-window interiors; three distinct jars on east ledge, lidded jar on south ledge, lantern on its existing bracket. Right building: merchant household. Glazed desaturated teal-green roof tiles, cream plaster, brown framing, stone plinth and paved rear terrace with sparse moss; open dark shop bay with small goods/jars on shelves, timber counter, cloth awning exactly within guide geometry, rain barrel at front corner, bench on south ledge, lantern at existing bracket. Lighting: warm key from upper left. Viewer-facing roof planes warm and readable, bright ridge edge; left-facing gable wall lit; right-facing door wall in soft shade about 75%; clear darker band beneath eaves and contact occlusion. Style/medium: polished hand-painted tactical RPG sprite art, clean fine brushwork compatible with detailed characters at 3x, dark-brown 1 px-feeling outlines, crisp material separation, restrained saturation, no pure black. Constraints: preserve Image 1 canvas size and muted green background exactly. Change only surface painting inside the two existing silhouettes. No cast shadow outside silhouettes. All structural diagonal edges must remain on the exact +0.5/-0.5 projection of Image 1. Keep every post touching its plinth, all three stair treads discrete, props grounded on ledges. No added text, symbols, people, plants outside silhouette, floating objects, blur, airbrush, photographic texture, noise grain, chunky pixels, or colored halo.

### Sheet B

Use case: style-transfer. Asset type: exact-geometry isometric game sprite sheet, exactly 1536x1024. Image 1 is the immutable edit target; Images 2-3 are style/material references only. Paint directly over Image 1 while preserving its canvas, muted green background, silhouettes, and every structural line pixel-registered: ridge, eaves, tile ribs and courses, corners, beams, door/window openings, shutters, posts, awning, counter, steps, plinth blocks, paved terrace and all prop placements. Left is woodcutter dwelling: warm fired-clay tiles, weathered cream plaster, brown framing, stone, firewood stack, broom, blank name board. Right is merchant: desaturated teal glazed tiles, shop bay with small goods and cloth awning, stacked crates and blank hanging board. Warm upper-left key; bright ridge edge, lit gable, door wall at 75% shade, dark under-eave band, contact occlusion. Crisp fine hand-painted tactical RPG art, dark-brown fine outline, restrained saturation, subtle replaced tiles/rain streaks/moss. No pure black, no text-like marks, no cast shadows beyond silhouette, no extra objects, no blur/noise/airbrush. Absolutely do not alter projection: all tile-axis edges remain exact +0.5/-0.5; verticals vertical; three stair treads discrete; posts meet plinth.

### Sheet C

Use case: style-transfer. Asset type: exact-geometry isometric game prop sheet, exactly 1536x1024. Image 1 is immutable edit target/layout; Images 2-4 are material/brush references only. Paint directly over Image 1, retaining muted green background and pixel-registering every silhouette and structural edge exactly: table tops/legs/shelves, every basket/cloth/jar/sack/scale part, planter stones/soil mound, bridge stones/deck seams/beams/posts. First table: three woven baskets of red, green, yellow produce. Second: folded cloths, two upright cloth bolts, three distinct jars. Third: tied sacks and hanging balance scale. Planter one: flowering greens; turned planter: vegetables and herbs. Bridge: worn warm timber planks, crisp seams, mossy pale stone abutments. Warm upper-left key, contact occlusion, restrained saturation, crisp fine hand-painted tactical RPG art, dark-brown fine outlines, no pure black. Do not alter exact +0.5/-0.5 projection or verticals; nothing floats/melts. No cast shadow beyond silhouette, no extra objects, text, symbols, blur, noise grain, chunky pixels, or airbrush.
