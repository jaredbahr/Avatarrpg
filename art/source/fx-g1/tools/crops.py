"""4x before/after crops of the bending practice (issue #284 evidence for ADR 0086).

Run from the repo root after both practice captures:
  python3 -I art/source/fx-g1/tools/crops.py <before> <after> <out> [webgl,canvas]
Fixed boxes on the 1368 x 912 practice frame: the bender (gather and release, the effect at the hand) and the
target on the canal bank (impact). Blown up 4x nearest; before on the left, after on the right.
"""
import sys, os
from PIL import Image

BEFORE, AFTER, OUT = sys.argv[1:4]
BACKENDS = sys.argv[4].split(',') if len(sys.argv) > 4 else ['webgl', 'canvas']
os.makedirs(OUT, exist_ok=True)
BENDER = {'kaya': (470, 350, 650, 500), 'sura': (600, 400, 920, 540), 'bo': (660, 450, 860, 620)}
TARGET = (240, 150, 360, 250)
for backend in BACKENDS:
    for who in ['kaya', 'sura', 'bo']:
        for moment in ['gather', 'release', 'impact']:
            name = f'practice-{who}-{moment}.png'
            b = Image.open(f'{BEFORE}/{backend}/{name}').convert('RGB')
            a = Image.open(f'{AFTER}/{backend}/{name}').convert('RGB')
            box = TARGET if moment == 'impact' else BENDER[who]
            w, h = box[2] - box[0], box[3] - box[1]
            sheet = Image.new('RGB', (w * 8 + 16, h * 4), (24, 20, 16))
            sheet.paste(b.crop(box).resize((w * 4, h * 4), Image.NEAREST), (0, 0))
            sheet.paste(a.crop(box).resize((w * 4, h * 4), Image.NEAREST), (w * 4 + 16, 0))
            sheet.save(f'{OUT}/{backend}-{who}-{moment}-4x.png')
