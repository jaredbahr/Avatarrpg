"""Kaya polish, step 9: Kaya's cels, every clip on her one palette (kp_palette.py), written over #321's in cels/kaya/.

- idle: the restyled root and a 1 px breath (rows above the chest line lifted, assemble.breath); rest: the root.
- stance: the restyled stance root and a ready sink (the body above the hips dropped 1 px, the knees taking it): a loop.
- walk: the take's six cels (polish/takes.json picks the seed per heading) through the texture transfer, rigid
  (kp_texture.py: the trunk is the idle root's own pixels, the limbs take the root's colours where they match).
- hit (128), knockout and bend (192): the stance root, then the take's frames through the texture transfer (not rigid:
  the trunk turns and falls). The bend set as assemble.bends: party-g1's shipped frames, timing, keys and attacks, sockets
  from the requested wrists (snapped onto the drawn hand) and ankles.
- riverside: wave (the south-east take's frames 0 and 1) and tea (tea 0, and tea 1 with tea 0's folded legs below the lap).
- stride.json's Kaya entries, measured as assemble.main measures them, opposite headings averaged.

#351 (version C fixes): the front roots carry inpainted faces (kp_face.py), which the transfer carries onto every
generated head (`face`); takes may be one seed a heading; two knockout smears are peeled (polish/clean.json); and every
cel drops the generator's detached strays (`tidy`: the ponytail tip's flicks, lone smear pixels).

usage (repo root): python3 -I art/source/party-world/tools/kp_assemble.py"""
import json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from assemble import AXIS, CHEST, PX_PER_TILE, breath, lock, match, snap, SOCKET, FACING
from kp_palette import palette
from kp_texture import transfer
from kp_face import mask as face_mask
from remap import CANVAS, FOOT as RFOOT, root_on
import kp_walk   # the walk's design settings (design.GROUND_PER_H, STANCE, FWD, screen)
HERE = Path(__file__).resolve().parent.parent
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
KO_DIRS = ['south-east', 'north-east', 'north-west', 'south-west']
TAKES = json.load(open(HERE / 'polish/takes.json'))
RGB, LAB = palette()
OUT = HERE / 'cels/kaya'
STRAY = 24   # px: a piece of a cel not 4-connected to the figure and smaller than this is a generator stray (#351)


def tidy(a):
    """The generator's strays dropped: every piece of the cel that touches the figure's main body only at a corner or not
    at all (4-connectivity) and is under STRAY px: the ponytail tip's detached flick and 1-2 px hair ends, and lone smear
    pixels by the feet and hands. lock() already clears 8-connected specks under 4 px."""
    m = a[..., 3] >= 128; comps = sorted(islands4(m), key=len, reverse=True); out = a.copy()
    for c in comps[1:]:
        if len(c) < STRAY:
            for y, x in c: out[y, x] = 0
    return out


def islands4(m):
    seen = np.zeros_like(m, bool); H, W = m.shape; comps = []
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]: continue
        st = [(y0, x0)]; seen[y0, x0] = True; comp = []
        while st:
            y, x = st.pop(); comp.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; st.append((yy, xx))
        comps.append(comp)
    return comps


L = lambda a: tidy(lock(np.asarray(a), LAB, RGB))


def face_on(kind, d, W):
    """The root's face mask (kp_face.py) placed as root_on places the root on a W canvas, or None."""
    m = face_mask(kind, d)
    if m is None: return None
    out = np.zeros((W, W), bool); ox, oy = (W - 128) // 2, RFOOT[W] - 112; out[oy:oy + 128, ox:ox + 128] = m; return out


CLEAN = json.load(open(HERE / 'polish/clean.json'))


