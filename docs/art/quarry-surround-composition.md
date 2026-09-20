# Quarry exterior surround

The terrace/rim checkpoint `8e1326f` fixed the grey terrace material and rim
scale, but its detached exterior spans still read as image cards. This pass adds
one coherent authored quarry surround behind both live floors. It contains
continuous limestone banks, descending foreground cliffs and restrained timber
workings. The rear recess and west approach remain open. The Driller no longer
registers its redundant rim cards; their source, packed assets and crop metadata
are preserved. The Cutting keeps its continuous near rear wall.

## Contract and registration

Two shared WebP pages are prepended to `MapScene.ground`. Each scene now has four
ground entries, within the existing eight-entry contract and sixteen-image cache.
The surround never owns a playable tile or draws after an actor, prop, surface or
tactical overlay. No camera, rendering API, rules, map rows or save data changed.

The source is 1572 x 1001. Its measured diamond corners are top (624,325), right
(1347,695), bottom (928,909). The left corner is implied by those axes; source
terrace lips overlap it and are not accepted as map geometry. The packer applies
the measured affine registration only to this exterior illustration and excludes
the exact 20 x 12 playable polygon, with a conservative 0.02-cell filter guard.
The existing board projection, floor and hit testing are untouched.

Output world bounds are x=-320, y=-560, width=2688, height=1664. Each page is
672 x 832 pixels displayed over 1344 x 1664 world pixels. These distant painted
surroundings use fewer pixels than the interactive floor. There is no requirement
to fit their complete outer rectangle into the viewport.

The source uses a magenta guide hole and variable alpha outside it. The importer
uses the authored RGB outside the exact exclusion and assigns opaque background
alpha; it does not use generator alpha as collision/ownership geometry. It removes
the magenta guide and a three-source-pixel anti-aliased fringe. Exactly 9,912
output samples receive their nearest clean painted neighbour (search bounded to
16 source pixels); 246,784 output pixels are explicitly excluded. The shipped
WebP alpha mask is independently decoded and checked against every live floor
pixel by `quarrySurround.test.ts`. No inside-floor alpha survives encoding.

## Source and reproduction

Built-in imagegen produced `art/raw/terraces/surround-source-v1.png`, preserved
locally with the original technical guide and terrace inputs. Source SHA-256:
`48c7481370b05d8c6d96bf0ba816261187762dace9feb6187518b261cf86d556`.
Source files are ignored intake, not runtime downloads.

```text
node --import tsx scripts/art/quarry-surround-pack.ts art/raw/terraces/surround-source-v1.png
```

Both output hashes reproduce byte-for-byte. West is 94,178 bytes and east is
93,940 bytes at WebP quality 84 (188,118 bytes together). This uses existing map
family headroom: 3.84 MiB of 4 MiB; total precache is 16.70 MiB of 25 MiB. No asset
budget increase, image-format extension or ADR change is required.

## Generation prompt

Inputs: `surround-guide.png` as the layout mask;
`driller/exterior-rim-candidate-full-assembly.png` as the material reference.

> Use case: sketch-to-render. Create a production game EXTERIOR BACKGROUND painting using image1 as an EXACT layout mask (2816x1792 aspect), image2 only as the limestone/timber style reference. Keep the exact magenta diamond in image1 completely solid #ff00ff, with the exact same corners and silhouette: it is a forbidden transparent hole for an existing playable board. Do NOT paint a floor, actors, props, grid, rocks or shadows inside this diamond. Paint the surrounding beige region as a COHERENT CONTINUOUS OLD LIMESTONE QUARRY environment viewed at the same elevated oblique +/-0.5 ground slopes. A connected bank of layered cream/ochre cut stone and rough rock strata rises behind and beside the diamond, with believable broad mass, multiple shallow rock shelves, irregular fractured cliff faces and sparse moss along cracks. Avoid the flat upright rectangular-card look: show depth through connected shelves receding to the top of the image and dense stone behind the near contact edges. Restrained distant industrial context: dark-brown timber bracing, a single small timber hoist with slack rope and weathered wheel, a few embedded cut blocks and worn wooden beams, integrated into the rear rock mass, with no equipment looming over or crossing the diamond. No people, no buildings, no towers. Preserve BOTH charcoal shapes in image1 as open approach mouths: remove the charcoal color and let them read as unobstructed recesses/clear openings leading off the map, without stairs or a wall blocking their attachment to the diamond; distant stone beyond may frame the gaps. No new visible paths, roads, traversable platforms, stairs or doorways outside those two existing mouths. Below/front of the diamond, paint only steep descending rock face and broken cliff strata, never extra walkable floor. Fill the full canvas outside the magenta hole as a richly painted but calm continuous quarry so it can crop naturally at any viewport. Style: warm hand-painted cel illustration, clean fine warm-brown ink lines, controlled cream/tan/ochre/grey-green palette, two-tone stone shading, matching input2 but lower contrast with distance. No photographic texture, no sky, no fog blobs, no labels, no lettering. Completely remove all guide text; retain only the exact flat magenta exclusion diamond. The key objective is a continuous believable stone environment around the live board, rather than isolated props.

## Review limits

The generated source did not preserve the guide pixel-for-pixel. Registration
uses its measured painted diamond rather than pretending it did; the actual
floor is excluded regardless of source content. Some outside ledge tops are
visible as non-interactive background, not additional paths or authored tiles.
The existing rear and western open approaches remain unblocked in the painting.

The orchestrator reviewed the mounted R3 fitted view as a substantial improvement.
Actual Canvas/WebGL views, normal-save import, intermediate camera zoom and legal
raised-cell contact are recorded in the [handoff](../coordination/handoffs/quarry-composition.md).
This is bounded quarry composition evidence, not physical-device validation or
acceptance of the full reference target. Small pale squares remaining on the floor
are rules-owned rubble; the R3 pale centre strip is live ice and remains unchanged.
