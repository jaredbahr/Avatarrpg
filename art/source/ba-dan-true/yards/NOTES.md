# Ba Dan household-yard candidates

## Method

- Used the built-in image editor once per house, with the corresponding `.review/painted-v3/<piece>.png` as the edit target.
- Registered each returned painting to the exact source canvas.
- Derived the editable yard from the connected low rear-terrace plane in `art/source/ba-dan-true/planes/<piece>.png` (the supplied near-black navy terrace plane), intersected with the source alpha.
- Composited generated RGB only through that terrace mask. Every pixel outside the mask came from the painted-v3 source, and every output alpha byte came from the source.
- Built `sheet.png` from the decoded final PNGs: before/after at 1x and a nearest-neighbour 3x yard crop for each house.

## Diff check

Decoded-pixel comparison against `.review/painted-v3/`:

| Piece                |  Canvas | Changed pixels inside terrace | RGBA differences outside terrace | Alpha differences |
| -------------------- | ------: | ----------------------------: | -------------------------------: | ----------------: |
| `dwelling-4x3`       | 702×576 |                        24,661 |                                0 |                 0 |
| `dwelling-4x4`       | 798×624 |                        24,911 |                                0 |                 0 |
| `merchant-house-4x3` | 702×576 |                        23,423 |                                0 |                 0 |
| `merchant-house-4x4` | 798×624 |                        23,344 |                                0 |                 0 |

The comparison is decoded RGBA, not a file-byte or exit-code proxy.

## Verbatim prompts

### `dwelling-4x3`

> Use case: precise-object-edit
> Asset type: transparent modular 2.5D game scenery candidate, exact existing canvas
> Input image: edit target, dwelling-4x3 potter's house
> Primary request: repaint ONLY the low pale stone terrace behind and to the left of the house into an obviously private potter's yard. Replace terrace paving with packed earth. Add a low kiln or firing pit against the visible rear/gable house wall, rows of drying pots on a low plank, and a water trough. Along both outer terrace edges away from the house, create a continuous knee-high woven wattle fence with NO gap, entirely inside the existing terrace silhouette; the existing 8 px slab edge may read as its base.
> Projection: exact existing oblique projection. Every ground line, plank, fence run, stack edge follows terrace axes at screen slopes +0.5 or -0.5; verticals remain vertical.
> Style: match the existing hand-painted crisp game art exactly: fine soft dark-brown 1–2 px outlines, two flat tones per material and thin pale upper-left rim, subtle grain, no gradients, no pure black. Objects grounded with contact shadows and short shadows down-right. Respect the house shadow across the rear/right yard; most yard remains upper-left lit. Check readability at 3x.
> Constraints: preserve the exact canvas size and transparency. Do not change any pixel of the house body, roof, gable, plinth under the body, steps, threshold, windows, doors, pots already on the porch/plinth, or anything on them. Change only the large low terrace area visible behind and left of the gable, including its outer slab edge. Keep every new object below the eave line and inside the existing opaque silhouette. No characters, no text, no watermark, no floating objects, no outside-franchise references.

### `dwelling-4x4`

> Use case: precise-object-edit
> Asset type: transparent modular 2.5D game scenery candidate, exact existing canvas
> Input image: edit target, dwelling-4x4 woodcutter's house
> Primary request: repaint ONLY the large low terrace behind and to the left of the house into a private wood yard. Replace terrace paving with packed earth scattered with wood chips. Add a chopping block with an axe firmly embedded, split logs stacked continuously along one outer edge, and a sturdy low sawhorse. Along both outer terrace edges away from the house, create a continuous knee-high low dry-stone boundary wall with NO gap, entirely inside the existing terrace silhouette; the existing 8 px slab edge becomes the wall base.
> Projection: exact existing oblique projection. Every ground line, sawhorse rail, wall run, log-stack edge follows terrace axes at screen slopes +0.5 or -0.5; verticals remain vertical.
> Style: match existing crisp hand-painted game art exactly: fine soft dark-brown 1–2 px outlines, two flat tones per material and a thin pale upper-left rim, subtle grain, no gradients, no pure black. All objects grounded with contact shadows and short shadows down-right. Respect the house shadow across the rear/right yard; most yard remains upper-left lit. Readable at 3x.
> Constraints: preserve exact canvas size and transparency. Do not change any pixel of house body, roof, gable, plinth under body, steps, threshold, windows, doors, existing firewood box/broom/name board, or anything on the body/plinth. Change only the large low terrace behind and left of the gable, including its outer slab edge. Keep new objects below eave line and inside existing opaque silhouette. No characters, text, watermark, floating objects, or outside-franchise references.

