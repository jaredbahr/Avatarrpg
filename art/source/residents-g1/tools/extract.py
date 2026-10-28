"""Step 0a: cut the shipped G cels of the residents and bandits out of the shipped atlases (read only) into ../ref/<name>/<clip>/<dir>/NN.png.

usage (repo root): python3 -I art/source/residents-g1/tools/extract.py [name ...]
The atlases are public/art/units/<name>-g.webp at 2 sheet px per world px (a 128x192 cel; the bruiser's 160x192), foot
baseline at 85%. Idle and walk in eight headings, and the bandits' legacy mirrored cast (east) as ref/<name>/cast/east/.
Run it on main's sheets: after the rebuild ships, the atlases are the G1 ones.
"""
import json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
UNITS = ROOT / 'public/art/units'
HERE = Path(__file__).resolve().parent.parent
OUT = HERE / 'ref'
C = json.load(open(HERE / 'tools/chars.json'))
DIRS = {'': 'east', 'SouthEast': 'south-east', 'South': 'south', 'SouthWest': 'south-west', 'West': 'west',
        'NorthWest': 'north-west', 'North': 'north', 'NorthEast': 'north-east'}


def cels(name):
    d = json.load(open(UNITS / f'{name}-g.json')); im = Image.open(UNITS / f'{name}-g.webp').convert('RGBA'); out = {}
    for k, v in d['frames'].items():
        _, clip, i = k.split('/'); f = v['frame']
        box = (f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])
        if clip == 'cast': out[('cast', 'east', int(i))] = im.crop(box); continue
        for kind in ('idle', 'walk'):
            if clip.startswith(kind) and clip[len(kind):] in DIRS:
                out[(kind, DIRS[clip[len(kind):]], int(i))] = im.crop(box)
    return out


if __name__ == '__main__':
    for n in sys.argv[1:] or list(C):
        got = cels(n)
        for (kind, d, i), im in got.items():
            p = OUT / n / kind / d / f'{i:02d}.png'; p.parent.mkdir(parents=True, exist_ok=True); im.save(p)
        idle = got[('idle', 'south', 0)]; bb = idle.getchannel('A').point(lambda a: 255 if a > 127 else 0).getbbox()
        print(n, len(got), 'cels; frame', idle.size, 'idle south bbox', bb)
