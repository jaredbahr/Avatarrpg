# Ba Dan village variety: generation record

Provenance for the lit repaints and native trees that remain shipped from these masters
(the dwelling and the alder for Forest Road, the four trees for the village). Built-in image
generation, painter's notes verbatim below. The household, stall, planter and bridge candidates
described in them were replaced by the true pieces (`art/source/ba-dan-true/`) and their
masters and preparation scripts were removed; the notes are kept whole as the record.
The sections after "Visual comparison" that describe an integration plan were
superseded by the integration itself (see `docs/art/ba-dan-scene.md`).

---

# Ba Dan village variety candidates

These are review-only candidates. No shipped asset, generator, scene data, pin, or credit file was changed. The built-in image editor produced high-resolution working paintings; I conformed registered pieces to the master's exact canvas and copied the master's alpha byte-for-byte. The discarded raw working canvases are not retained.

## Visual comparison and acceptance notes

The target uses a warm upper-left key, distinctly cooler turned-away walls, deep but soft eave/awning occlusion, grouped foliage values, warm roof rims, and readable contact at every prop. The current captures confirm clone repetition and runtime scaling, especially `08-village-r3c1.png`.

At 3x I checked roof ridges and eaves, wall corners, door depth, post-to-ground and leg-to-top construction, basket/table contact, root contact, outline softness, alpha doubling, perspective, and text-like artifacts. The sheets show the actual conformed PNGs, not raw image-tool previews.

- `dwelling.png`: lighting/weather repaint; exact 602x388 master alpha. The doorway, turned wall, eave and pot contact are stronger. Sparse repair tiles, sill staining and plinth moss remain subordinate.
- `merchant-house.png`: lighting/weather repaint; exact 610x390 master alpha. Awning/shop interior and right wall are materially deeper; contact under wares is clearer.
- `merchant-display.png`: lighting/weather repaint; exact 452x284 master alpha. The tabletop and basket contact are improved, though this remains the least transformative A repaint.
- `low-planter.png`: lighting/weather repaint; exact 448x248 master alpha. Stone-face turn, soil/foliage contact and shaded moss read more clearly.
- `village-tree.png`: lighting/weather repaint; exact 750x732 master alpha. Upper-left grouping and underside separation are stronger. This file is still unsuitable as the sole runtime tree because scene code scales it to many widths.
- `canal-bridge.png`: lighting/weather repaint; exact 436x272 canvas with alpha trimmed to bounds `4,0,428,240` and foot row `239`. Rail/deck occlusion, worn tread edges and lower masonry staining are clearer.
- `dwelling-b.png`: same registered mass and alpha as dwelling; firewood, broom/bucket, bench, laundry, closed door and repaired tiles establish a different household.
- `merchant-house-b.png`: same registered mass and alpha as merchant house; rain barrel, laundry, pottery shelving, bench and changed frontage establish a different household.
- `merchant-display-b.png`: same registered mass and alpha as display; cloth bolts and pottery.
- `merchant-display-c.png`: same registered mass and alpha as display; vegetables, sacks and a hanging balance.
- `village-tree-large.png`: broad old shade tree, native 420x410.
- `village-tree-medium.png`: upright forked medium tree, native 320x312.
- `village-tree-small.png`: airy young tree, native 260x254.

Rejected: the direct 1536/1024 working canvases, because their canvas, alpha, and registration drifted; direct use would violate the pin contract. I also rejected treating three tree files as a complete no-scaling integration: current scene data uses widths 150, 160, 170, 230, 240, 250, 260, 280, 300, 320, 360, 380, 400 and 420. These three candidates cover only 260, 320 and 420 natively. The conformed candidates are useful for owner selection, but their interior construction was repainted by the image tool and should receive an integration-owner pixel review before shipping.

## Measured geometry

Coordinates are `x,y,width,height`; foot is the last opaque canvas row, zero-based.

| File                    |  Canvas | Opaque bounds | Foot |
| ----------------------- | ------: | ------------: | ---: |
| dwelling.png            | 602x388 |   1,2,601,386 |  387 |
| dwelling-b.png          | 602x388 |   1,2,601,386 |  387 |
| merchant-house.png      | 610x390 |   0,0,610,390 |  389 |
| merchant-house-b.png    | 610x390 |   0,0,610,390 |  389 |
| merchant-display.png    | 452x284 |   0,2,452,282 |  283 |
| merchant-display-b.png  | 452x284 |   0,2,452,282 |  283 |
| merchant-display-c.png  | 452x284 |   0,2,452,282 |  283 |
| low-planter.png         | 448x248 |   0,2,448,246 |  247 |
| village-tree.png        | 750x732 |   0,2,750,730 |  731 |
| village-tree-large.png  | 420x410 |  1,78,418,331 |  408 |
| village-tree-medium.png | 320x312 |  14,1,293,310 |  310 |
| village-tree-small.png  | 260x254 |  30,1,200,252 |  252 |
| canal-bridge.png        | 436x272 |   4,0,428,240 |  239 |

