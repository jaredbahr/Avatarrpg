"""Step 8 (#317's assemble.py, eight headings, stance and rest): cels. For each character and heading:

- idle: the restyled root (one cel) and the same cel with the rows above the chest line lifted 1 px (a breath), 2 cels;
  stance: the same from the stance root; rest: the idle root alone.
- walk: the take's six cels, alpha made binary, palette-locked (OKLab nearest) to the root's own colours so every cel
  shares the idle's palette and the restyle's tones, and specks under 4 px cleared. Nothing is redrawn.
- the stride: the planted foot's travel each stance cel, measured by matching the sole patch at the designed ankle
  in cel i against cel i+1 (both stance pairs of each foot), along the heading's screen diagonal.

- Bo's west-facing headings are his east-facing ones mirrored (MIRROR): his costume has no handed detail.
- the stride is measured along the heading's screen direction and turned into tiles with the game's own screen travel a
  logical tile for that heading (walk_stride.py's px_per_tile: 90.5 east and west, 71.6 the diagonals, 45.3 north and
  south).

usage (repo root): python3 -I art/source/party-world/tools/assemble.py SEED -> cels/<char>/<clip>/<dir>/NN.png, stride.json"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from colour import to_oklab
HERE = Path(__file__).resolve().parent.parent
CHARS = ['kaya', 'sura', 'bo']
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
MIRROR = {'bo': {'west': 'east', 'south-west': 'south-east', 'north-west': 'north-east'}}
AXIS = {'south-east': (0.894, 0.447), 'south-west': (-0.894, 0.447), 'north-east': (0.894, -0.447), 'north-west': (-0.894, -0.447),
        'east': (1.0, 0.0), 'west': (-1.0, 0.0), 'south': (0.0, 1.0), 'north': (0.0, -1.0)}
PX_PER_TILE = {d: (90.51 if d in ('east', 'west') else 45.25 if d in ('north', 'south') else 71.55) for d in AXIS}
CHEST = 0.35


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


def mirror_dir(c, d):
    """Write heading d of c as its mirror's cels flipped, and copy its stride entry."""
    src = MIRROR[c][d]
    for clip in ('idle', 'stance', 'rest', 'walk'):
        o = HERE / f'cels/{c}/{clip}/{d}'; o.mkdir(parents=True, exist_ok=True)
        for p in sorted((HERE / f'cels/{c}/{clip}/{src}').glob('*.png')):
            Image.open(p).transpose(Image.FLIP_LEFT_RIGHT).save(o / p.name)
    return src


def main(seed):
    rep = {}
    for c in CHARS:
        for d in DIRS:
            if d in MIRROR.get(c, {}): continue
            root = Image.open(HERE / f'roots/{c}/idle/{d}.png').convert('RGBA'); ra = np.asarray(root)
            cols = np.unique(ra[..., :3][ra[..., 3] > 0].reshape(-1, 3), axis=0); pal_lab = to_oklab(cols)
            sk = json.load(open(HERE / f'roots/{c}/idle/skeleton/{d}.json'))
            out = HERE / f'cels/{c}'
            lifted, line = breath(root, sk)
            (out / f'idle/{d}').mkdir(parents=True, exist_ok=True)
            root.save(out / f'idle/{d}/00.png'); lifted.save(out / f'idle/{d}/01.png')
            (out / f'rest/{d}').mkdir(parents=True, exist_ok=True); root.save(out / f'rest/{d}/00.png')
            # The stance breathes on the same chest line as the idle (its skeleton is not estimated: same body, same rows).
            stance = Image.open(HERE / f'roots/{c}/stance/{d}.png').convert('RGBA')
            s_lifted, _ = breath(stance, sk)
            (out / f'stance/{d}').mkdir(parents=True, exist_ok=True)
            stance.save(out / f'stance/{d}/00.png'); s_lifted.save(out / f'stance/{d}/01.png')
            raw = sorted((HERE / f'raw/walk-{c}-{d}-s{seed}').glob('*.png'))
            cels = [lock(np.asarray(Image.open(p).convert('RGBA')), pal_lab, cols) for p in raw]
            (out / f'walk/{d}').mkdir(parents=True, exist_ok=True)
            for i, a in enumerate(cels): Image.fromarray(a).save(out / f'walk/{d}/{i:02d}.png')
            des = json.load(open(HERE / f'design/{c}-{d}.json'))
            ax = np.array(AXIS[d]); travel = []
            for side, pairs in (('RIGHT', [(0, 1), (1, 2), (2, 3)]), ('LEFT', [(3, 4), (4, 5), (5, 0)])):
                for i, j in pairs:
                    ank = des['ankles'][i][side]; sole = (ank[0], ank[1] + 5)
                    # The designed stance foot's own screen travel between the two cels: exact for every heading.
                    exp = np.array(des['ankles'][j][side]) - np.array(des['ankles'][i][side])
                    m = match(cels[i], cels[j], sole, exp)
                    if m: travel.append(dict(side=side, pair=[i, j], dx=m[0], dy=m[1], iou=round(m[2], 2), along=round(float(-(m[0] * ax[0] + m[1] * ax[1])), 2)))
            al = [t['along'] for t in travel if t['iou'] > 0.35]
            per = float(np.median(al)) if al else None
            rep[f'{c}/{d}'] = dict(pairs=travel, back_per_cel=per, loop_tiles=round(6 * per / PX_PER_TILE[d], 3) if per else None,
                                   colours=int(len(cols)), chest_line=line,
                                   height=int(np.ptp(np.nonzero(ra[..., 3])[0]) + 1))
            print(c, d, 'back/cel', per, 'loop tiles', rep[f'{c}/{d}']['loop_tiles'], [t['along'] for t in travel])
        for d, src in MIRROR.get(c, {}).items():
            mirror_dir(c, d); rep[f'{c}/{d}'] = dict(rep[f'{c}/{src}'], mirrored_from=src)
    json.dump(rep, open(HERE / 'stride.json', 'w'), indent=1)




