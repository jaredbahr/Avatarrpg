"""Review sheet: each upright's pre-G1 input and both seeds, 3x nearest, on a grass swatch. -> argv[1]"""
import os, sys, glob
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, ImageDraw
from uprights import PIECES
WORK = os.environ.get('FOREST_G1_WORK', '.review/forest-g1')
K = 3
rows = []
for pid in (sys.argv[2:] or PIECES):
    ims = [Image.open(f'{WORK}/uprights-in/{pid}.png').convert('RGBA')]
    ims += [Image.open(f).convert('RGBA') for f in sorted(glob.glob(f'art/source/forest-road-g1/jobs/u-{pid}-s*-0.png'))]
    rows.append((pid, ims))
W = max(sum(im.width * K + 12 for im in ims) + 150 for _, ims in rows)
H = sum(max(im.height for im in ims) * K + 12 for _, ims in rows)
s = Image.new('RGBA', (W, H), (98, 128, 70, 255)); d = ImageDraw.Draw(s); y = 0
for pid, ims in rows:
    h = max(im.height for im in ims) * K
    d.text((4, y + 4), pid, fill=(255, 255, 255, 255)); x = 150
    for im in ims:
        s.alpha_composite(im.resize((im.width * K, im.height * K), Image.NEAREST), (x, y + h - im.height * K)); x += im.width * K + 12
    y += h + 12
s.save(sys.argv[1])
