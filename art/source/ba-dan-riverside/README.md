# Riverside painting source

`scripts/art/riverside-edge-props.ts` bakes the riverside's painted edge stops
from these files into `public/art/maps/ba_dan_riverside.webp`.

- `painting.png` is the riverside painting as it shipped before any edge prop,
  losslessly decoded from the 1440 x 960 WebP of commit 6b33ff1. The 1536 x 1024
  generation it was cut from is not in the repository, so this decode is the
  source. Every bake starts from it, never from the shipped WebP, so the props
  are laid once, not once per rebuild.
- `props/` holds elements cut out of that painting (method (b) from the
  edge-prop prototype: the painting's own brushwork, never new art). Each
  cutout's pixels are the painting's pixels at the origin below, with an alpha
  hand-masked around the element and softened by under a pixel.
  `riverside-edge-props.test.ts` checks every visible pixel against the
  painting.

| Cutout           | Size    | Origin in `painting.png` | What it is                                               |
| ---------------- | ------- | ------------------------ | -------------------------------------------------------- |
| `fence.png`      | 93 x 37 | (150, 754)               | Two bays of the tea garden's front-facing post-and-rail  |
| `rock-left.png`  | 39 x 40 | (150, 837)               | The left of the two mossy boulders below the tea garden  |
| `logs.png`       | 44 x 65 | (1377, 474)              | The log rounds against the east clearing's banner fence  |
| `rock-small.png` | 32 x 30 | (326, 840)               | The small mossy rock beside the garden walkway at (8,21) |

`rock-small.png` stands once in the bake, on the south-east bank at (34,21).
Its original at (8,21) is painted out: that cell is walkable now, so a rock on
it read as a stop that was not there. The bake clones a patch of the
painting's own sunlit verge over it, offset (63,-77), scaled per channel to
the light of the ground round the rock (`GROUND_PATCHES` in the script). The
source painting keeps the rock, so the cutout still checks against it.

The prototype's `cutouts.py` cut the first three. Their masks are rectangles and
polygons measured at 10x, with no colour key, then blurred 0.5 px (the fence)
or 0.8 px (the rocks and logs). `rock-small.png` was cut the same way for
the edge-prop bake. Its polygon was (329,848) (333,844) (340,842) (348,844)
(352,849) (355,857) (353,864) (344,867) (336,866) (330,861) (328,854), blurred
0.8 px.
