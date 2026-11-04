"""Kaya polish, step 5: the designed walk on the steeper body (design.py's six poses: contact, down, passing, twice).
Two changes from #321: the ground is measured in #321's body heights (75 px), not the new foreshortened drawing's (70), so
a step covers the same ground; and the step is 0.5 body heights (#321: 0.45), so at the 750 ms a tile pace the loop plays
at about 100-115 ms a cel instead of 87-101 (calmer legs, the brisk cap of 70 never reached).

#351: the side-on strides read as a lunge at game zoom, east and west most, so the step is now set per heading: 0.38 body
heights east and west, 0.44 on the four diagonals, 0.5 north and south (unchanged: the feet travel up and down the screen
there and the stride does not read as long). The cadence follows from the 750 ms a tile pace (about 85-95 ms a cel east and
west), and the clip time a tile is refitted from the drawn feet by kp_assemble.py and pack.py as before.

usage (repo root): python3 -I art/source/party-world/tools/kp_walk.py  -> design/kaya-<dir>.json + design/prev/kaya-<dir>.png
then python3 -I art/source/party-world/tools/gen_walk.py SEED kaya:south ..."""
import sys
from pathlib import Path
sys.argv = sys.argv[:1]
sys.path.insert(0, str(Path(__file__).parent))
import design
OLD_HEIGHT, NEW_HEIGHT = 75, 70
STEP = {'south': 0.5, 'north': 0.5, 'east': 0.38, 'west': 0.38,
        'south-east': 0.44, 'south-west': 0.44, 'north-east': 0.44, 'north-west': 0.44}
design.GROUND_PER_H = (1 / 1.095) * OLD_HEIGHT / NEW_HEIGHT

if __name__ == '__main__':
    for d in design.DIRS:
        design.STEP = STEP[d]; r = design.design('kaya', d); print(d, 'H', r['height'], 'bounds', r['bounds'])
