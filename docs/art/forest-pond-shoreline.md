# Forest pond shoreline correction

Base: `9e005b1`. One pond patch, no rule, renderer, collision or water-cell changes.
This removes the continuous dark outline; it does not naturalize the exact eight-cell cross.

## Diagnosis and registration

The earlier `water.webp` baked in the dark rim. The current local `pond-bank.webp`
contains only dry exterior pixels; permanent water is still drawn by the map's eight
runtime water cells. The retained `water.webp` is historical source material, not
the active forest-road ground layer.

The unchanged water cells are (5,5), (6,5), (4,6), (5,6), (6,6), (7,6), (5,7), (6,7).
The patch is world (560,304), 352 × 192, packed at 704 × 384. Its dry exterior is
opaque through the existing 0.08-cell guard and feathered to zero at 0.12 cells;
every pixel inside the original water cells is transparent. Both backends use the
existing scene ground-image contract.

Run `node --import tsx scripts/art/forest-shoreline.ts` to repack the tracked source.
The source is scaled as a full canvas, without trim/recentering. Its original dry
edge RGB is retained where visible; transparent or teal registration samples borrow
the nearest visible dry pixel from the same source. Alpha is registered to the
bounded exterior only. No procedural shoreline material is painted. Tests compare
the shipped bytes with a fresh encode, decode shipped alpha to check the transparent
water interior and exterior exclusion, and verify every water-cell center is clear.

## Source and credit

Original project art generated with OpenAI image generation on 19 September 2026.
Existing forest-scene credit covers this replacement. Output terms:
https://openai.com/policies/row-terms-of-use/. No exclusive copyright is claimed.

The single generated result was `exec-c4173a6f-bb80-47d8-8d3a-e4087a442b32.png`
in generation session `01a0b832-53b3-7b82-abe3-06487e40cd0d`, now durably tracked as
`assets/reference/forest-pond-shoreline/shoreline-source.png` (1698 × 926).
SHA256: `815250ef82116d2ae9812e2cb21a10848b3f11c804481b313bfb575646986fb7`.

The technical registration guide is tracked alongside it (1408 × 768), SHA256
`3bf68029a06eb0ee4a8dfa110ca10185283c95ccc59e2f5240c2ae3d419d8596`.
Guide pixel centers map to world (560 + (px+.5)/4, 304 + (py+.5)/4), inverse
projection origin (768,0), basis (64,32), (-64,32). Exact water cells use
RGBA (66,108,107,255); dry Chebyshev margin ≤0.12 uses (185,161,119,255); rest alpha 0.
Other generation inputs were `9e005b1:public/art/maps/forest-scene/water.webp`
and `9e005b1:public/art/maps/forest-scene/ground-west.webp`.

Exact prompt:

> Use case: precise-object-edit. Asset: ONE transparent painted pond patch for an oblique tactical game. Image 1 is the EXACT composition and pixel-registration guide, full canvas 1408 by 768. Image 2 is existing water material to retain; image 3 shows the ochre road palette the edge must blend with. Paint over image 1 without moving, rotating, recentering, expanding or shrinking its teal water silhouette: teal region is the exact playable water area, beige narrow band is dry shoreline, transparent region must stay transparent. Preserve the eight-cell cross's extremal points and concave notches exactly. Replace the existing pond's continuous dark-brown outlined rim with softly mottled shallow water transitioning into a narrow, irregular, low damp-earth shore. The actual water remains only inside teal guide; no water anywhere in the beige dry margin or transparent space. Small broken ochre flecks and quiet wet silt variations at the boundary, avoid straight dark ink outlines, bevels, raised lips, uniform borders or a tabletop/plastic cutout appearance. Retain calm blue-green watery interior, restrained small ripples, painterly material density similar to reference, with flat shore at same ground height. Very narrow dry ochre border matching the road, softly feathered alpha at its outside edge, not a wide ring or islands inside water. No stones, vegetation, reeds, objects, creatures, shadows, text, diagrams, grid or UI. Output only a transparent RGBA landscape patch at the guide's exact 1408:768 aspect ratio; keep the full canvas registration.

See the [handoff](../coordination/handoffs/forest-pond-shoreline.md) for actual runtime evidence.
