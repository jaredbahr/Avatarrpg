# Painted dressing candidates

## Method

- Built-in image edit tool, full-sheet paint-over, using each `sheet-*.png` as the mandatory geometry target and the existing painted house/planter work as style reference.
- Generated sheets were saved at 1536x1024.
- Every named piece was cropped at the exact rectangle in the matching `sheet-*.json`.
- The alpha channel of every crop was then replaced byte-for-byte with the supplied `<name>-mask.png` alpha. This makes the supplied silhouette and all designed see-through gaps authoritative even where the painter changed pixels outside or across an opening.
- `sheet-compare.png` places each complete guide sheet beside its painted sheet at 1x. Its bottom strip contains 3x nearest-neighbour crops of the well, cart, and the plain/buttress wall pair.
- No game, tests, asset generators, or tracked files were run or changed.

## Verification

- Canvas: all four painted sheets are 1536x1024.
- Crop sizes: all 30 piece PNG dimensions match `pieces.json` / the sheet rectangles.
- Alpha: all 30 piece alpha planes exactly match their supplied masks. Therefore silhouette drift after masking is 0 px, and the intended gaps remain transparent.
- Ground contact: mask geometry preserves all post, leg, wheel, and shaft endpoints. The painted cart has round wheels on its guide ground line and shafts ending on the guide endpoints.
- Text: the notice-board papers are blank; no legible writing was introduced.

The full-sheet image edit did drift internally. The mask repairs silhouettes and gaps, but does not repair interior brush placement. Recorded drift:

- `sheet-a`: the well roof tiles, masonry joints, windlass details, notice papers, fence wood grain, produce, and stack contents differ from the flat guide inside the exact structure. The well retains its roof/posts/mouth and the fence rails remain open.
- `sheet-b`: garden crop positions and bean foliage are painterly reinterpretations; shelter log ends and roof boards differ; laundry folds and cloth widths vary internally; the cart load, wheel hubs/spokes, and shaft highlights drift inside the mask; bench board grain and trough water/hay detailing differ. The alpha mask preserves every designed opening, but the cart is the most structurally sensitive candidate and should receive a per-piece repaint if exact spoke/axle paint registration is required.
- `sheet-c`: individual rubble courses and capstone joints are repainted rather than traced. Outer profiles are exact after masking, but the interior masonry courses do not meet pixel-for-pixel across all plain/buttress module joins. This remains the principal tiling risk.
- `sheet-d`: planter foliage and blossoms drift within the soil openings; individual pier stone courses and cap wear differ. Corner/pier/planter silhouettes and openings are exact after masking.

These are candidates, not acceptance-ready production sprites where the requirement includes exact internal course continuity. Priority redo targets are `wall-x-2`, `wall-x-2-buttress`, `wall-y-2`, `wall-y-2-buttress`, and `handcart`, painted per piece against the guide.

## Verbatim prompts

### Sheet C

```text
Use case: precise-object-edit
Asset type: isometric game environment sprite sheet, exact 1536x1024 PNG
Primary request: Paint over Image 1, the wall guide sheet. Replace flat guide colors with finished hand-painted grey-cream fieldstone while preserving every module's exact geometry.
Input images: Image 1 is the mandatory edit target and geometry law; Image 2 is the exact house-art style reference; Image 3 is the matching stone-and-moss material reference.
Style/medium: polished hand-painted isometric game art, crisp fine brush grain, controlled soft dark-brown outlines, no pure black, matching Image 2.
Materials/textures: coursed irregular grey-cream rubble masonry with individual stones, warm cream capstones, restrained mortar, tiny chips and age, sparse moss only low on shaded lower-right faces, very sparse fine climbing vine accents. Top faces warmly lit.
Lighting/mood: warm key from upper-left on screen; lower-right faces in soft shade about 0.75; contact occlusion at capstones, joints, and buttress intersections.
Critical invariants: Preserve the 1536x1024 canvas. Keep the uniform muted green background unchanged. Keep all six modules in exactly their current positions, exact outer silhouettes, structural edges, cap profiles, buttress dimensions and perspective. Do not move, resize, rotate, round, thicken, thin, add, remove, merge, crop, or reinterpret any structure. Every silhouette edge must remain within 1 pixel of Image 1. Plain and buttress wall courses must be horizontally continuous at their module ends and tile seamlessly; align course heights and capstone joints at both ends. Paint only inside existing guide silhouettes. No ground shadows outside silhouettes.
Avoid: text, symbols, characters, objects, flowers at module seams, obvious repeating vine motif, noise grain, pixelation, blur, black outlines, background changes, cast shadows outside the sprites.
```

### Sheet D

