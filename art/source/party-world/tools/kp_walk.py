"""Kaya polish, step 5: the designed walk on the steeper body (design.py's six poses: contact, down, passing, twice).
Two changes from #321: the ground is measured in #321's body heights (75 px), not the new foreshortened drawing's (70), so
a step covers the same ground; and the step is 0.5 body heights (#321: 0.45), so at the 750 ms a tile pace the loop plays
at about 100-115 ms a cel instead of 87-101 (calmer legs, the brisk cap of 70 never reached).

usage (repo root): python3 -I art/source/party-world/tools/kp_walk.py  -> design/kaya-<dir>.json + design/prev/kaya-<dir>.png
then python3 -I art/source/party-world/tools/gen_walk.py SEED kaya:south ..."""
import sys
from pathlib import Path
sys.argv = sys.argv[:1]
sys.path.insert(0, str(Path(__file__).parent))
import design
OLD_HEIGHT, NEW_HEIGHT, STEP = 75, 70, 0.5
design.GROUND_PER_H = (1 / 1.095) * OLD_HEIGHT / NEW_HEIGHT
design.STEP = STEP

if __name__ == '__main__':
    for d in design.DIRS:
        r = design.design('kaya', d); print(d, 'H', r['height'], 'bounds', r['bounds'])