def clean(a, key):
    """A generator smear (polish/clean.json, #351): inside the cel's box, the smear's dusty pinks are peeled from the
    figure's edge until none touches the background, and any left inside take their most common other neighbour."""
    spec = CLEAN['cels'].get(key)
    if not spec: return a
    x0, y0, x1, y1 = spec['box']; smear = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in CLEAN['smear']}
    out = a.copy(); H, W = a.shape[:2]
    is_s = lambda y, x: out[y, x, 3] and tuple(out[y, x, :3]) in smear
    while True:
        peel = [(y, x) for y in range(y0, y1) for x in range(x0, x1) if is_s(y, x)
                and any(not (0 <= y + dy < H and 0 <= x + dx < W) or not out[y + dy, x + dx, 3] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        if not peel: break
        for y, x in peel: out[y, x] = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            if is_s(y, x):
                nb = [tuple(out[y + dy, x + dx]) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and out[y + dy, x + dx, 3] and not is_s(y + dy, x + dx)]
                if nb: out[y, x] = max(set(nb), key=nb.count)
    return out


def take(clip, d):
    """polish/takes.json: one seed for the clip, or one a heading (#351 retook two knockouts)."""
    t = TAKES[clip]; return t[d] if isinstance(t, dict) else t


def ground(a):
    """The row under the lowest opaque pixel: where the store stands the cel (src/render/sheets/feet.ts)."""
    return int(np.nonzero((a[..., 3] >= 128).any(1))[0].max()) + 1


def save(a, p):
    p.parent.mkdir(parents=True, exist_ok=True); Image.fromarray(a).save(p)


def sink(a, sk):
    """The body above the hip line dropped 1 px (the hip row given up): a ready stance's settle."""
    P = {k['label']: k['y'] * 128 for k in sk['keypoints']}
    line = int(round((P['LEFT HIP'] + P['RIGHT HIP']) / 2)); out = a.copy(); out[1:line + 1] = a[0:line]; out[0] = 0
    return out


def raw(name, n):
    return [np.asarray(Image.open(HERE / f'raw/{name}/{i:02d}.png').convert('RGBA')) for i in range(n)]


def locomotion(stride):
    for d in DIRS:
        sk = json.load(open(HERE / f'roots/kaya/idle/skeleton/{d}.json'))
        idle = L(Image.open(HERE / f'roots/kaya/idle/{d}.png').convert('RGBA'))
        save(idle, OUT / f'idle/{d}/00.png'); save(np.asarray(breath(Image.fromarray(idle), sk)[0]), OUT / f'idle/{d}/01.png')
        save(idle, OUT / f'rest/{d}/00.png')
        ssk = json.load(open(HERE / f'roots/kaya/stance/skeleton/{d}.json'))
        st = L(Image.open(HERE / f'roots/kaya/stance/{d}.png').convert('RGBA'))
        save(st, OUT / f'stance/{d}/00.png'); save(sink(st, ssk), OUT / f'stance/{d}/01.png')
        des = json.load(open(HERE / f'design/kaya-{d}.json'))
        root = np.asarray(Image.open(HERE / f'roots/kaya/idle/{d}.png').convert('RGBA'))
        n = len(des['frames']); g0 = ground(idle); cels = []
        for i, c in enumerate(raw(f"walk-kaya-{d}-s{TAKES['walk'][d]}", n)):
            # #408: the trunk rides the cel's own drawn ground row (the store stands the cel there) plus the designed
            # dip, so the head and torso move on screen by the dip alone, never more than 1 px a cel.
            dy = ground(L(c)) - g0 + int(round(des['pelvis_px'][i])) if des.get('plant') else None
            cels.append(L(transfer(c, des['frames'][i], root, des['first_frame_keypoints'], 128, face=face_on('idle', d, 128), trunk_dy=dy)[0]))
        shutil.rmtree(OUT / f'walk/{d}', ignore_errors=True)
        for i, a in enumerate(cels): save(a, OUT / f'walk/{d}/{i:02d}.png')
        ax = np.array(AXIS[d]); travel = []; stance = kp_walk.design.STANCE if des.get('plant') else n // 2
        for side, o in (('RIGHT', 0), ('LEFT', n // 2)):
            for k in range(stance - 1):
                i, j = (o + k) % n, (o + k + 1) % n
                ank = des['ankles'][i][side]; sole = (ank[0], ank[1] + 5)
                exp = np.array(des['ankles'][j][side]) - np.array(des['ankles'][i][side])
                m = match(cels[i], cels[j], sole, exp)
                if m: travel.append(dict(side=side, pair=[i, j], dx=m[0], dy=m[1], iou=round(m[2], 2), along=round(float(-(m[0] * ax[0] + m[1] * ax[1])), 2)))
        ra = np.asarray(root)
        entry = dict(cels=n, colours=int(len(RGB)), height=int(np.ptp(np.nonzero(ra[..., 3])[0]) + 1), take=TAKES['walk'][d])
        if des.get('plant'):
            # A planted foot keeps its row, so it holds sideways only: the fit is the horizontal travel over the screen's
            # horizontal px a tile for the heading. North and south have none: their loop is the design's own stride.
            xpt = PX_PER_TILE[d] * abs(ax[0])
            bx = [-t['dx'] * np.sign(ax[0]) for t in travel if t['iou'] > 0.35]
            if xpt > 0:
                per = float(np.median(bx)) if bx else None
                entry.update(fit='horizontal', back_x_per_cel=per, loop_tiles=round(n * per / xpt, 3) if per else None)
            else:
                fx, fy = kp_walk.design.FWD[d]
                loop = float(np.hypot(*kp_walk.design.screen(2 * des['step'] * fx, 2 * des['step'] * fy, 0, des['height'])))
                entry.update(fit='design', loop_px=round(loop, 2), loop_tiles=round(loop / PX_PER_TILE[d], 3))
        else:
            al = [t['along'] for t in travel if t['iou'] > 0.35]; per = float(np.median(al)) if al else None
            entry.update(back_per_cel=per, loop_tiles=round(n * per / PX_PER_TILE[d], 3) if per else None)
        stride[f'kaya/{d}'] = dict(pairs=travel, **entry)
        print('walk', d, entry.get('fit', 'along'), 'loop tiles', entry['loop_tiles'], 'ms a cel', round(750 * entry['loop_tiles'] / n, 1))


def combat():
    for clip, dirs in (('hit', DIRS), ('ko', KO_DIRS)):
        W = CANVAS[clip]
        for d in dirs:
            des = json.load(open(HERE / f"polish/design/{clip}-{d}.json"))
            root = np.asarray(root_on('kaya', d, W)); n = len(des['frames']); face = face_on('stance', d, W)
            save(L(root), OUT / f'{clip}/{d}/00.png')
            for i, c in enumerate(raw(f"kp-{clip}-{d}-s{take(clip, d)}", n)):
                cel = L(transfer(c, des['frames'][i], root, des['first_frame_keypoints'], W, rigid=False, face=face)[0])
                save(tidy(clean(cel, f'{clip}/{d}/{i + 1:02d}')), OUT / f'{clip}/{d}/{i + 1:02d}.png')
        print(clip, 'cels')


def bends():
    G1 = HERE.parent / 'party-g1'; W = CANVAS['bend']
    spec = json.load(open(G1 / 'tools/motion.json'))['kaya']['bend']
    ship = json.load(open(G1 / 'shipped/kaya-bend.json'))
    for d in DIRS:
        des = json.load(open(HERE / f'polish/design/bend-{d}.json'))
        root = np.asarray(root_on('kaya', d, W)); face = face_on('stance', d, W)
        shutil.rmtree(OUT / f'bend/{d}', ignore_errors=True)
        save(L(root), OUT / f'bend/{d}/00.png')
        for j, c in enumerate(raw(f"kp-bend-{d}-s{take('bend', d)}", len(spec['cels']))):
            save(L(transfer(c, des['frames'][j], root, des['first_frame_keypoints'], W, rigid=False, face=face)[0]), OUT / f'bend/{d}/{spec["cels"][j]:02d}.png')
        fac = ship['facings'][FACING[d]]
        kps = {0: des['first_frame_keypoints']}
        for j, n in enumerate(spec['cels']): kps[n] = des['frames'][j]
        sockets = []
        for pos, fname in enumerate(fac['frames']):
            n = int(fname.split('/')[-1]); a = np.asarray(Image.open(OUT / f'bend/{d}/{n:02d}.png'))[..., 3] >= 128
            P = {k['label']: (k['x'] * W, k['y'] * W) for k in kps[n]}; sk = {}
            for name, label in SOCKET.items():
                x, y = P[label]
                if name in ('LW', 'RW'): x, y = snap(a, (x, y))
                sk[name] = {'x': round(float(x), 3), 'y': round(float(y), 3)}
            sockets.append({'frame': pos, 'sockets': sk})
        fac.update(sourceSize={'width': W, 'height': W}, root={'x': W / 2, 'y': RFOOT[W] + 1}, scale=1,
                   frameSize={'width': W, 'height': W}, anchor={'x': 0.5, 'y': round((RFOOT[W] + 1) / W, 6)}, socketsPerFrame=sockets)
    json.dump(ship, open(OUT / 'bend.json', 'w'), indent=1)
    print('bend cels and set')


def riverside():
    w = raw(f"kp-wave-s{TAKES['wave']}", 2)
    for i, a in enumerate(w): save(L(a), OUT / f'riverside/wave-{i}.png')
    t0 = np.asarray(Image.open(HERE / f"raw/kp-tea0-s{TAKES['tea0']}/00.png").convert('RGBA'))
    t1 = np.asarray(Image.open(HERE / f"raw/kp-tea1-s{TAKES['tea1']}/00.png").convert('RGBA')).copy()
    ys = np.nonzero(t0[..., 3] > 127)[0]; lap = int(ys.min() + 0.66 * (ys.max() - ys.min()))
    t1[lap:] = t0[lap:]
    save(L(t0), OUT / 'riverside/tea-0.png'); save(L(t1), OUT / 'riverside/tea-1.png')
    print('riverside, lap row', lap)


if __name__ == '__main__':
    sp = HERE / 'stride.json'; stride = json.load(open(sp))
    for k in [k for k in stride if k.startswith('kaya/')]: del stride[k]
    locomotion(stride)
    # Opposite headings walk the same designed stride along the same screen axis, and the sole match is noisiest for
    # north and south (the feet overlap on screen): each pair takes the mean of its two measured loops.
    OPP = {'south': 'north', 'south-east': 'north-west', 'east': 'west', 'north-east': 'south-west'}
    for a, b in list(OPP.items()):
        A, B = stride[f'kaya/{a}'], stride[f'kaya/{b}']; m = round((A['loop_tiles'] + B['loop_tiles']) / 2, 3)
        for e in (A, B): e['loop_tiles_measured'] = e['loop_tiles']; e['loop_tiles'] = m
        print('loop', a, b, m, 'tiles: real ms a cel at 750 ms a tile', round(750 * m / A['cels'], 1))
    json.dump(stride, open(sp, 'w'), indent=1)
    combat(); bends(); riverside()