```text
Use case: precise-object-edit
Asset type: isometric game environment sprite sheet, exact 1536x1024 PNG
Primary request: Paint over Image 1, the boundary-wall corner, pier, and terrace-planter guide sheet. Replace flat guide colors with finished art while preserving every object's exact geometry.
Input images: Image 1 is the mandatory edit target and geometry law; Image 2 fixes the finished grey-cream fieldstone treatment; Image 3 fixes the planter masonry, foliage, flower, outline, and grain treatment.
Style/medium: polished hand-painted isometric game art, crisp fine brush grain, soft dark-brown outlines, no pure black, same hand and saturation as the references.
Materials/textures: all corner and pier objects are coursed irregular grey-cream fieldstone with warm cream capstones, restrained mortar, tiny chips, sparse low moss on shaded lower-right faces. Metal finials are muted aged bronze. Terrace planters use the exact Image 3 character: cream block rims and sides, dark rich soil, dense flowering greens with small cream-white blossoms and a few warm yellow blossoms, controlled and not spilling past silhouettes.
Lighting: warm upper-left key, softly shaded lower-right faces about 0.75, lit tops, contact occlusion at stacked courses and foliage roots.
Critical invariants: Preserve 1536x1024 canvas and uniform muted green background. Keep all eight objects exactly at Image 1 positions, with exact outer silhouettes, structural edges, openings, wall continuations, pier dimensions, cap/finial profiles, planter rims, soil openings, and isometric projection. No edge may move more than 1 pixel. Paint only inside existing silhouettes. Keep planter centers/openings and corner shape structurally readable. No ground shadows outside silhouettes.
Avoid: text, symbols, extra props, excessive vines, obvious repeats, melted masonry, floating foliage, noise grain, pixelation, blur, black outlines, background changes, cast shadows outside sprites.
```

### Sheet A

```text
Use case: precise-object-edit
Asset type: isometric game environment sprite sheet, exact 1536x1024 PNG
Primary request: Paint over Image 1's nine village set-dressing guides into finished game art. Image 1 geometry is absolute law.
Input images: Image 1 mandatory edit target; Image 2 exact house-art style, palette, outline and grain reference; Image 3 exact fieldstone treatment.
Subjects in Image 1, left to right: two low fence orientations, deep-green banner pole, roofed village windlass well, blank notice board, timber lantern post, stone lantern, shop crate/barrel/basket stack, produce baskets on pallet.
Style: crisp polished hand-painted isometric art, same hand as Image 2, fine intentional brush grain, soft dark brown outlines, restrained saturation, no pure black.
Materials: weathered warm timber with visible joints and subtle edge wear; hemp rope; woven wicker baskets filled with restrained red and green produce; clay jar; tile-red roof on well; well and stone lantern in grey-cream fieldstone matching Image 3; paper-and-timber lantern glowing warm amber; banner deep green with a simple woven cream geometric border and central diamond, absolutely no writing; notice board has blank weathered cream papers with no marks resembling letters.
Lighting: warm upper-left key, lit top faces, lower-right faces softly shaded to about 0.75, contact occlusion wherever parts touch.
Critical invariants: Preserve exact 1536x1024 canvas and muted-green background. Keep every object at the exact Image 1 position and scale. Preserve every outer silhouette, structural edge, post, rail, roof plane, well mouth, crank/windlass, board/paper edge, lantern frame, basket and pallet boundary within 1 pixel. Keep open gaps between fence rails and well posts as background. Posts must reach the same ground endpoints. Paint only within guide silhouettes. No ground shadow outside any silhouette.
Avoid: legible text or text-like marks, extra objects, missing rails, bent posts, melted parts, filled gaps, black outlines, noise grain, chunky pixels, blur, background changes, ground shadows.
```

### Sheet B

```text
Use case: precise-object-edit
Asset type: isometric game environment sprite sheet, exact 1536x1024 PNG
Primary request: Paint over Image 1's eight set-dressing guides into finished game art, preserving exact engineered geometry and every open gap.
Input images: Image 1 mandatory edit target and geometry law; Image 2 matching finished prop treatment; Image 3 foliage, masonry, outline and grain reference.
Subjects: fenced 3x2 kitchen garden with greens and bean supports; roofed firewood shelter full of split logs; laundry line with tile-red, cream, warm-yellow and deep-green cloth; two-wheeled handcart; stone trough with timber hay rack; two bench orientations.
Style: crisp polished hand-painted isometric game art, soft dark-brown outlines, restrained saturation, fine intentional brush grain, no pure black.
Materials: weathered warm timber with joinery and edge wear; hemp rope; homespun cloth; grey-cream stone trough; golden dry hay; dark garden soil and flowering greens. Handcart has exactly two round wheels on one straight axle beneath the bed, timber bed and crates, with both shafts resting at existing ground endpoints.
Lighting: warm upper-left key; lit tops; lower-right faces softly shaded about 0.75; contact occlusion where parts touch.
Critical invariants: Preserve exact 1536x1024 canvas and uniform muted-green background. Keep every object at Image 1 exact position, scale, silhouette, perspective and structural edge within 1 pixel. Keep untouched background in every real gap: cart wheel spokes, beneath cart bed, around axle and shafts, laundry rope/cloth/posts, garden fence rails, bench slats/legs, hay-rack slats, shelter openings and logs. All posts and legs reach exact ground endpoints; wheels are round and tangent to exact ground line; shafts rest on ground. Paint only inside guide silhouettes. No ground shadow outside silhouettes.
Avoid: extra or missing wheels, wheels off axle, bent shafts, floating parts, melted rails/slats, filled holes, text, symbols, people, black outlines, noise grain, chunky pixels, blur, background changes, ground shadows.
```
