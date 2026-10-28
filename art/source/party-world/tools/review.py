"""Step 11: the review files (no generation). Before is main under `?style=world` (#317's figures: locomotion only, the
combat clips falling back to the idle); after is this change under `?style=world`.

Reads .shots/style-test/<before|after>-world-canvas/ (e2e/style-test.review.ts, FNT_STYLE=world, FNT_STYLE_LABEL) and
.shots/forest-g1/<before|after>/canvas/ (e2e/forest-g1.review.ts, FNT_FOREST_G1_QUERY='&style=world'), the before ones
from a checkout of main at BEFORE_ROOT, and the cels.

Writes review/:
- slice.png: the Ba Dan slice at N = 2, before above after;
- crop-4x-gao-door.png, crop-4x-market-table.png: 4x, before left, after right;
- forest-bend.png: Kaya's Fire Jab landing in the first fight, before above after;
- <char>-clips.png: every heading (rows, HEADINGS order) of idle, the six walk cels, stance, the hit's three, 2x;
- <char>-combat.png: the four knockouts and the east, south and north bends, 1x on 192 cels.

usage (repo root): BEFORE_ROOT=<main checkout> python3 -I art/source/party-world/tools/review.py"""
import json, os
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parents[2]
BEFORE = Path(os.environ.get('BEFORE_ROOT', REPO))
OUT = HERE / 'review'
DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']
BG = (138, 124, 96, 255)


def stack(ims, vertical=True, gap=8):
    w = max(i.width for i in ims) if vertical else sum(i.width for i in ims) + gap * (len(ims) - 1)
    h = sum(i.height for i in ims) + gap * (len(ims) - 1) if vertical else max(i.height for i in ims)
    o = Image.new('RGB', (w, h), (20, 20, 20)); p = 0
    for i in ims:
        o.paste(i, (0, p) if vertical else (p, 0)); p += (i.height if vertical else i.width) + gap
    return o


def slices():
    a = Image.open(BEFORE / '.shots/style-test/before-world-canvas/slice.png').convert('RGB')
    b = Image.open(REPO / '.shots/style-test/after-world-canvas/slice.png').convert('RGB')
    stack([a, b]).save(OUT / 'slice.png', optimize=True)
    P = json.load(open(REPO / '.shots/style-test/after-world-canvas/provenance.json'))['figures']
    for name, bx in (('gao-door', (P['gao']['x'] - 70, P['gao']['y'] - 190, P['gao']['x'] + 90, P['gao']['y'] + 30)),
                     ('market-table', (P['leader']['x'] - 230, P['leader']['y'] - 140, P['leader']['x'] + 110, P['leader']['y'] + 110))):
        ca, cb = a.crop(bx), b.crop(bx)
        stack([c.resize((c.width * 2, c.height * 2), Image.NEAREST) for c in (ca, cb)], vertical=False).save(
            OUT / f'crop-4x-{name}.png', optimize=True)


def forest():
    for name, files in (('forest-bend', ['bend-01.png', 'bend-02.png']),):
        rows = []
        for root, label in ((BEFORE, 'before'), (REPO, 'after')):
            rows.append(stack([Image.open(root / f'.shots/forest-g1/{label}/canvas/{f}').convert('RGB') for f in files], vertical=False))
        stack(rows).save(OUT / f'{name}.png', optimize=True)


def cels(char):
    c = HERE / f'cels/{char}'
    def cell(p, box=(20, 24, 108, 124)):
        bg = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), BG); bg.alpha_composite(Image.open(p).convert('RGBA').crop(box)); return bg
    rows = []
    for d in DIRS:
        ims = [cell(c / f'idle/{d}/00.png')] + [cell(c / f'walk/{d}/{i:02d}.png') for i in range(6)] + \
              [cell(c / f'stance/{d}/00.png')] + [cell(c / f'hit/{d}/{i:02d}.png') for i in (1, 2, 3)]
        rows.append(stack([i.convert('RGB') for i in ims], vertical=False, gap=2))
    s = stack(rows, gap=2); s.resize((s.width * 2, s.height * 2), Image.NEAREST).save(OUT / f'{char}-clips.png', optimize=True)
    rows = []
    for clip, d in [('ko', 'south-east'), ('ko', 'south-west'), ('ko', 'north-east'), ('ko', 'north-west'),
                    ('bend', 'east'), ('bend', 'south'), ('bend', 'north')]:
        ims = []
        for p in sorted((c / f'{clip}/{d}').glob('*.png')):
            bg = Image.new('RGBA', (152, 152), BG); bg.alpha_composite(Image.open(p).convert('RGBA').crop((20, 20, 172, 172))); ims.append(bg.convert('RGB'))
        rows.append(stack(ims, vertical=False, gap=2))
    stack(rows, gap=2).save(OUT / f'{char}-combat.png', optimize=True)


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    slices(); forest()
    for ch in ('kaya', 'sura', 'bo'): cels(ch)
    for p in sorted(OUT.iterdir()): print(p.name, Image.open(p).size, p.stat().st_size // 1024, 'KB')
