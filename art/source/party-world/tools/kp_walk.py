"""Kaya polish, step 5: the designed walk on the steeper body (design.py's six poses: contact, down, passing, twice).
Two changes from #321: the ground is measured in #321's body heights (75 px), not the new foreshortened drawing's (70), so
a step covers the same ground; and the step is 0.5 body heights (#321: 0.45), so at the 750 ms a tile pace the loop plays
at about 100-115 ms a cel instead of 87-101 (calmer legs, the brisk cap of 70 never reached).

#351: the side-on strides read as a lunge at game zoom, east and west most, so the step is now set per heading: 0.38 body
heights east and west, 0.44 on the four diagonals, 0.5 north and south (unchanged: the feet travel up and down the screen
there and the stride does not read as long). The cadence follows from the 750 ms a tile pace (about 85-95 ms a cel east and
west), and the clip time a tile is refitted from the drawn feet by kp_assemble.py and pack.py as before.

#408 (owner, 2026-11-03: "super hoppy ... seems we're missing some frames"): eight poses, not six, and the feet planted
on one screen row. The store stands every walk cel on its own lowest pixel (src/render/sheets/feet.ts), so a planted
foot striding along the screen's y moved the whole figure by up to half a step's projection a cel (3-9 world px measured,
north and south worst). Now:

- eight cels: contact, down, passing, up, for each leg. The stance foot moves back S/4 a cel (a pace of S/4 a cel holds
  it horizontally), the swing foot lifts off behind, passes under the body at its highest and reaches forward;
- design.PLANT: a foot on the ground keeps the ground row in every cel and only a lifted foot shows the upward part of
  its stride (the back foot kicking up the screen walking south, the reaching foot walking north); the horizontal stride
  is unchanged, so the fit from the drawn feet still holds the planted foot sideways. North and south have no sideways
  stride and walk like a classic top-down sprite: the feet lift and pass, the figure carried by the move;
- the pelvis (and so the head and torso) dips 1 px on each down cel and is level otherwise; kp_assemble.py places the
  trunk by each cel's drawn ground row so the dip is what the eye sees, never more than 1 px a cel;
- the step is 0.40 body heights east and west (0.38 at #351), 0.46 on the diagonals and north and south (0.44, 0.5), so the
  eight cels hold 70-90 ms at the 750 ms a tile pace.

usage (repo root): python3 -I art/source/party-world/tools/kp_walk.py  -> design/kaya-<dir>.json + design/prev/kaya-<dir>.png
then python3 -I art/source/party-world/tools/gen_walk.py SEED kaya:south ..."""
import sys
from pathlib import Path
sys.argv = sys.argv[:1]
sys.path.insert(0, str(Path(__file__).parent))
import design
OLD_HEIGHT, NEW_HEIGHT = 75, 70
STEP = {'south': 0.46, 'north': 0.46, 'east': 0.40, 'west': 0.40,
        'south-east': 0.46, 'south-west': 0.46, 'north-east': 0.46, 'north-west': 0.46}
design.GROUND_PER_H = (1 / 1.095) * OLD_HEIGHT / NEW_HEIGHT
# Each foot over the eight cels (contact, down, passing, up; then the other leg's four): position along the walk in steps,
# ankle lift in H. On the ground for the first four (design.STANCE), S/4 back a cel; then off behind, under the body at
# its highest, reaching forward and down onto the next contact.
design.FOOT = [(+0.5, 0.0), (+0.25, 0.0), (0.0, 0.0), (-0.25, 0.0), (-0.5, 0.02), (-0.2, 0.055), (+0.12, 0.065), (+0.38, 0.03)]
DIP = 1.0   # px the pelvis drops on each down cel
design.ARM = [-1.0, -0.7, 0.0, 0.7, 1.0, 0.7, 0.0, -0.7]
design.PLANT = True; design.STANCE = 4

if __name__ == '__main__':
    for d in design.DIRS:
        H = design.height('kaya', d)
        design.PELVIS = [0.0, -DIP / H, 0.0, 0.0] * 2
        design.STEP = STEP[d]; r = design.design('kaya', d); print(d, 'H', r['height'], 'bounds', r['bounds'])
