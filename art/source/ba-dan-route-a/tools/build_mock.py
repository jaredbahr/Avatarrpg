"""Rebuild the Route A review mock from the committed generated sources (no PixelLab calls).

Run from the repository root after the Ba Dan pipeline's render/stitch/split into BA_DAN_WORK
(default .review/regions):  python art/source/ba-dan-route-a/tools/build_mock.py
Writes into ROUTE_A_WORK (default .review/route-a).
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
from compose import *
from tiles import plan, stitch
os.makedirs(RA, exist_ok=True)
# The ground composition: six world-px tiles (1440 x 880 world px, 48 px minimum overlap), stitched as generated.
parts = [(box, Image.open(f'{GEN}/ground-tile-{i}.png')) for i, box in enumerate(plan(1440, 880, 512, 48))]
ground_world = stitch(1440, 880, parts)
cur_ground = Image.open(f'{REG}/quiet.png').convert('RGBA').crop(G)
cur_up = Image.open(f'{REG}/faded.png').convert('RGBA').crop(G)
new = up15(ground_world, (G[2] - G[0], G[3] - G[1]))
new.save(f'{RA}/out-ground-composition.png')
house = up15(Image.open(f'{GEN}/gao-house.png'), (702, 508))
tree = up15(Image.open(f'{GEN}/canopy-tree.png'), (480, 468))
paste_piece(new, house, piece('gao-house'), (2013, 329))
paste_piece(new, tree, piece('tree-5-5'), (1578, 228))
new.save(f'{RA}/out-slice-art.png')
mock_new = with_figures(new, new); mock_cur = with_figures(cur_ground, cur_up)
mock_new.save(f'{RA}/mock-route-a.png'); mock_cur.save(f'{RA}/mock-current.png')
# iPad landscape framing (1368 x 714 screen px at game zoom) centred on the market corner
cx, cy = paint(7.5, 5)
f = (round(cx - G[0] - 684), round(cy - G[1] - 357)); fb = (f[0], f[1], f[0] + 1368, f[1] + 714)
mock_new.crop(fb).save(f'{RA}/mock-route-a-ipad.png'); mock_cur.crop(fb).save(f'{RA}/mock-current-ipad.png')
print('frame', fb)