The registered B/C assets deliberately have identical alpha and foot rows to their A masters. The tree canvases use the existing 750:732 aspect rounded to native integer pixels; their art is bottom-aligned with one transparent row retained.

## Verbatim prompts

### dwelling.png

Use case: lighting-weather
Asset type: transparent modular game scenery repaint candidate
Primary request: Repaint the supplied dwelling master in place with convincing form lighting from an upper-left screen key. Keep the current fixed three-quarter perspective, construction, proportions, roof ridge diagonals, materials, warm palette family, and every object exactly registered. Make the down-left wall the lit side; make the down-right wall cooler and about 75 percent as bright. Add a soft shadow band directly beneath every eave, contact occlusion where pots, posts, steps and vines touch walls or plinth, a restrained warm rim on upper-left roof edges, and a distinctly darker believable open doorway interior. Add only sparse lived-in weathering: two or three subtly slipped or replaced roof tiles, faint rain streaks below one sill, shaded-side moss at the plinth, and plaster scuffing beside the door at hand height.
Style/medium: fine hand-painted game illustration at character grain, detail down to about one final screen pixel, soft dark-brown one-to-two-source-pixel outlines, painted tonal ramps, no visible square texels, crisp rather than blurry
Scene/backdrop: genuinely transparent background
Constraints: Preserve the exact source canvas aspect, silhouette, alpha boundary, footprint, plinth, foot line, mass, door and window arrangement, pots and vines. Change lighting and sparse weathering only. No ground shadow outside the silhouette. No edge doubling, no text-like marks, no perspective drift, no new objects, no watermark.

### A repaint prompt pattern for the other masters

The following text was used verbatim with the named subject substituted exactly as shown:

- `merchant-house.png`: “Repaint the supplied merchant-house master in place with convincing upper-left screen key lighting. Preserve its fixed three-quarter perspective and construction. The down-left wall is lit; the down-right wall is cooler and about 75 percent as bright. Add soft under-eave shadow bands, deep occlusion beneath the awning and where posts, wares, pots and vines touch, a restrained warm rim on upper-left roof edges, and a darker believable shop doorway interior. Add sparse specific wear: a few repaired roof tiles, faint sill rain streaks, shaded-side plinth moss, door-height plaster scuffs.”
- `merchant-display.png`: “Repaint the supplied merchant display in place under an upper-left screen key. Brighten upper-left awning planes and edges, cool and darken down-right-facing fabric and wood to roughly 75 percent, add strong but soft occlusion beneath the awning and tabletop, contact shadows under every basket and where posts and legs meet, and deepen gaps between wares. Add only a few believable scuffs and a small fabric repair.”
- `low-planter.png`: “Repaint the supplied low planter in place under an upper-left screen key. Light the upper-left stone and foliage planes, cool and darken down-right faces to roughly 75 percent, add soft contact occlusion between stone courses, under foliage, at stems, and where soil meets masonry. Add sparse shaded-side moss, one subtly replaced stone, and restrained water staining.”
- `village-tree.png`: “Repaint the supplied village tree in place with coherent upper-left screen key lighting. Make upper-left canopy clusters warm and brightest, turn down-right and underside foliage cooler and substantially darker, add believable branch-to-leaf occlusion, dimensional trunk ramps, and dark contact at the root base. Keep highlights grouped rather than noisy. Add sparse bark scars and a little shaded-root moss.”
- `canal-bridge.png`: “Repaint the supplied canal bridge in place with coherent upper-left screen key lighting. Brighten upper-left rail and stone planes, cool and darken down-right faces to roughly 75 percent, add soft occlusion beneath rails and deck, between stones, at post joints, and at every contact. Add sparse water staining on lower shaded masonry, a few worn tread edges, and one restrained repair.”

For each of those five prompts, the verbatim shared suffix was:
“Style/medium: fine hand-painted game illustration at character grain, one-screen-pixel detail, soft dark-brown outlines, painted tonal ramps, crisp and not blurry, no square texels
Scene/backdrop: genuinely transparent
Constraints: Preserve exact source aspect, silhouette, footprint, foot line, construction, fixed three-quarter perspective and palette family. No ground shadow beyond silhouette, no text, no watermark, no edge doubling, no perspective drift.”

