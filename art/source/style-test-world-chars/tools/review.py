"""Step 9: review files from the Playwright captures (.shots/style-test/<style>/) and the cels. No PixelLab calls.

usage (repo root): python3 -I art/source/style-test-world-chars/tools/review.py
- review/slice-current-vs-world.png: the slice at the scene's default zoom (128 px tiles, N = 2), shipped figures above,
  test figures below, same camera, positions and moment.
- review/crops-4x.png: Gao by his door and the party by the market table, 4 screen px a world px (the N = 2 capture
  doubled, nearest), current left, test right.
- review/walk-<char>.png: each heading (rows SE, SW, NE, NW): idle, its breath cel, then the six walk cels, 4x, on the
  world's paving; review/walk-<char>.gif at the measured in-game cel time.
- review/roots-restyle.png: each source figure (G1 root x1.25) beside its world restyle, 3x.
- review/metrics.json: per heading, height, colours a cel, and walk boil (share of the figure above the hips that changes
  between consecutive cels after the best 2 px shift)."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pairs
HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parents[2]
SHOTS = REPO / '.shots/style-test'
OUT = HERE / 'review'
CHARS = ['kaya', 'sura', 'bo', 'gao']; DIRS = ['south-east', 'south-west', 'north-east', 'north-west']


def slices():
    a = Image.open(SHOTS / 'current/slice.png').convert('RGB'); b = Image.open(SHOTS / 'world/slice.png').convert('RGB')
    o = Image.new('RGB', (a.width, a.height * 2 + 8), (20, 20, 20)); o.paste(a, (0, 0)); o.paste(b, (0, a.height + 8))
    o.save(OUT / 'slice-current-vs-world.png')
    P = json.load(open(SHOTS / 'world/provenance.json'))['figures']
    boxes = [('gao-door', (P['gao']['x'] - 70, P['gao']['y'] - 190, P['gao']['x'] + 90, P['gao']['y'] + 30)),
             ('market-table', (P['leader']['x'] - 230, P['leader']['y'] - 140, P['leader']['x'] + 110, P['leader']['y'] + 110))]
    rows = []
    for name, bx in boxes:
        ca, cb = a.crop(bx), b.crop(bx); w, h = ca.size
        r = Image.new('RGB', (w * 4 + 8, h * 2), (20, 20, 20))
        r.paste(ca.resize((w * 2, h * 2), Image.NEAREST), (0, 0)); r.paste(cb.resize((w * 2, h * 2), Image.NEAREST), (w * 2 + 8, 0))
        r.save(OUT / f'crop-4x-{name}.png'); rows.append(r)


def walks(cel_ms):
    pave = Image.open(REPO / 'art/source/ba-dan-route-a/world/world-g1-grounded.png').convert('RGBA').crop((1300, 1200, 1396, 1300))
    for c in CHARS:
        sh = Image.new('RGBA', (8 * 96, 4 * 100))
        frames = []
        for r, d in enumerate(DIRS):
            cels = [HERE / f'cels/{c}/idle/{d}/0{i}.png' for i in range(2)] + [HERE / f'cels/{c}/walk/{d}/{i:02d}.png' for i in range(6)]
            for i, p in enumerate(cels):
                bg = pave.copy(); bg.alpha_composite(Image.open(p).convert('RGBA').crop((16, 22, 112, 122))); sh.paste(bg, (i * 96, r * 100))
            row = []
            for i in range(6):
                bg = pave.copy(); bg.alpha_composite(Image.open(cels[2 + i]).convert('RGBA').crop((16, 22, 112, 122)))
                row.append(bg.resize((192, 200), Image.NEAREST))
            frames.append(row)
        sh.resize((sh.width * 4, sh.height * 4), Image.NEAREST).save(OUT / f'walk-{c}.png')
        g = [Image.new('RGB', (192 * 4, 200)) for _ in range(6)]
        for i in range(6):
            for r in range(4): g[i].paste(frames[r][i].convert('RGB'), (r * 192, 0))
        g[0].save(OUT / f'walk-{c}.gif', save_all=True, append_images=g[1:], duration=cel_ms[c], loop=0)


def boil(a, b):
    ma, mb = a[..., 3] > 0, b[..., 3] > 0; best = 1
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            s = np.roll(np.roll(b, dy, 0), dx, 1); sm = s[..., 3] > 0
            both = ma | sm; diff = both & ((ma != sm) | (np.abs(a[..., :3].astype(int) - s[..., :3]).sum(-1) > 30))
            best = min(best, diff.sum() / max(both.sum(), 1))
    return best


def metrics():
    stride = json.load(open(HERE / 'stride.json')); rep = {}
    for c in CHARS:
        for d in DIRS:
            cels = [np.asarray(Image.open(HERE / f'cels/{c}/walk/{d}/{i:02d}.png')) for i in range(6)]
            sk = json.load(open(HERE / f'roots/{c}/skeleton/{d}.json')); P = {k['label']: k['y'] * 128 for k in sk['keypoints']}
            hip = int((P['LEFT HIP'] + P['RIGHT HIP']) / 2)
            up = [x[:hip] for x in cels]
            b = [round(boil(up[i], up[(i + 1) % 6]), 3) for i in range(6)]
            cols = [len(np.unique(x[..., :3][x[..., 3] > 0].reshape(-1, 3), axis=0)) for x in cels]
            s = stride[f'{c}/{d}']
            rep[f'{c}/{d}'] = dict(height=s['height'], root_colours=s['colours'], walk_colours=[min(cols), max(cols)],
                                   upper_boil=[min(b), max(b)], back_per_cel=s['back_per_cel'], loop_tiles=s['loop_tiles'],
                                   pair_travel=[p['along'] for p in s['pairs']],
                                   cel_ms_at_750=round(750 * s['loop_tiles'] / 6, 1))
    json.dump(rep, open(OUT / 'metrics.json', 'w'), indent=1)
    return rep


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    pairs.main('raw/r1-roots-s11/00.png', OUT / 'roots-restyle.png', 3)
    slices()
    m = metrics()
    cel = {c: int(round(np.mean([m[f'{c}/{d}']['cel_ms_at_750'] for d in DIRS]))) for c in CHARS}
    walks(cel)
    for k, v in m.items(): print(k, v)