### `merchant-house-4x3`

> Use case: precise-object-edit
> Asset type: transparent modular 2.5D game scenery candidate, exact existing canvas
> Input image: edit target, merchant-house-4x3
> Primary request: repaint ONLY the large low terrace behind and to the left of the house into a private kitchen garden. Replace terrace paving with dark packed garden earth. Add exactly three short parallel vegetable rows, a small bean trellis with climbing leaves, a rain butt against the visible rear/gable house wall, and several herbs in grounded clay pots. Along both outer terrace edges away from the house, create a continuous knee-high clipped hedge with NO gap, entirely inside the existing terrace silhouette; the existing 8 px slab edge becomes its base.
> Projection: exact existing oblique projection. Rows, trellis rails, pot alignment, hedge runs and edges follow terrace axes at screen slopes +0.5 or -0.5; verticals remain vertical.
> Style: match existing crisp hand-painted game art exactly: fine soft dark-brown 1–2 px outlines, two flat tones per material and thin pale upper-left rim, subtle grain, no gradients, no pure black. Objects grounded with contact shadows and short shadows down-right. Respect house shadow across rear/right yard; most yard upper-left lit. Clear at 3x.
> Constraints: preserve exact canvas size and transparency. Do not change any pixel of house body, roof, gable, awning/shopfront, plinth under body, steps, threshold, windows, doors, existing bench/rain barrel/lantern, or anything on them. Change only the large low terrace behind and left of gable, including outer slab edge. Keep new objects below eave line and inside existing opaque silhouette. No characters, text, watermark, floating objects, or outside-franchise references.

### `merchant-house-4x4`

> Use case: precise-object-edit
> Asset type: transparent modular 2.5D game scenery candidate, exact existing canvas
> Input image: edit target, merchant-house-4x4
> Primary request: repaint ONLY the large low terrace behind and to the left of the house into a private goods yard. Replace terrace paving with worn packed earth. Add orderly stacked crates and barrels, a small handcart whose construction is unambiguous (exactly two wheels on one straight axle beneath the cart bed, two long shafts extending from the bed and resting on the ground), and one compact tarpaulin-covered goods pile. Along both outer terrace edges away from the house, create a continuous knee-high timber/palisade boundary with NO gap, entirely inside the existing terrace silhouette; the existing 8 px slab edge becomes its base.
> Projection: exact existing oblique projection. Cart axle, bed, shafts, crate stacks, barrel rows, tarp base and boundary runs follow terrace axes at screen slopes +0.5 or -0.5; verticals remain vertical.
> Style: match existing crisp hand-painted game art exactly: fine soft dark-brown 1–2 px outlines, two flat tones per material and thin pale upper-left rim, subtle grain, no gradients, no pure black. Objects grounded with contact shadows and short shadows down-right. Respect house shadow across rear/right yard; most yard upper-left lit. Ensure cart mechanics remain legible at 3x.
> Constraints: preserve exact canvas size and transparency. Do not change any pixel of house body, roof, gable, awning/shopfront, plinth under body, steps, threshold, windows, doors, existing crates/name board/shop goods, or anything on body/plinth. Change only large low terrace behind and left of gable, including outer slab edge. Keep new objects below eave line and inside existing opaque silhouette. No characters, text, watermark, floating objects, or outside-franchise references.

## Known limitations / review notes

- Exact source alpha necessarily clips the tops of boundary elements at the original terrace silhouette; this is intentional to satisfy the alpha contract.
- The source house casts remain untouched. New yard objects include small down-right contact/cast accents confined to the terrace.
- The potter's kiln sits tight to the gable and is partly occluded by it in the final registered composite; the firing mouth remains visible.
- No game, tests, or repository generators were run, per the worker constraint. Review consisted of decoded-pixel checks plus visual inspection of the four finals and the 1x/3x sheet.