# ---- combat clips (hit, ko): the stance root first, then the take's frames, each palette-locked to the stance root.
CLIP_DIRS = {'hit': DIRS, 'ko': ['south-east', 'north-east', 'north-west', 'south-west']}


def combat(seed, clips=('hit', 'ko')):
    sys.path.insert(0, str(Path(__file__).parent))
    from remap import CANVAS, root_on
    for c in CHARS:
        for clip in clips:
            W = CANVAS[clip]
            for d in CLIP_DIRS[clip]:
                if d in MIRROR.get(c, {}): continue
                raw = sorted((HERE / f'raw/{c}-{clip}-{d}-s{seed}').glob('*.png'))
                if not raw: print('missing', c, clip, d); continue
                first = root_on(c, d, W); fa = np.asarray(first)
                cols = np.unique(fa[..., :3][fa[..., 3] > 0].reshape(-1, 3), axis=0); pal_lab = to_oklab(cols)
                out = HERE / f'cels/{c}/{clip}/{d}'; out.mkdir(parents=True, exist_ok=True)
                first.save(out / '00.png')
                for i, p in enumerate(raw):
                    Image.fromarray(lock(np.asarray(Image.open(p).convert('RGBA')), pal_lab, cols)).save(out / f'{i + 1:02d}.png')
            for d, src in MIRROR.get(c, {}).items():
                if d not in CLIP_DIRS[clip]: continue
                o = HERE / f'cels/{c}/{clip}/{d}'; o.mkdir(parents=True, exist_ok=True)
                for p in sorted((HERE / f'cels/{c}/{clip}/{src}').glob('*.png')):
                    Image.open(p).transpose(Image.FLIP_LEFT_RIGHT).save(o / p.name)
    print('combat cels', clips)


# ---- bends: party-g1's shipped bend sets (frames, timing, key frames, attacks) kept exactly; only the cels, their size,
# the foot point and the sockets change. Untrimmed 192 cels: cel 0 is the stance root, cel spec['cels'][j] the take's j-th.
SOCKET = {'LW': 'LEFT ARM', 'RW': 'RIGHT ARM', 'LA': 'LEFT LEG', 'RA': 'RIGHT LEG'}
FACING = {'east': 'east', 'south-east': 'southEast', 'south': 'south', 'south-west': 'southWest', 'west': 'west',
          'north-west': 'northWest', 'north': 'north', 'north-east': 'northEast'}