### dwelling-b.png

Use case: precise-object-edit
Asset type: transparent modular game scenery variant
Primary request: Paint a visibly different household variant of the supplied dwelling while preserving its exact overall mass, wall footprint, plinth, foot line, fixed three-quarter perspective and roof construction. Keep the warm red roof family but add a small repaired patch of slightly different tiles. Within the existing wall frame, use a different door and window arrangement that remains structurally plausible. Replace the current repeated wall dressing with a grounded firewood stack, broom and bucket, a modest bench, and a short drying rack; every object must touch the wall or plinth and sit under correct upper-left lighting. Down-left wall lit, down-right wall cooler at about 75 percent; soft eave bands, deep doorway, contact occlusion, warm lit roof rim. Sparse rain streaks, shaded plinth moss and door scuffs.
Style/medium: fine hand-painted game illustration at character grain, one-screen-pixel detail, soft dark-brown outlines, painted tonal ramps, crisp, no square texels
Scene/backdrop: genuinely transparent
Constraints: Same canvas aspect, silhouette, footprint, plinth, foot line and overall mass as input. Posts reach ground, props never float, ridge diagonals unchanged. No exterior ground shadow, no text, no watermark, no edge doubling, no perspective drift.

### merchant-house-b.png

Use case: precise-object-edit
Asset type: transparent modular game scenery variant
Primary request: Paint a visibly different merchant household variant of the supplied merchant house while preserving its exact overall mass, wall footprint, plinth, foot line, fixed three-quarter perspective, roof and awning construction. Keep green roof palette family but add a restrained repaired tile patch. Within the frame, alter door and window placement plausibly and replace repeated wares with a rain barrel, folded laundry line, pottery shelf, bench and bucket; all grounded. Use upper-left key light: lit down-left wall, cooler down-right wall at about 75 percent, shadow bands under eaves and awning, deep shop interior, contact occlusion, warm roof-edge rim. Sparse sill streaks, shaded plinth moss and hand-height scuffs.
Style/medium: fine hand-painted game illustration at character grain, one-screen-pixel detail, soft dark-brown outlines, painted tonal ramps, crisp, no square texels
Scene/backdrop: genuinely transparent
Constraints: Same canvas aspect, silhouette, footprint, plinth, foot line and overall mass as input. Posts reach ground and roof planes meet at ridge. No exterior ground shadow, no text, no watermark, no edge doubling, no perspective drift.

### merchant-display-b.png

Use case: precise-object-edit
Asset type: transparent modular game scenery variant
Primary request: Replace the fruit display with a cloth-bolts-and-pottery merchant display while preserving the exact canopy mass, table footprint, foot line, post positions, fixed three-quarter perspective and palette relationship of the supplied master. Arrange distinct rolled cloth bolts securely on the tabletop and pottery resting on shelves or tabletop; table legs directly support the top and posts reach ground. Upper-left key light with bright awning upper-left planes, cooler down-right faces, deep under-awning and under-table occlusion, contact shadows under every item, sparse wood scuffs and one neat fabric repair.
Style/medium: fine hand-painted game illustration at character grain, one-screen-pixel detail, soft dark-brown outlines, painted tonal ramps, crisp, no square texels
Scene/backdrop: genuinely transparent
Constraints: Same canvas aspect, silhouette, table footprint, foot line and overall mass as input. Nothing floats. No exterior ground shadow, no fruit baskets, no text, no watermark, no edge doubling, no perspective drift.

### merchant-display-c.png

Use case: precise-object-edit
Asset type: transparent modular game scenery variant
Primary request: Replace the fruit display with a vegetable, sacks and hanging-scale merchant display while preserving the exact canopy mass, table footprint, foot line, post positions, fixed three-quarter perspective and palette relationship of the supplied master. Arrange varied vegetables in grounded baskets on the tabletop, closed and open sacks resting on the lower structure, and one simple hanging balance scale attached securely beneath the canopy. Table legs support the top and posts reach ground. Upper-left key light with bright awning upper-left planes, cooler down-right faces, deep under-awning and under-table occlusion, contact shadows, sparse wood scuffs and one neat fabric repair.
Style/medium: fine hand-painted game illustration at character grain, one-screen-pixel detail, soft dark-brown outlines, painted tonal ramps, crisp, no square texels
Scene/backdrop: genuinely transparent
Constraints: Same canvas aspect, silhouette, table footprint, foot line and overall mass as input. Nothing floats. No repeated identical fruit baskets, no text, no watermark, no exterior ground shadow, no edge doubling, no perspective drift.

### Tree prompts

