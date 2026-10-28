"""Step 9: review sheets of the assembled cels (cels/<name>/) into review/.

usage (repo root): python3 -I art/source/residents-g1/tools/review_g1.py [name ...]
Writes, per name:
- review/walk/<name>-walk.png: the eight headings, idle cel 0 then the 8 walk cels and the rest cel, at 3x on a ground tone,
  with the foot line marked; review/walk/<name>-walk-<dir>.gif at 114 ms a cel (the manifest's rate), 3x.
- review/faces/<name>-faces-4x.png: the head of idle cel 0 in S, SE, E and SW at 4x, nearest neighbour.
- review/actions/<name>-actions.png (bandits): the hits (8 headings), the knockouts (4 diagonals) and the legacy cast, hit, KO.
And review/metrics.json: colours a cel, idle boil, walk contact rows and the walk's mean foot row against idle's.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent.parent
C = json.load(open(HERE / 'tools/chars.json'))
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CAMEL = {'east': '', 'south-east': 'SouthEast', 'south': 'South', 'south-west': 'SouthWest', 'west': 'West',
         'north-west': 'NorthWest', 'north': 'North', 'north-east': 'NorthEast'}
BG = (112, 128, 96, 255)
S = 3


def cels(name, clip):
    d = HERE / f'cels/{name}/{clip}'
    return [Image.open(p).convert('RGBA') for p in sorted(d.glob('*.png'))]


def tile(im, s=S, bg=BG):
    out = Image.new('RGBA', im.size, bg); out.alpha_composite(im); return out.resize((im.width * s, im.height * s), Image.NEAREST)


def lowest(im):
    a = np.asarray(im)[..., 3] > 127; ys = np.nonzero(a.any(1))[0]; return int(ys.max())


def walk_sheet(name):
    fw = C[name]['frame_w']; line = int(round(0.85 * 96))
    rows = []
    for d in DIRS:
        row = cels(name, 'idle' + CAMEL[d])[:1] + cels(name, 'walk' + CAMEL[d]) + cels(name, 'rest' + CAMEL[d])
        rows.append(row)
        frames = [tile(c) for c in cels(name, 'walk' + CAMEL[d])]
        out = HERE / f'review/walk/{name}-walk-{d}.gif'; out.parent.mkdir(parents=True, exist_ok=True)
        frames[0].save(out, save_all=True, append_images=frames[1:], duration=114, loop=0, disposal=2)
    W = 10 * (fw * S + 4); H = 8 * (96 * S + 4)
    sh = Image.new('RGBA', (W, H), (40, 40, 40, 255)); dr = ImageDraw.Draw(sh)
    for r, row in enumerate(rows):
        for c, im in enumerate(row):
            x, y = c * (fw * S + 4), r * (96 * S + 4); sh.alpha_composite(tile(im), (x, y))
            dr.line([(x, y + line * S + S - 1), (x + fw * S, y + line * S + S - 1)], fill=(255, 220, 80, 120))
        dr.text((2, r * (96 * S + 4) + 2), DIRS[r], fill=(255, 255, 255))
    out = HERE / f'review/walk/{name}-walk.png'; sh.save(out)


def faces(name):
    fw = C[name]['frame_w']; out = []
    for d in ['south', 'south-east', 'east', 'south-west']:
        im = cels(name, 'idle' + CAMEL[d])[0]; a = np.asarray(im)[..., 3] > 127; ys, xs = np.nonzero(a)
        top = ys.min(); cx = int(np.median(xs[ys < top + 14]))
        box = (max(0, cx - 12), max(0, top - 2), min(fw, cx + 12), top + 22)
        out.append(tile(im.crop(box), 4 * 2))
    W = sum(o.width + 8 for o in out); sh = Image.new('RGBA', (W, max(o.height for o in out)), (40, 40, 40, 255)); x = 0
    for o in out: sh.alpha_composite(o, (x, 0)); x += o.width + 8
    p = HERE / f'review/faces/{name}-faces-4x.png'; p.parent.mkdir(parents=True, exist_ok=True); sh.save(p)


def actions(name):
    rows = [[c for d in DIRS for c in cels(name, 'hit' + CAMEL[d])[:4]]]
    rows += [cels(name, 'ko' + CAMEL[d]) for d in ['south-east', 'south-west', 'north-east', 'north-west']]
    rows += [cels(name, 'cast') + cels(name, 'hit') + cels(name, 'ko')]
    s = 2; W = max(sum(c.width * s + 4 for c in r) for r in rows); H = sum(max(c.height for c in r) * s + 4 for r in rows)
    sh = Image.new('RGBA', (W, H), (40, 40, 40, 255)); y = 0
    for r in rows:
        x = 0
        for c in r: sh.alpha_composite(tile(c, s), (x, y)); x += c.width * s + 4
        y += max(c.height for c in r) * s + 4
    p = HERE / f'review/actions/{name}-actions.png'; p.parent.mkdir(parents=True, exist_ok=True); sh.save(p)


def boil(a, b):
    A = np.asarray(a)[..., 3] > 127; B = np.asarray(b)[..., 3] > 127; best = 1.0
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            Bs = np.roll(np.roll(B, dy, 0), dx, 1); best = min(best, float((A ^ Bs).sum() / max(A.sum(), 1)))
    return best


def metrics(name):
    pack = json.load(open(HERE / f'cels/{name}/pack.json')); m = {}
    for d in DIRS:
        idle = cels(name, 'idle' + CAMEL[d]); walk = cels(name, 'walk' + CAMEL[d])
        cols = [len({tuple(p) for p in np.asarray(c).reshape(-1, 4) if p[3]}) for c in idle + walk]
        cr = pack['placement'][d]['contact_rows']
        m[d] = dict(colours=[min(cols), max(cols)], idle_boil=round(max(boil(idle[0], c) for c in idle[1:]), 3),
                    contact_rows=[lowest(walk[cr['LA']['cel']]), lowest(walk[cr['RA']['cel']])],
                    walk_mean_minus_idle=round(float(np.mean([lowest(c) for c in walk])) - lowest(idle[0]), 2))
    return m


if __name__ == '__main__':
    names = sys.argv[1:] or list(C)
    path = HERE / 'review/metrics.json'
    allm = json.load(open(path)) if path.exists() else {}
    for n in names:
        walk_sheet(n); faces(n)
        if C[n]['kind'] == 'bandit': actions(n)
        allm[n] = metrics(n); print(n, 'reviewed')
    json.dump(allm, open(path, 'w'), indent=1)
