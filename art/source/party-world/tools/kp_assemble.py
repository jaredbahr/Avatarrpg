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

usage (repo root): python3 -I art/source/party-world/tools/kp_assemble.py"""
import json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from assemble import AXIS, CHEST, PX_PER_TILE, breath, lock, match, snap, SOCKET, FACING
from kp_palette import palette
from kp_texture import transfer
from remap import CANVAS, FOOT as RFOOT, root_on
HERE = Path(__file__).resolve().parent.parent
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
KO_DIRS = ['south-east', 'north-east', 'north-west', 'south-west']
TAKES = json.load(open(HERE / 'polish/takes.json'))
RGB, LAB = palette()
OUT = HERE / 'cels/kaya'
L = lambda a: lock(np.asarray(a), LAB, RGB)


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
        cels = [L(transfer(c, des['frames'][i], root, des['first_frame_keypoints'], 128)[0])
                for i, c in enumerate(raw(f"walk-kaya-{d}-s{TAKES['walk'][d]}", 6))]
        for i, a in enumerate(cels): save(a, OUT / f'walk/{d}/{i:02d}.png')
        ax = np.array(AXIS[d]); travel = []
        for side, pairs in (('RIGHT', [(0, 1), (1, 2), (2, 3)]), ('LEFT', [(3, 4), (4, 5), (5, 0)])):
            for i, j in pairs:
                ank = des['ankles'][i][side]; sole = (ank[0], ank[1] + 5)
                exp = np.array(des['ankles'][j][side]) - np.array(des['ankles'][i][side])
                m = match(cels[i], cels[j], sole, exp)
                if m: travel.append(dict(side=side, pair=[i, j], dx=m[0], dy=m[1], iou=round(m[2], 2), along=round(float(-(m[0] * ax[0] + m[1] * ax[1])), 2)))
        al = [t['along'] for t in travel if t['iou'] > 0.35]; per = float(np.median(al)) if al else None
        ra = np.asarray(root)
        stride[f'kaya/{d}'] = dict(pairs=travel, back_per_cel=per, loop_tiles=round(6 * per / PX_PER_TILE[d], 3) if per else None,
                                   colours=int(len(RGB)), height=int(np.ptp(np.nonzero(ra[..., 3])[0]) + 1), take=TAKES['walk'][d])
        print('walk', d, 'back/cel', per, 'loop tiles', stride[f'kaya/{d}']['loop_tiles'])


def combat():
    for clip, dirs in (('hit', DIRS), ('ko', KO_DIRS)):
        W = CANVAS[clip]
        for d in dirs:
            des = json.load(open(HERE / f"polish/design/{clip}-{d}.json"))
            root = np.asarray(root_on('kaya', d, W)); n = len(des['frames'])
            save(L(root), OUT / f'{clip}/{d}/00.png')
            for i, c in enumerate(raw(f"kp-{clip}-{d}-s{TAKES[clip]}", n)):
                save(L(transfer(c, des['frames'][i], root, des['first_frame_keypoints'], W, rigid=False)[0]), OUT / f'{clip}/{d}/{i + 1:02d}.png')
        print(clip, 'cels')


def bends():
    G1 = HERE.parent / 'party-g1'; W = CANVAS['bend']
    spec = json.load(open(G1 / 'tools/motion.json'))['kaya']['bend']
    ship = json.load(open(G1 / 'shipped/kaya-bend.json'))
    for d in DIRS:
        des = json.load(open(HERE / f'polish/design/bend-{d}.json'))
        root = np.asarray(root_on('kaya', d, W))
        shutil.rmtree(OUT / f'bend/{d}', ignore_errors=True)
        save(L(root), OUT / f'bend/{d}/00.png')
        for j, c in enumerate(raw(f"kp-bend-{d}-s{TAKES['bend']}", len(spec['cels']))):
            save(L(transfer(c, des['frames'][j], root, des['first_frame_keypoints'], W, rigid=False)[0]), OUT / f'bend/{d}/{spec["cels"][j]:02d}.png')
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
        print('loop', a, b, m, 'tiles: real ms a cel at 750 ms a tile', round(750 * m / 6, 1))
    json.dump(stride, open(sp, 'w'), indent=1)
    combat(); bends(); riverside()
