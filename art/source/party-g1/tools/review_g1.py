"""Rollout review sheets and metrics, from the assembled cels (cels/<char>/, assemble.py). Nothing here ships.

usage (repo root): python3 -I art/source/party-g1/tools/review_g1.py
Writes review/rollout/: walk-strip-<char>.png (eight headings x 12 cels), walk-<char>.gif, faces-4x.png, idle-stance.png,
bend-<char>.png, hit-<char>.png, ko-<char>.png, and metrics.json (boil, colours, contour, foot rows).
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).parent))
from review import boil, colours, contour
HERE = Path(__file__).resolve().parent.parent
OUT = HERE / 'review/rollout'
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CAMEL = {'east': '', 'south-east': 'SouthEast', 'south': 'South', 'south-west': 'SouthWest', 'west': 'West',
         'north-west': 'NorthWest', 'north': 'North', 'north-east': 'NorthEast'}
BG = (112, 128, 92, 255)


def hc(base, d): return base + CAMEL[d]


def cels(char, clip):
    p = json.load(open(HERE / f'cels/{char}/pack.json'))['clips'][clip]
    return [Image.open(HERE / f'cels/{char}/{f}').convert('RGBA') for f in p['cels']], p


def grid(rows, S=4, label=None):
    cw = max(im.width for r in rows for im in r) * S; ch = max(im.height for r in rows for im in r) * S
    out = Image.new('RGBA', (cw * max(len(r) for r in rows), ch * len(rows)), BG)
    for y, r in enumerate(rows):
        for x, im in enumerate(r):
            out.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x * cw + (cw - im.width * S) // 2, y * ch + ch - im.height * S))
    if label:
        dr = ImageDraw.Draw(out)
        for y, t in enumerate(label): dr.text((4, y * ch + 4), t, fill=(255, 255, 255, 255))
    return out


def lowest(im):
    ys = np.nonzero(np.asarray(im)[..., 3] > 127)[0]; return int(ys.max())


def main():
    OUT.mkdir(parents=True, exist_ok=True); M = {}
    for c in ['kaya', 'sura', 'bo']:
        m = M.setdefault(c, {})
        rows = []
        for d in DIRS:
            w, p = cels(c, hc('walk', d)); rows.append(w)
            idle, _ = cels(c, hc('idle', d)); st, _ = cels(c, hc('stance', d))
            m[d] = dict(
                idle_boil_max=round(max(boil(idle[i], idle[(i + 1) % 4]) for i in range(4)), 3),
                stance_boil_max=round(max(boil(st[i], st[(i + 1) % 8]) for i in range(8)), 3),
                walk_boil_mean=round(float(np.mean([boil(w[i], w[(i + 1) % 12]) for i in range(12)])), 3),
                colours=colours(idle[0]), contour=contour(idle[0])[0],
                idle_foot=lowest(idle[0]), walk_foot_rows=[lowest(x) for x in w])
        grid(rows, label=DIRS).save(OUT / f'walk-strip-{c}.png')
        frames = []
        for i in range(12):
            frames.append(grid([[r[i] for r in rows]], S=3).convert('RGB'))
        frames[0].save(OUT / f'walk-{c}.gif', save_all=True, append_images=frames[1:], duration=114, loop=0)
        for kind in ['bend', 'hit']:
            rr = [cels(c, kind + (CAMEL[d] or 'East'))[0] for d in DIRS]
            grid(rr, label=DIRS).save(OUT / f'{kind}-{c}.png')
        rr = [cels(c, 'ko' + CAMEL[d])[0] for d in ['south-east', 'south-west', 'north-east', 'north-west']]
        grid(rr).save(OUT / f'ko-{c}.png')
    # faces: the head of each idle root, 4x, three characters by eight headings
    rows = []
    for c in ['kaya', 'sura', 'bo']:
        r = []
        for d in DIRS:
            im, _ = cels(c, hc('idle', d)); a = np.asarray(im[0])[..., 3] > 127; ys, xs = np.nonzero(a)
            top = ys.min(); r.append(im[0].crop((max(0, xs.min() - 2), top - 2, min(64, xs.max() + 3), top + 22)))
        rows.append(r)
    grid(rows, S=4).save(OUT / 'faces-4x.png')
    rows = []
    for c in ['kaya', 'sura', 'bo']:
        rows.append([cels(c, hc('idle', d))[0][0] for d in DIRS]); rows.append([cels(c, hc('stance', d))[0][0] for d in DIRS])
    grid(rows).save(OUT / 'idle-stance.png')
    json.dump(M, open(OUT / 'metrics.json', 'w'), indent=1)
    for c in M:
        print(c, 'idle boil max', max(v['idle_boil_max'] for v in M[c].values()), 'stance boil max', max(v['stance_boil_max'] for v in M[c].values()))


if __name__ == '__main__':
    main()
