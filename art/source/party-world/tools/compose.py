"""Step 2a: the restyle inputs. The curated party-g1 roots (idle and stance, all eight headings), scaled 1.25 (Lanczos,
premultiplied, binary alpha) to the world's adult height (~74 world px) and set on a 512x512 crop of the world painting
(world-g1-grounded.png), sixteen figures a job: one heading a column... four columns, four rows, a figure a 128 cell
with its sole on row 112. #317's restyle input, extended from four diagonals to eight headings.

usage (repo root): python3 -I art/source/party-world/tools/compose.py
Writes inputs/job<N>.png, inputs/job<N>-mask.png (the figures' placed alpha) and inputs/layout.json."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parent.parent
ROOT = HERE.parent
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
SCALE, CELL, FOOT = 1.25, 128, 112
CROP = (1040, 980, 1552, 1492)   # #317's crop: paving and grass by Gao's market
# Sixteen figures a job: two (character, kind) groups of eight headings.
JOBS = [[('kaya', 'idle'), ('sura', 'idle')], [('bo', 'idle'), ('kaya', 'stance')], [('sura', 'stance'), ('bo', 'stance')]]


def scaled(char, kind, d):
    im = Image.open(ROOT / f'party-g1/roots/{char}/{kind}/{d}.png').convert('RGBA')
    a = np.asarray(im); ys, xs = np.nonzero(a[..., 3] > 0)
    im = im.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3))
    w, h = round(im.width * SCALE), round(im.height * SCALE)
    p = np.asarray(im).astype(np.float32); p[..., :3] *= p[..., 3:] / 255
    ch = [np.asarray(Image.fromarray(p[..., i]).resize((w, h), Image.LANCZOS)) for i in range(4)]
    al = np.clip(ch[3], 0, 255); col = np.stack([np.clip(c / np.maximum(al, 1e-3) * 255, 0, 255) for c in ch[:3]], -1)
    return Image.fromarray(np.dstack([col.astype(np.uint8), np.where(al >= 128, 255, 0).astype(np.uint8)]))


def main():
    world = Image.open(ROOT / 'ba-dan-route-a/world/world-g1-grounded.png').convert('RGB')
    layout = []
    (HERE / 'inputs').mkdir(exist_ok=True)
    for j, groups in enumerate(JOBS):
        comp = world.crop(CROP).convert('RGBA'); mask = Image.new('L', comp.size, 0)
        for g, (char, kind) in enumerate(groups):
            for k, d in enumerate(DIRS):
                r, c = g * 2 + k // 4, k % 4
                fig = scaled(char, kind, d); a = np.asarray(fig)[..., 3]; ys, xs = np.nonzero(a)
                x0 = int(round(c * CELL + CELL / 2 - (xs.min() + xs.max()) / 2)); y0 = int(r * CELL + FOOT - ys.max())
                comp.alpha_composite(fig, (x0, y0)); mask.paste(255, (x0, y0), fig.split()[3])
                layout.append(dict(job=j, char=char, kind=kind, dir=d, x=x0, y=y0, w=fig.width, h=fig.height,
                                   height=int(ys.max() - ys.min() + 1)))
        comp.convert('RGB').save(HERE / f'inputs/job{j}.png'); mask.save(HERE / f'inputs/job{j}-mask.png')
    json.dump(dict(crop=CROP, scale=SCALE, cell=CELL, foot=FOOT, figures=layout), open(HERE / 'inputs/layout.json', 'w'), indent=1)
    print(len(layout), 'figures', sorted({f['height'] for f in layout}))


if __name__ == '__main__':
    main()