def snap(a, p, r=3):
    """A wrist socket on the drawn hand: the nearest opaque pixel within r px when the requested point is not on ink."""
    x, y = p; ix, iy = int(np.floor(x)), int(np.floor(y))
    if 0 <= iy < a.shape[0] and 0 <= ix < a.shape[1] and a[iy, ix]: return p
    best = None
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            yy, xx = iy + dy, ix + dx
            if 0 <= yy < a.shape[0] and 0 <= xx < a.shape[1] and a[yy, xx] and (best is None or dx * dx + dy * dy < best[0]):
                best = (dx * dx + dy * dy, (xx + 0.5, yy + 0.5))
    return best[1] if best else p


def bends(seed, chars=CHARS):
    from remap import CANVAS, FOOT as RFOOT, root_on
    G1 = HERE.parent / 'party-g1'
    W = CANVAS['bend']
    for c in chars:
        spec = json.load(open(G1 / 'tools/motion.json'))[c]['bend']
        ship = json.load(open(G1 / f'shipped/{c}-bend.json'))
        for d in DIRS:
            if d in MIRROR.get(c, {}): continue
            raw = sorted((HERE / f'raw/{c}-bend-{d}-s{seed}').glob('*.png'))
            if len(raw) != len(spec['cels']): raise SystemExit(f'{c} bend {d}: {len(raw)} frames for {len(spec["cels"])} cels')
            first = root_on(c, d, W); fa = np.asarray(first)
            cols = np.unique(fa[..., :3][fa[..., 3] > 0].reshape(-1, 3), axis=0); pal_lab = to_oklab(cols)
            out = HERE / f'cels/{c}/bend/{d}'; out.mkdir(parents=True, exist_ok=True)
            first.save(out / '00.png')
            for j, p in enumerate(raw):
                Image.fromarray(lock(np.asarray(Image.open(p).convert('RGBA')), pal_lab, cols)).save(out / f'{spec["cels"][j]:02d}.png')
        for d, src in MIRROR.get(c, {}).items():
            o = HERE / f'cels/{c}/bend/{d}'; o.mkdir(parents=True, exist_ok=True)
            for p in sorted((HERE / f'cels/{c}/bend/{src}').glob('*.png')):
                Image.open(p).transpose(Image.FLIP_LEFT_RIGHT).save(o / p.name)
        # The bend set: sockets from the requested skeleton (remap.py's design), each wrist on the drawn hand.
        for d in DIRS:
            fac = ship['facings'][FACING[d]]
            src = MIRROR.get(c, {}).get(d, d); flip = src != d
            design = json.load(open(HERE / f'design/{c}/bend-{src}.json'))
            kps = {0: design['first_frame_keypoints']}
            for j, n in enumerate(spec['cels']): kps[n] = design['frames'][j]
            sockets = []
            for pos, fname in enumerate(fac['frames']):
                n = int(fname.split('/')[-1]); a = np.asarray(Image.open(HERE / f'cels/{c}/bend/{d}/{n:02d}.png'))[..., 3] >= 128
                P = {k['label']: ((1 - k['x']) * W if flip else k['x'] * W, k['y'] * W) for k in kps[n]}
                if flip:   # a mirrored figure's left hand is drawn where its right was
                    P = {l.replace('LEFT', 'TMP').replace('RIGHT', 'LEFT').replace('TMP', 'RIGHT'): v for l, v in P.items()}
                sk = {}
                for name, label in SOCKET.items():
                    x, y = P[label]
                    if name in ('LW', 'RW'): x, y = snap(a, (x, y))
                    sk[name] = {'x': round(float(x), 3), 'y': round(float(y), 3)}
                sockets.append({'frame': pos, 'sockets': sk})
            fac.update(sourceSize={'width': W, 'height': W}, root={'x': W / 2, 'y': RFOOT[W] + 1}, scale=1,
                       frameSize={'width': W, 'height': W}, anchor={'x': 0.5, 'y': round((RFOOT[W] + 1) / W, 6)},
                       socketsPerFrame=sockets)
        json.dump(ship, open(HERE / f'cels/{c}/bend.json', 'w'), indent=1)
        print(c, 'bends')


if __name__ == '__main__':
    # assemble.py SEED            locomotion (idle, rest, stance, walk) and stride.json
    # assemble.py SEED hit ko     the combat clips named
    # assemble.py SEED bend [char ...]  the bends and their sets
    if len(sys.argv) > 2 and sys.argv[2] == 'bend': bends(int(sys.argv[1]), tuple(sys.argv[3:]) or CHARS)
    elif len(sys.argv) > 2: combat(int(sys.argv[1]), tuple(sys.argv[2:]))
    else: main(int(sys.argv[1]))
