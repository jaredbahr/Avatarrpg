"""Before/after review for ADR 0094 (figures at 1.0 on oblique boards).

usage (repo root): python3 -I art/source/figure-scale/compare.py SHOTS
SHOTS holds the canvas captures of e2e/ba-dan-demo.review.ts and e2e/forest-g1.review.ts with the labels `before`
(figures at 1.25, PR #301's head) and `after` (this branch): SHOTS/{ba-dan-demo,forest-g1}/{before,after}/canvas/.
Writes review/: the slice and the forest frames at game zoom, and nearest-neighbour crops, before over after:
- ba-dan-door-4x.png: Gao beside his shop door and wall, 4x;
- ba-dan-table-2x.png: the market table, the bridge and Gao, 2x, so a figure's height reads against the table and door;
- forest-kaya-thug-4x.png: Kaya and the thug at the aimed jab (96 px tiles asked, 128 drawn), 4x.
"""
import shutil, sys
from pathlib import Path
from PIL import Image, ImageDraw
OUT = Path(__file__).resolve().parent / 'review'


def label(im, text):
    im = im.convert('RGB'); d = ImageDraw.Draw(im); d.rectangle((0, 0, 7 * len(text) + 8, 15), fill=(0, 0, 0)); d.text((4, 2), text, fill=(255, 255, 255)); return im


def pair(shots, rel, box, k, name, what):
    rows = []
    for lab in ('before', 'after'):
        im = Image.open(shots / rel.format(lab)).crop(box)
        rows.append(label(im.resize((im.width * k, im.height * k), Image.NEAREST), f'{lab}: {what}'))
    out = Image.new('RGB', (max(r.width for r in rows), sum(r.height for r in rows) + 8), (30, 30, 30)); y = 0
    for r in rows: out.paste(r, (0, y)); y += r.height + 8
    out.save(OUT / name)


if __name__ == '__main__':
    shots = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
    for lab in ('before', 'after'):
        shutil.copy(shots / f'ba-dan-demo/{lab}/canvas/slice-1x.png', OUT / f'ba-dan-slice-{lab}.png')
        for f in ('fit', 'aim-bandit-in-oil-96', 'move-96'):
            shutil.copy(shots / f'forest-g1/{lab}/canvas/{f}.png', OUT / f'forest-{f}-{lab}.png')
    demo, forest = 'ba-dan-demo/{}/canvas/slice-1x.png', 'forest-g1/{}/canvas/aim-bandit-in-oil-96.png'
    pair(shots, demo, (980, 220, 1220, 430), 4, 'ba-dan-door-4x.png', 'Gao by his door (1.25 / 1.0), 4x')
    pair(shots, demo, (500, 200, 1150, 440), 2, 'ba-dan-table-2x.png', 'the market table and Gao, 2x')
    pair(shots, forest, (480, 330, 900, 545), 4, 'forest-kaya-thug-4x.png', 'Kaya and the thug, 4x')
    print('written')
