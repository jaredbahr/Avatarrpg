"""Before and after sheets for the figure shadow pass (ADR 0093's figure amendment). No generation.

Reads the review captures:
- .shots/style-test/<before|after>-<current|world>-<canvas|webgl>/ (e2e/style-test.review.ts with FNT_STYLE_LABEL,
  FNT_STYLE and FNT_STYLE_RENDERER), the "before" ones taken from a checkout of main;
- .shots/grounding/<before|after>/canvas/ (e2e/grounding.review.ts with FNT_GROUNDING_LABEL).
`BEFORE_ROOT` is the before checkout's root (default: this repository).

Writes art/source/grounding/review/figure-shadows/:
- crop-4x-<gao-door|market-table>-<renderer>.png: rows the shipped figures and ?style=world, columns before and
  after, 4 screen px a world px (the N = 2 capture doubled, nearest);
- slice-canvas.png: the whole Ba Dan slice, before above after, for the shipped figures and ?style=world;
- forest-bank.png: the first fight on the bank at N = 2 (Canvas), before above after.

usage (repo root): BEFORE_ROOT=<main checkout> python3 -I art/source/grounding/tools/figure_shadow_review.py
"""
import json
import os
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[4]
BEFORE = Path(os.environ.get('BEFORE_ROOT', REPO))
OUT = REPO / 'art/source/grounding/review/figure-shadows'
GAP = 8
BG = (20, 20, 20)


def shot(when, style, renderer):
    root = BEFORE if when == 'before' else REPO
    folder = root / f'.shots/style-test/{when}-{style}-{renderer}'
    return Image.open(folder / 'slice.png').convert('RGB'), json.load(open(folder / 'provenance.json'))['figures']


def grid(cells):
    """cells: rows of images, all one size."""
    w, h = cells[0][0].size
    out = Image.new('RGB', (len(cells[0]) * (w + GAP) - GAP, len(cells) * (h + GAP) - GAP), BG)
    for r, row in enumerate(cells):
        for c, im in enumerate(row):
            out.paste(im, (c * (w + GAP), r * (h + GAP)))
    return out


def crops(renderer):
    shots = {(when, style): shot(when, style, renderer) for when in ('before', 'after') for style in ('current', 'world')}
    figures = shots[('after', 'world')][1]
    boxes = {
        'gao-door': lambda p: (p['gao']['x'] - 70, p['gao']['y'] - 190, p['gao']['x'] + 90, p['gao']['y'] + 30),
        'market-table': lambda p: (p['leader']['x'] - 230, p['leader']['y'] - 140, p['leader']['x'] + 110,
                                   p['leader']['y'] + 110),
    }
    for name, box in boxes.items():
        bx = box(figures)
        rows = []
        for style in ('current', 'world'):
            row = []
            for when in ('before', 'after'):
                im = shots[(when, style)][0].crop(bx)
                row.append(im.resize((im.width * 2, im.height * 2), Image.NEAREST))
            rows.append(row)
        grid(rows).save(OUT / f'crop-4x-{name}-{renderer}.png', optimize=True)
    if renderer == 'canvas':  # the crops carry WebGL; one whole slice is enough
        grid([[shots[(w, s)][0] for s in ('current', 'world')] for w in ('before', 'after')]).save(
            OUT / f'slice-{renderer}.png', optimize=True)


def forest():
    ims = [Image.open((BEFORE if w == 'before' else REPO) / f'.shots/grounding/{w}/canvas/forest-wide-bank-N2.png')
           .convert('RGB') for w in ('before', 'after')]
    grid([[ims[0]], [ims[1]]]).save(OUT / 'forest-bank.png', optimize=True)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for renderer in ('canvas', 'webgl'):
        crops(renderer)
    forest()
    for p in sorted(OUT.iterdir()):
        print(p.name, Image.open(p).size, p.stat().st_size // 1024, 'KB')
