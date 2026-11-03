"""Cut the party's shipped G cels out of the shipped atlases (read only) into ../ref/<char>/<clip>/<dir>/NN.png.

usage (repo root): python3 -I art/source/party-g1/tools/extract.py
The atlases are public/art/units/<char>-g*.webp: 128x192 frames, 128 sheet px per 64 world px tile, foot baseline at 85%.
These are exactly what the game draws today (lossy WebP q90 included), so "current party" in every sheet is the shipped cel.
"""
import json, os, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
UNITS = ROOT / 'public/art/units'
OUT = Path(__file__).resolve().parent.parent / 'ref'
CHARS = ['kaya', 'sura', 'bo']
# atlas clip suffix -> heading (the east clips carry no suffix)
DIRS = {'': 'east', 'SouthEast': 'south-east', 'South': 'south', 'SouthWest': 'south-west', 'West': 'west',
        'NorthWest': 'north-west', 'North': 'north', 'NorthEast': 'north-east'}


def cels(char):
    out = {}
    for page in sorted(UNITS.glob(f'{char}-g*.json')):
        if page.stem.endswith(('clips', 'bend')): continue
        d = json.load(open(page)); im = None
        for k, v in d['frames'].items():
            _, clip, i = k.split('/')
            for kind in ('idle', 'walk', 'stance'):
                if clip.startswith(kind) and clip[len(kind):] in DIRS:
                    if im is None: im = Image.open(page.with_suffix('.webp')).convert('RGBA')
                    f = v['frame']
                    out[(kind, DIRS[clip[len(kind):]], int(i))] = im.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
    return out


if __name__ == '__main__':
    for c in CHARS:
        got = cels(c)
        for (kind, d, i), im in got.items():
            p = OUT / c / kind / d / f'{i:02d}.png'; p.parent.mkdir(parents=True, exist_ok=True); im.save(p)
        idle = got[('idle', 'south', 0)]; bb = idle.getchannel('A').point(lambda a: 255 if a > 127 else 0).getbbox()
        print(c, len(got), 'cels; idle south bbox', bb, 'height', bb[3] - bb[1])