- `village-tree-large.png`: “Using the supplied tree only as species, palette and painterly-style reference, paint a distinct broad old shade tree with a wide asymmetrical crown and thick low spreading branches. It must read as the largest village placement, not a scaled copy. Upper-left canopy clusters are warm and brightest; underside and down-right clusters are cooler and darker with deep branch occlusion. Give it an old furrowed trunk and broad roots that visibly sit on the foot line, with sparse bark scars and shaded-root moss.”
- `village-tree-medium.png`: “Using the supplied tree only as species, palette and painterly-style reference, paint a distinct medium village tree with an upright forked branching habit and an irregular oval crown, clearly different from the broad old tree and original. Upper-left foliage clusters are warm and brightest; underside and down-right foliage is cooler and darker, with branch-to-leaf occlusion. The trunk has a gentle opposing lean and grounded root flare at the foot line, with sparse bark scars and a touch of shaded moss.”
- `village-tree-small.png`: “Using the supplied tree only as species, palette and painterly-style reference, paint a distinct small young village tree with a slender single trunk, higher first fork, sparse airy crown and fewer foliage masses. It must read as genuinely younger, not a miniature old tree. Upper-left foliage is warm and brightest; underside and down-right foliage is cooler and darker. Give the trunk a modest rooted flare that sits exactly on the foot line, with only slight bark wear and shaded-root moss.”

Each tree used this verbatim suffix, with its native width:
“Style/medium: same fine hand-painted character-grain illustration, soft dark-brown outline, painted tonal ramps, crisp one-screen-pixel detail at [420/320/260] px width, no square texels
Scene/backdrop: genuinely transparent
Composition: centered, full tree and root tips visible
Constraints: same species family and saturation range as input; unique silhouette and trunk form; binary-clean alpha edge; no ground shadow outside silhouette, no text, no watermark, no floating roots.”

## Integration plan (not performed)

- `pins.json`: add provenance, dimensions, hashes and preparation notes for `dwelling-b`, `merchant-house-b`, `merchant-display-b`, `merchant-display-c`, and the three native tree keys; replace the six selected A hashes only if the owner accepts them.
- `scripts/art/ba-dan-restyle.ts`: add the new source keys and pack targets, preserve binary alpha and exact registered dimensions, and derive bridge front only from the selected bridge source.
- `src/content/scenes/baDan.ts`: extend `BA_DAN_TEXTURES` and scenery image unions. Suggested houses: keep `gao-house` on merchant A, use merchant B for `southeast-house`; keep `north-house` on dwelling A and use dwelling B for `southwest-house`. Suggested displays: `gao-display` A, `north-market-display` B, `south-market-display` C.
- Trees: use large natively at `(0,10,size 420)`; medium at the two court trees `(5,5)` and `(21,2)` and selected 320 rim entries; small at `(1,0)`, `(22,0)`, `(0,15)`, and `(2,15)`, all size 260. This does not solve the other eleven authored widths; a true no-scaling integration needs native art for every retained width or a deliberate scene-size consolidation reviewed for occlusion.
- Credits: add the built-in OpenAI image-generation provenance and the final selected prompts/hashes; retain existing source provenance.

---

## Second round: sapling and second planter

Built with the built-in image tool, same hand-off as above; `low-planter-b` shares `low-planter`'s canvas and alpha exactly, `sapling-village-tree` is a 150x165 native tree (binary alpha, foot row 164). Painter's notes verbatim:

Built with the built-in image tool. These are review candidates only; no shipped file was changed.

## `sapling-village-tree.png`

- Canvas: 150 × 165 px RGBA PNG.
- Opaque bounds (inclusive, zero-based): `(25, 0)`–`(123, 164)`.
- Foot row: `164` (the final canvas row).
- Method: generated from the three native tree masters as style/species references. The first draft was rejected as too mature. The selected second pass used that draft as an edit reference, then was cropped to meaningful alpha, scaled into the native canvas with its base bottom-aligned, thresholded to binary alpha, and had hidden RGB cleared.
- Validation: alpha values are binary only; 0 partially transparent pixels; 0 visible pure-black pixels; 0 colored-matte pixels under transparent alpha.

### Verbatim initial prompt (rejected draft)

