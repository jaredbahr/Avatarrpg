"""Before/after review composites for the owner (review/ingame, review/faces, review/walk).

usage (repo root): python3 -I art/source/residents-g1/tools/compare.py SHOTS
SHOTS holds the canvas captures of e2e/ba-dan-demo.review.ts and e2e/forest-g1.review.ts, shot with the labels `before`
(main at the merge base, the shipped G sheets) and `after` (this branch):
  SHOTS/ba-dan-demo/{before,after}/canvas/  and  SHOTS/forest-g1/{before,after}/canvas/
Writes:
- review/ingame/ba-dan-slice-{before,after}.png: the slice at game zoom; ba-dan-figures-4x.png: Gao, Mira and the household
  adult cropped from it at 4x nearest, before over after;
- review/ingame/forest-{name}-{before,after}.png: the 96 px frames with the bandits; forest-bandit-4x.png: Kaya and the
  thug at the aimed jab at 4x (2.67 screen px per world px at 96 px tiles... cropped and enlarged 2x nearest), before over
  after;
- review/faces/faces-4x-before-after.png: idle cel 0's head, S and SE, every name, at 4 screen px per world px: the shipped
  cel (2 sheet px per world px) at 2x over the G1 cel at 4x;
- review/walk/walk-se-before-after.png: the south-east walk, every name, shipped cels at half size over the G1 cels.
"""
import json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent.parent
C = json.load(open(HERE / 'tools/chars.json'))
OUT = HERE / 'review'
BG = (112, 128, 96, 255)


def stack(ims, gap=8, horizontal=False, bg=(30, 30, 30, 255)):
    if horizontal:
        W = sum(i.width for i in ims) + gap * (len(ims) - 1); H = max(i.height for i in ims)
    else:
        W = max(i.width for i in ims); H = sum(i.height for i in ims) + gap * (len(ims) - 1)
    out = Image.new('RGBA', (W, H), bg); o = 0
    for i in ims:
        out.alpha_composite(i.convert('RGBA'), (o, 0) if horizontal else (0, o)); o += (i.width if horizontal else i.height) + gap
    return out


def label(im, text):
    im = im.convert('RGBA'); d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 * len(text) + 8, 16), fill=(0, 0, 0, 180)); d.text((4, 2), text, fill=(255, 255, 255)); return im


def on_bg(im, s):
    b = Image.new('RGBA', im.size, BG); b.alpha_composite(im.convert('RGBA')); return b.resize((im.width * s, im.height * s), Image.NEAREST)


def ingame(shots):
    o = OUT / 'ingame'; o.mkdir(parents=True, exist_ok=True)
    for lab in ('before', 'after'):
        shutil.copy(shots / f'ba-dan-demo/{lab}/canvas/slice-1x.png', o / f'ba-dan-slice-{lab}.png')
        for f in ('aim-bandit-in-oil-96', 'move-96', 'zoom96-props', 'fit'):
            shutil.copy(shots / f'forest-g1/{lab}/canvas/{f}.png', o / f'forest-{f}-{lab}.png')
    boxes = {'gao': (990, 260, 1130, 430), 'mira': (1140, 450, 1260, 620), 'household': (110, 320, 230, 490)}
    rows = []
    for lab in ('before', 'after'):
        sl = Image.open(shots / f'ba-dan-demo/{lab}/canvas/slice-1x.png')
        rows.append(label(stack([sl.crop(b).resize(((b[2] - b[0]) * 4, (b[3] - b[1]) * 4), Image.NEAREST) for b in boxes.values()], horizontal=True), lab + ': Gao, Mira, household adult (4x)'))
    stack(rows).save(o / 'ba-dan-figures-4x.png')
    b = (480, 330, 900, 545); rows = []
    for lab in ('before', 'after'):
        im = Image.open(shots / f'forest-g1/{lab}/canvas/aim-bandit-in-oil-96.png').crop(b)
        rows.append(label(im.resize((im.width * 2, im.height * 2), Image.NEAREST), lab + ': Kaya and the thug at 96 px tiles (2x)'))
    stack(rows).save(o / 'forest-bandit-2x.png')


def head(im, w):
    # The head is the first row of ink wider than a spear or a stick (a quarter of the crop), not the topmost pixel.
    a = np.asarray(im)[..., 3] > 127; widths = a.sum(1); top = int(np.nonzero(widths >= w // 4)[0][0])
    band = a[top:top + w // 3]; best = max(range(a.shape[1]), key=lambda x: band[:, max(0, x - w // 4):x + w // 4].sum()); cx = best
    return im.crop((cx - w // 2, top - 2, cx + w // 2, top - 2 + w))


def faces():
    cols = []
    for n in C:
        cells = []
        for d in ('south', 'south-east'):
            ref = Image.open(HERE / f'ref/{n}/idle/{d}/00.png').convert('RGBA')
            g1 = Image.open(HERE / f'cels/{n}/idle{"South" if d == "south" else "SouthEast"}/00.png').convert('RGBA')
            cells += [on_bg(head(ref, 48), 2), on_bg(head(g1, 24), 4)]
        cols.append(label(stack([stack(cells[0:2], gap=2), stack(cells[2:4], gap=2)], horizontal=True, gap=4), n))
    stack(cols, horizontal=True).save(OUT / 'faces/faces-4x-before-after.png')


def walks():
    rows = []
    for n in C:
        ref = [Image.open(HERE / f'ref/{n}/walk/south-east/{i:02d}.png').convert('RGBA') for i in range(8)]
        ref = [r.resize((r.width // 2, r.height // 2), Image.LANCZOS) for r in ref]   # as the game drew the 2x sheet
        g1 = [Image.open(HERE / f'cels/{n}/walkSouthEast/{i:02d}.png').convert('RGBA') for i in range(8)]
        rows.append(label(stack([stack([on_bg(c, 3) for c in ref], gap=2, horizontal=True),
                                 stack([on_bg(c, 3) for c in g1], gap=2, horizontal=True)], gap=2), n + ': before / after'))
    stack(rows).save(OUT / 'walk/walk-se-before-after.png')


if __name__ == '__main__':
    ingame(Path(sys.argv[1])); faces(); walks(); print('written')
