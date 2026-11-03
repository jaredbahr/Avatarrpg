"""Step 1: the restyle input. The curated G1 idle roots (party-g1, residents-g1) of Kaya, Sura, Bo and Gao in the four
diagonal headings, scaled 1.25 (Lanczos) to the world's adult height (~74 world px, about 0.9 of Gao's door) and set on a
512x512 crop of the shipped G1 world painting (world-g1-grounded.png), one character a row, one heading a column.

usage (repo root): python3 -I art/source/style-test-world-chars/tools/compose.py
Writes inputs/composite.png, inputs/mask.png (the figures' alpha, for extraction) and inputs/layout.json."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parent.parent
ROOT = HERE.parent
CHARS = [('kaya', 'party-g1'), ('sura', 'party-g1'), ('bo', 'party-g1'), ('gao', 'residents-g1')]
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
SCALE = 1.25
CROP = tuple(int(v) for v in (sys.argv[1:5] if len(sys.argv) > 4 else (1880, 860, 2392, 1372)))
CELL = 128
FOOT = 112   # foot row inside each 128 cell


def scaled(char, src, d):
    im = Image.open(ROOT / f'{src}/roots/{char}/idle/{d}.png').convert('RGBA')
    a = np.asarray(im); ys, xs = np.nonzero(a[..., 3] > 0)
    im = im.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3))
    w, h = round(im.width * SCALE), round(im.height * SCALE)
    # premultiplied resize, so the transparent border does not darken the edge
    p = np.asarray(im).astype(np.float32); p[..., :3] *= p[..., 3:] / 255
    rgb = [np.asarray(Image.fromarray(p[..., i]).resize((w, h), Image.LANCZOS)) for i in range(4)]
    al = np.clip(rgb[3], 0, 255); col = np.stack([np.clip(c / np.maximum(al, 1e-3) * 255, 0, 255) for c in rgb[:3]], -1)
    al = np.where(al >= 128, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([col.astype(np.uint8), al]))


def main():
    world = Image.open(ROOT / 'ba-dan-route-a/world/world-g1-grounded.png').convert('RGB')
    comp = world.crop(CROP).convert('RGBA'); mask = Image.new('L', comp.size, 0); layout = []
    for r, (char, src) in enumerate(CHARS):
        for c, d in enumerate(DIRS):
            fig = scaled(char, src, d)
            a = np.asarray(fig)[..., 3]; ys, xs = np.nonzero(a)
            foot = ys.max(); cx = (xs.min() + xs.max()) / 2
            x0 = int(round(c * CELL + CELL / 2 - cx)); y0 = int(r * CELL + FOOT - foot)
            comp.alpha_composite(fig, (x0, y0)); mask.paste(255, (x0, y0), fig.split()[3])
            layout.append(dict(char=char, dir=d, x=x0, y=y0, w=fig.width, h=fig.height, height=int(ys.max() - ys.min() + 1)))
    (HERE / 'inputs').mkdir(exist_ok=True)
    comp.convert('RGB').save(HERE / 'inputs/composite.png'); mask.save(HERE / 'inputs/mask.png')
    json.dump(dict(crop=CROP, scale=SCALE, cell=CELL, figures=layout), open(HERE / 'inputs/layout.json', 'w'), indent=1)
    print([f['height'] for f in layout])


if __name__ == '__main__':
    main()
