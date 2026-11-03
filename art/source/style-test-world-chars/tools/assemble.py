"""Step 7: cels. For each character and heading:

- idle: the restyled root (one cel) and the same cel with the rows above the chest line lifted 1 px (a breath), 2 cels.
- walk: the take's six cels, alpha made binary, palette-locked (OKLab nearest) to the root's own colours so every cel
  shares the idle's palette and the restyle's tones, and specks under 4 px cleared. Nothing is redrawn.
- the stride: the planted foot's travel each stance cel, measured by matching the sole patch at the designed ankle
  in cel i against cel i+1 (both stance pairs of each foot), along the heading's screen diagonal.

usage: python3 -I tools/assemble.py SEED -> cels/<char>/<clip>/<dir>/NN.png, stride.json"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from colour import to_oklab
HERE = Path(__file__).resolve().parent.parent
CHARS = ['kaya', 'sura', 'bo', 'gao']; DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
AXIS = {'south-east': (0.894, 0.447), 'south-west': (-0.894, 0.447), 'north-east': (0.894, -0.447), 'north-west': (-0.894, -0.447)}
CHEST = 0.35
TILE = 71.6   # world px a tile along a screen diagonal


def islands(m):
    """8-connected components of a boolean mask, as lists of (y, x)."""
    seen = np.zeros_like(m, bool); H, W = m.shape; comps = []
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]: continue
        st = [(y0, x0)]; seen[y0, x0] = True; comp = []
        while st:
            y, x = st.pop(); comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; st.append((yy, xx))
        comps.append(comp)
    return comps


def lock(rgba, pal_lab, pal_rgb):
    a = rgba[..., 3] >= 128; out = np.zeros_like(rgba)
    lab = to_oklab(rgba[..., :3][a]); d = ((lab[:, None, :] - pal_lab[None]) ** 2).sum(-1)
    out[..., :3][a] = pal_rgb[d.argmin(1)]; out[..., 3][a] = 255
    for comp in islands(a):
        if len(comp) < 4:
            for y, x in comp: out[y, x] = 0
    return out


def breath(root, skel):
    P = {k['label']: (k['x'] * 128, k['y'] * 128) for k in skel['keypoints']}
    neck = P['NECK'][1]; hip = (P['LEFT HIP'][1] + P['RIGHT HIP'][1]) / 2; line = int(round(neck + CHEST * (hip - neck)))
    a = np.asarray(root).copy(); out = a.copy(); out[:line - 1] = a[1:line]
    return Image.fromarray(out), line


def match(a, b, c, exp, half=(6, 4), search=7):
    """sole patch around c=(x,y) in cel a: where is it in cel b, within `search` px of the designed travel exp? (dx, dy, iou)"""
    x, y = int(round(c[0])), int(round(c[1]))
    al = a[..., 3] > 0; bl = b[..., 3] > 0
    p = al[y - half[1]:y + half[1] + 1, x - half[0]:x + half[0] + 1]
    if p.sum() < 6: return None
    best = None
    ex, ey = int(round(exp[0])), int(round(exp[1]))
    for dy in range(ey - search, ey + search + 1):
        for dx in range(ex - search, ex + search + 1):
            q = bl[y + dy - half[1]:y + dy + half[1] + 1, x + dx - half[0]:x + dx + half[0] + 1]
            if q.shape != p.shape: continue
            s = (p & q).sum() / max((p | q).sum(), 1)
            if best is None or s > best[2] + 1e-9 or (abs(s - best[2]) < 1e-9 and abs(dx - ex) + abs(dy - ey) < abs(best[0] - ex) + abs(best[1] - ey)): best = (dx, dy, s)
    return best


def main(seed):
    rep = {}
    for c in CHARS:
        for d in DIRS:
            root = Image.open(HERE / f'roots/{c}/{d}.png').convert('RGBA'); ra = np.asarray(root)
            cols = np.unique(ra[..., :3][ra[..., 3] > 0].reshape(-1, 3), axis=0); pal_lab = to_oklab(cols)
            sk = json.load(open(HERE / f'roots/{c}/skeleton/{d}.json'))
            out = HERE / f'cels/{c}'
            lifted, line = breath(root, sk)
            (out / f'idle/{d}').mkdir(parents=True, exist_ok=True)
            root.save(out / f'idle/{d}/00.png'); lifted.save(out / f'idle/{d}/01.png')
            raw = sorted((HERE / f'raw/walk-{c}-{d}-s{seed}').glob('*.png'))
            cels = [lock(np.asarray(Image.open(p).convert('RGBA')), pal_lab, cols) for p in raw]
            (out / f'walk/{d}').mkdir(parents=True, exist_ok=True)
            for i, a in enumerate(cels): Image.fromarray(a).save(out / f'walk/{d}/{i:02d}.png')
            des = json.load(open(HERE / f'design/{c}-{d}.json'))
            ax = np.array(AXIS[d]); travel = []
            for side, pairs in (('RIGHT', [(0, 1), (1, 2), (2, 3)]), ('LEFT', [(3, 4), (4, 5), (5, 0)])):
                for i, j in pairs:
                    ank = des['ankles'][i][side]; sole = (ank[0], ank[1] + 5)
                    exp = -ax * des['step'] * des['height'] / 1.095 / 3
                    m = match(cels[i], cels[j], sole, exp)
                    if m: travel.append(dict(side=side, pair=[i, j], dx=m[0], dy=m[1], iou=round(m[2], 2), along=round(float(-(m[0] * ax[0] + m[1] * ax[1])), 2)))
            al = [t['along'] for t in travel if t['iou'] > 0.35]
            per = float(np.median(al)) if al else None
            rep[f'{c}/{d}'] = dict(pairs=travel, back_per_cel=per, loop_tiles=round(6 * per / TILE, 3) if per else None,
                                   colours=int(len(cols)), chest_line=line,
                                   height=int(np.ptp(np.nonzero(ra[..., 3])[0]) + 1))
            print(c, d, 'back/cel', per, 'loop tiles', rep[f'{c}/{d}']['loop_tiles'], [t['along'] for t in travel])
    json.dump(rep, open(HERE / 'stride.json', 'w'), indent=1)


if __name__ == '__main__':
    main(int(sys.argv[1]))
