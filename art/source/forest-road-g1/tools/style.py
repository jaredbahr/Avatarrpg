"""Prompts for the forest road at G1. STYLE and KEEP are Ba Dan's (ba-dan-route-a/tools/style.py), unchanged, so the two
maps share one hand. GROUND is the forest's own: Ba Dan's calm ground went flat and bleached at distance (owner, #284),
so this asks for value structure at the scale the fitted combat view reads (patches of 10-40 px), and keeps the
1-2 px marks sparse."""
STYLE = ('fine-grain pixel art matching the character reference: 1 px dark brown outline (#1b1410) only on silhouettes and deep overlaps, '
 '3-5 flat tone groups per material, matte surfaces, no glossy highlights, no white glints, no bevels, warm key light from the upper left, '
 'cool brown shadows down-right, muted earth palette, calm low-detail ground')
KEEP = ('Keep the exact composition, camera angle (2:1 isometric, high top-down), every outline and shape position; change only the rendering.')
GROUND_BADAN = ('Walkable ground stays calm: grass, paving stones, the canal water and its stone banks are broad flat areas of 3-4 tones '
          'with only sparse 1-2 px marks; no all-over noise or stipple. No people.')
GROUND = ('Living but calm forest ground: the grass is broad soft patches of three or four rich greens (sunlit yellow-green, mid green, '
          'cool shaded green) so it still reads at a distance, with darker tufts and clumps gathered along edges and under the trees; '
          'the road is packed brown earth and worn cobbles with moss in the joints; the pond and creek are deep saturated blue-green water, '
          'darker in the middle, with a clear wet edge; flat areas of tone with only sparse 1-2 px marks, no all-over noise or stipple. No people.')
