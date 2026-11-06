import sys, json; sys.path.insert(0, 'tools')
from obj2 import regen
O = 'assets/objects/'
JOBS = [
 ('house_green', 2.1, 'front view of a two-storey village house with a green glazed tile gabled roof, cream plaster walls, dark timber frame, wooden door, three windows with flower boxes'),
 ('house_ochre', 2.1, 'front view of a narrow tall village house with a terracotta tile roof and a brick chimney, ochre plaster walls, dark timber beams, round arched wooden door, two windows'),
 ('teahouse', 2.1, 'front view of a wide one-storey village teahouse with a dark green tile roof with upturned eaves, cream plaster walls, red wooden pillars, paper lattice windows, a hanging cloth sign'),
 ('stall', 1.6, 'front view of a small open-front wooden market stall with a striped red and cream cloth awning on poles, a counter with baskets of fruit and vegetables, no people'),
 ('lamp', 1.5, 'a single slim dark iron street lamp post with a small glowing lantern on top'),
 ('barrels', 1.5, 'two wooden barrels with iron bands standing side by side'),
 ('crates', 1.5, 'two stacked wooden crates'),
 ('well', 1.5, 'a round stone village well with a small wooden roof and a bucket on a rope'),
 ('tree', 1.75, 'a lush leafy oak tree, bright green canopy with yellow-green highlights on the upper left, short brown trunk'),
 ('tree_blossom', 1.75, 'a small slender tree with pink blossoms and a thin brown trunk'),
 ('bush', 1.5, 'a small round green bush'),
 ('flowers', 1.5, 'a low patch of colourful garden flowers, red, yellow and white blossoms among green leaves'),
 ('bridge', 1.5, 'a long wooden plank footbridge seen from above, the plank deck runs from the bottom of the image to the top, low wooden railings along its left and right sides'),
 ('bench', 1.5, 'a simple wooden bench with a backrest, front view'),
 ('sign', 1.5, 'a small wooden signpost with one arrow sign'),
 ('pots', 1.5, 'three clay storage pots of different sizes'),
 ('tuft', 1.5, 'a small tuft of tall wild grass with two tiny yellow flowers'),
]
for k, s, d in JOBS:
    if sys.argv[1:] and k not in sys.argv[1:]: continue
    regen('v2_' + k, O + k + '.png', s, d, 300, pad=4)
