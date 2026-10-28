"""Review strips for the jog (ADR 0095): per figure, its walk over its jog in all eight headings, at 3x, foot line in red,
and a GIF of the jog in every heading at the cadence the brisk 500 ms a tile plays it. Reads the packed cels.

python3 -I art/source/jog-g1/tools/strips.py   (writes art/source/jog-g1/review/strips/)
"""
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / 'art/source/jog-g1/review/strips'
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CAMEL = {'east': '', 'south-east': 'SouthEast', 'south': 'South', 'south-west': 'SouthWest', 'west': 'West',
         'north-west': 'NorthWest', 'north': 'North', 'north-east': 'NorthEast'}
FAMILIES = (('party-g1', ['kaya', 'sura', 'bo']),
            ('residents-g1', ['household', 'watch', 'mira', 'gao', 'pella', 'dorin', 'thug', 'slinger', 'bruiser']))
S = 3
BG = (205, 200, 185, 255)


def cels(fam, name, clip):
    pack = json.loads((REPO / f'art/source/{fam}/cels/{name}/pack.json').read_text())
    return [Image.open(REPO / f'art/source/{fam}/cels/{name}/{f}').convert('RGBA') for f in pack['clips'][clip]['cels']]


def strip(fam, name):
    rows = []
    for d in DIRS:
        for base in ('walk', 'jog'):
            ims = cels(fam, name, base + CAMEL[d])
            W, H = ims[0].size
            row = Image.new('RGBA', (W * 12 * S, H * S), BG)
            dr = ImageDraw.Draw(row)
            for i, im in enumerate(ims):
                row.alpha_composite(im.resize((W * S, H * S), Image.NEAREST), (i * W * S, 0))
            y = round(0.85 * H) * S
            dr.line([(0, y), (row.width, y)], fill=(200, 40, 40, 255))
            dr.text((4, 4), f'{name} {base} {d}', fill=(0, 0, 0, 255))
            rows.append(row)
    out = Image.new('RGBA', (rows[0].width, sum(r.height for r in rows)), BG)
    y = 0
    for r in rows:
        out.paste(r, (0, y)); y += r.height
    out.convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(
        OUT / f'{name}-walk-jog.png', optimize=True)


def east_loop(name):
    """Tiles one jog loop covers east, from the manifest's G1_JOG table."""
    src = (REPO / 'src/content/assets/manifest.ts').read_text()
    return float(re.search(rf'\n  {name}: ([0-9.]+),', src[src.index('G1_JOG'):]).group(1))


def gif(fam, name):
    """Every heading's jog side by side, each cel held for the time it lasts at 500 ms a tile on that heading."""
    loops = {d: cels(fam, name, 'jog' + CAMEL[d]) for d in DIRS}
    W, H = loops['east'][0].size
    frames = []
    for i in range(10):
        f = Image.new('RGBA', (W * 8 * 2, H * 2), BG)
        for k, d in enumerate(DIRS):
            f.alpha_composite(loops[d][i].resize((W * 2, H * 2), Image.NEAREST), (k * W * 2, 0))
        frames.append(f.convert('RGB'))
    # One cadence for the strip: the east loop's at 500 ms a tile (G1_JOG tiles a 10-cel loop).
    ms = round(500 * east_loop(name) / 10)
    frames[0].save(OUT / f'{name}-jog.gif', save_all=True, append_images=frames[1:], duration=ms, loop=0)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for fam, names in FAMILIES:
        for n in names:
            strip(fam, n); gif(fam, n)
    print('wrote', OUT)