```text
Use case: style-transfer
Asset type: native-size 2D game environment sprite candidate
Primary request: Paint one young village tree / tall shrub belonging to exactly the same species family and visual palette as the three reference tree sprites.
Input images: Images 1–3 are style, species, palette, outline-weight, detail-grain, and lighting references only; create a genuinely new youthful silhouette, not a resized or copied tree.
Scene/backdrop: genuinely transparent background, tight canvas around the plant.
Subject: a sapling about 150 pixels wide and 150–170 pixels tall at final native size; fewer and thinner warm-brown stems than the small reference; two or three clearly separated irregular leaf masses; a few restrained cream blossoms; visible branching and a compact root/ground base.
Style/medium: fine hand-painted 2D game sprite at the references' native grain, with crisp single-pixel-scale detail, organic painted ramps, no square texels, no blur.
Composition/framing: centered tight cutout with a distinct asymmetrical young silhouette; roots/base reach and sit on the last opaque row.
Lighting/mood: upper-left warm light, shaded undersides in deep green and warm dark brown.
Color palette: match the references' olive, moss, yellow-green highlight, ochre-brown wood, cream blossom palette.
Constraints: actual transparent PNG background; no partial transparency at sprite edges—binary alpha only; soft dark-brown outline matching reference weight; no pure-black pixels anywhere; no colored matte beneath transparent pixels; no shadow outside the plant; no text; no watermark.
Avoid: mature broad crown, thick old trunk, copy of the small tree, photorealism, 3D render, vector-flat shapes, blurry antialiasing, checkerboard background.
```

### Verbatim selected correction prompt

```text
Use case: precise-object-edit
Asset type: native-size 2D game environment sprite candidate
Primary request: Correct the shown tree into a genuinely young sapling / tall shrub. Make the wood dramatically thinner and younger: two slender stems rising from one compact ground base, no broad mature trunk, no massive roots. Reduce the foliage to exactly three clearly separated irregular leaf masses with open gaps and visible fine branching. Keep the same hand-painted species, warm olive/yellow-green/deep-green palette, tiny restrained cream blossoms, soft dark-brown outline, and upper-left lighting.
Composition/framing: narrow asymmetrical silhouette intended to finish at about 150 px wide and 150–170 px tall; tight genuine transparent canvas; base touches the last opaque row.
Constraints: transparent PNG; binary alpha only with no partial edge transparency; no pure-black pixels; no colored matte under transparent pixels; crisp native-scale painted grain, no blur, no square texels; no text or watermark.
Avoid: mature tree, thick trunk, wide umbrella crown, enlarged roots, copy of any sibling tree, photorealism, 3D rendering, vector-flat shapes, checkerboard background.
```

## `low-planter-b.png`

- Canvas: 448 × 248 px RGBA PNG, matching the master.
- Opaque bounds (inclusive, zero-based): `(0, 2)`–`(447, 247)`.
- Foot row: `247` (the final canvas row).
- Method: edited from `low-planter.png`, then scaled to the master's native canvas. The master's alpha channel was copied pixel-for-pixel over the new painting; hidden RGB was cleared. This preserves the original exterior silhouette exactly while retaining the new vegetable rows, contained stakes, and alternate weathering.
- Validation: 0 alpha-channel differences from `low-planter.png`; 0 visible pure-black pixels; 0 colored-matte pixels under transparent alpha.

### Verbatim prompt

```text
Use case: precise-object-edit
Asset type: native-size 2D game environment sprite candidate
Primary request: Create a second planting variant of the reference low stone planter on the same 448x248 canvas. Preserve the complete planter silhouette, position, perspective, masonry geometry, stone rim placement, and alpha footprint exactly. Change only the planting and surface weathering.
Input images: Image 1 is the edit target and absolute silhouette/alpha/perspective reference.
Subject: replace the flowering hedge with clearly readable rows of mixed village herbs and vegetables: leafy greens, scallion-like shoots, and a few small warm vegetable accents; add two or three slender wooden stakes joined as a tiny restrained trellis, entirely inside the existing opaque silhouette and never extending beyond it. Vary the stone weathering with different moss, lichen, and warm stains while preserving every block and joint.
Style/medium: fine hand-painted 2D game sprite at the character/environment grain, crisp native detail, painted color ramps, organic edges, no square texels and no blur.
Lighting/mood: same upper-left warm light and shaded lower-right faces as the reference.
Color palette: match the reference's warm cream sandstone, muted moss greens, deep foliage greens, ochre wood, and restrained vegetable colors.
Constraints: exact same 448x248 canvas; copy the source alpha channel exactly pixel-for-pixel; stone rim silhouette must not move; preserve perspective and outline weight; trellis remains within existing silhouette; no pure-black pixels anywhere; transparent pixels have no colored matte; no cast shadow outside existing alpha; no text or watermark.
Avoid: moving or reshaping masonry, taller silhouette, flowers as the main planting, photorealism, 3D render, vector-flat treatment, blur, checkerboard background.
```
