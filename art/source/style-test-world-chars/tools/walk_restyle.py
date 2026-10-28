"""Probe: restyle one character's 24 walk cels the way the roots were (restyle.py: edit-images-v2, world prompt, seed
11) on the same world crop, 6 cels a row and one heading a row, then cut each cel back out by its own alpha and hue-lock
it to its source cel. Asks whether the walk can carry the idle's restyled texture without boiling.

usage: python3 -I tools/walk_restyle.py compose CHAR | extract CHAR RESTYLED.png"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from colour import hue_lock
HERE = Path(__file__).resolve().parent.parent
DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
CW, CH = 85, 128


def compose(char):
    L = json.load(open(HERE / 'inputs/layout.json'))
    world = Image.open(HERE.parent / 'ba-dan-route-a/world/world-g1-grounded.png').convert('RGBA').crop(tuple(L['crop']))
    mask = Image.new('L', world.size, 0); place = []
    for r, d in enumerate(DIRS):
        for i in range(6):
            cel = Image.open(HERE / f'cels/{char}/walk/{d}/{i:02d}.png').convert('RGBA')
            x0, y0 = i * CW + CW // 2 - 64, r * CH
            world.alpha_composite(cel, (max(x0, 0), y0), (max(-x0, 0), 0)); mask.paste(255, (max(x0, 0), y0), cel.split()[3].crop((max(-x0, 0), 0, 128, 128)))
            place.append(dict(dir=d, i=i, x=x0, y=y0))
    world.convert('RGB').save(HERE / f'inputs/walk-{char}.png'); mask.save(HERE / f'inputs/walk-{char}-mask.png')
    json.dump(place, open(HERE / f'inputs/walk-{char}.json', 'w'))


def extract(char, restyled):
    place = json.load(open(HERE / f'inputs/walk-{char}.json'))
    src = np.asarray(Image.open(HERE / f'inputs/walk-{char}.png').convert('RGB')); rs = np.asarray(Image.open(restyled).convert('RGB'))
    locked = hue_lock(rs, src)
    for p in place:
        cel = np.asarray(Image.open(HERE / f'cels/{char}/walk/{p["dir"]}/{p["i"]:02d}.png').convert('RGBA')).copy()
        for y in range(128):
            for x in range(128):
                X, Y = p['x'] + x, p['y'] + y
                if cel[y, x, 3] and 0 <= X < 512 and 0 <= Y < 512: cel[y, x, :3] = locked[Y, X]
        o = HERE / f'probe/walk-restyled/{char}/{p["dir"]}'; o.mkdir(parents=True, exist_ok=True)
        Image.fromarray(cel).save(o / f'{p["i"]:02d}.png')


if __name__ == '__main__':
    compose(sys.argv[2]) if sys.argv[1] == 'compose' else extract(sys.argv[2], sys.argv[3])
