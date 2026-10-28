"""Rollout step 6: assemble every packed cel of the three G1 sheets from the curated roots, the breath loops and the takes.

usage (repo root): python3 -I art/source/party-g1/tools/assemble.py [char ...]
Reads   assembly.json (which take each clip and heading uses), roots/, cels/<char>/<idle|stance>/ (breath.py), raw/, design/,
        and the shipped clip timing and bend data frozen in shipped/ (clip names, frame lists, timing, keys and attacks are
        kept exactly; only pixels, frame sizes, anchors and sockets change).
Writes  cels/<char>/<clip>/NN.png and cels/<char>/pack.json, which scripts/art/party-g1.ts packs and pins.

Deterministic. One rule set for every character and heading, all measured on the placed cels; the numbers it chose are in
pack.json `placement`:
- Grid: 64 px a tile, a 64x96 cel, the foot point at (32, 81.6) (anchor 0.5, 0.85). A root is already placed there: it is a
  redraw of the shipped cel reduced 2x, which carried the shipped placement.
- Every generated cel goes through the palette lock and binary alpha, so it stays on the shipped palette, and loses any
  island under 60 px that does not touch the body (a stray wisp beside a strike).
- Walk: cropped from its 96 canvas (root at 16, 0). `walkDy` puts the mean of the two contact cels' soles (the cels motion.py
  names in `contact_rows`) on idle cel 0's sole; north is drawn level with idle (the shipped rule: seen from behind the
  planted sole is a stride up-screen). Then, where the walk's mean lowest row sits more than 1.75 px from idle's (art:validate
  allows 2 at this grid), it moves the fewest pixels that bring it inside. `walkDx` moves it by the rounded mean upper-body
  offset against idle cel 0 when that exceeds 1 px.
- Rest: of the two passing cels (3 and 9), the one whose silhouette best overlaps idle cel 0.
- Hit, knockout and bend: frame 0 (and a hit's and a bend's last frame) is the stance root itself on the take's canvas, so the
  clip starts and ends on the stance's feet at its size; the take is trimmed to the union of its ink plus a 4 px margin; the
  anchor is the stance's foot point in that box.
- Bend sockets: the requested skeleton's wrists (LW, RW) and ankles (LA, RA) in the packed cel, each wrist moved to the
  nearest opaque pixel within 3 px when the drawn hand is not under it.
- Cast (the mirrored legacy clip non-bend abilities play): the east bend's stance, anticipation and first contact cels.
  KO (the one-cel legacy fallback): the south-east knockout's last cel.
- Wave and tea (riverside only, Kaya and Sura): the shipped cels reduced 2x by reduce.py's rule on the character's palette.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from palette_lock import lock
from motion import DIRS, CANVAS, SPECS
import reduce as R
HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parents[2]
UNITS = REPO / 'public/art/units'
# The shipped G clip data, bend sets and riverside page as of main cc715e7: the timing, key frames and attacks this rollout keeps.
SHIPPED = HERE / 'shipped'
FRAME_W, FRAME_H = 64, 96
FOOT = (32.0, 0.85 * FRAME_H)
MARGIN = 4
STAND = 3          # art:validate's standing tolerance at this grid (6 px at 128 px a tile)
KEYS = {'kaya': 'unit.fire.kaya', 'sura': 'unit.water.sura', 'bo': 'unit.earth.bo'}
CAMEL = {'east': 'East', 'south-east': 'SouthEast', 'south': 'South', 'south-west': 'SouthWest', 'west': 'West',
         'north-west': 'NorthWest', 'north': 'North', 'north-east': 'NorthEast'}
BEND_FACING = {'east': 'east', 'south-east': 'southEast', 'south': 'south', 'south-west': 'southWest', 'west': 'west',
               'north-west': 'northWest', 'north': 'north', 'north-east': 'northEast'}
SOCKET = {'LW': 'LEFT ARM', 'RW': 'RIGHT ARM', 'LA': 'LEFT LEG', 'RA': 'RIGHT LEG'}


def heading_clip(base, d):
    return base if d == 'east' else base + CAMEL[d]


def alpha(im): return np.asarray(im)[..., 3] > 127


def lowest(im):
    ys = np.nonzero(alpha(im).any(1))[0]; return int(ys.max())


def shift(im, dx, dy):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, (dx, dy), im); return out


def iou(a, b):
    A, B = alpha(a), alpha(b); return float((A & B).sum() / max((A | B).sum(), 1))


def upper_offset(cel, idle):
    """Best-overlap horizontal offset of the cel's top 45% of ink against idle's, within 3 px."""
    A = alpha(idle); B = alpha(cel)
    ys = np.nonzero(A.any(1))[0]; top, bot = ys.min(), ys.min() + int(0.45 * (ys.max() - ys.min()))
    best, bx = -1, 0
    for dx in range(-3, 4):
        s = (np.roll(B, dx, 1)[top:bot] & A[top:bot]).sum()
        if s > best: best, bx = s, dx
    return -bx


ISLAND = 60   # px: a detached island smaller than this is a stray wisp, not a body part


def islands(im):
    """Drop opaque 8-connected islands that do not touch the largest one and are smaller than ISLAND px: the stray wisps
    a skeleton take sometimes leaves beside a strike. A deterministic clean; nothing is drawn."""
    a = np.asarray(im).copy(); m = a[..., 3] > 0; H, W = m.shape; lab = np.zeros((H, W), int); n = 0; sizes = [0]
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]: continue
        n += 1; stack = [(y0, x0)]; lab[y0, x0] = n; c = 0
        while stack:
            y, x = stack.pop(); c += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; stack.append((yy, xx))
        sizes.append(c)
    if n <= 1: return im
    big = int(np.argmax(sizes))
    for k in range(1, n + 1):
        if k != big and sizes[k] < ISLAND: a[lab == k] = 0
    return Image.fromarray(a)


def load_gen(job, n, char):
    return [islands(lock(Image.open(HERE / f'raw/{job}/{i:02d}.png'), char)) for i in range(n)]


def on_canvas(img, W):
    x, y = CANVAS[W]; c = Image.new('RGBA', (W, W), (0, 0, 0, 0)); c.alpha_composite(img, (x, y)); return c


def trim(frames, W, dy=0):
    """Union ink box of a take plus the margin, the cropped cels and the anchor of the stance foot point."""
    m = np.zeros((W, W), bool)
    for f in frames: m |= alpha(f)
    ys, xs = np.nonzero(m)
    x0, y0 = max(0, xs.min() - MARGIN), max(0, ys.min() - MARGIN); x1, y1 = min(W, xs.max() + 1 + MARGIN), min(W, ys.max() + 1 + MARGIN)
    if xs.min() - MARGIN < 0 or ys.min() - MARGIN < 0 or xs.max() + 1 + MARGIN > W or ys.max() + 1 + MARGIN > W:
        print('  WARNING: take ink reaches the canvas edge; margin clipped')
    fx, fy = CANVAS[W][0] + FOOT[0], CANVAS[W][1] + FOOT[1] - dy   # a heading lowered by dy stands its foot point dy higher in the take
    box = (int(x0), int(y0), int(x1), int(y1))
    anchor = {'x': round((fx - x0) / (x1 - x0), 6), 'y': round((fy - y0) / (y1 - y0), 6)}
    return [f.crop(box) for f in frames], box, anchor


def snap(im, p, r=3):
    A = alpha(im); x, y = p; ix, iy = int(np.floor(x)), int(np.floor(y))
    if 0 <= iy < A.shape[0] and 0 <= ix < A.shape[1] and A[iy, ix]: return p
    best = None
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            yy, xx = iy + dy, ix + dx
            if 0 <= yy < A.shape[0] and 0 <= xx < A.shape[1] and A[yy, xx]:
                d = dx * dx + dy * dy
                if best is None or d < best[0]: best = (d, (xx + 0.5, yy + 0.5))
    return best[1] if best else p


def kp_px(entry, W):
    return {j['label']: (j['x'] * W, j['y'] * W) for j in entry}


def clamp_margin(im, m=MARGIN):
    """Clear the ink inside the clear margin; returns the cel and how many pixels went (a toe or a spear tip, ADR 0095)."""
    a = np.asarray(im).copy(); keep = np.zeros(a.shape[:2], bool); keep[m:-m, m:-m] = True
    lost = int(((a[..., 3] > 0) & ~keep).sum()); a[~keep] = 0
    return Image.fromarray(a), lost


def jog(char, d, job, idle, idle_dy, put):
    """The jog (ADR 0095): cropped from its 96 canvas as the walk is, its two contact cels' soles (motion.py's
    `contact_rows`) set on idle cel 0's sole in every heading (the walk's north rule, level with idle, sank the run's
    back-view feet 2-3 px), and moved by the rounded mean upper-body offset against idle when that exceeds 1 px. No
    mean-row bound: a run's flight cels leave the ground."""
    design = json.load(open(HERE / f'design/{char}/jog-{d}.json')); n = SPECS['_shared']['jog']['frames']
    gen = load_gen(job, n, char)
    lost = sum(int(alpha(c)[:, :16].sum() + alpha(c)[:, 80:].sum()) for c in gen)
    cels = [shift(c.crop((16, 0, 80, 96)), 0, idle_dy) for c in gen]
    base = lowest(idle[0]); cr = design['info']['contact_rows']
    dy = -int(round((lowest(cels[cr['LA']['cel']]) + lowest(cels[cr['RA']['cel']])) / 2 - base))
    off = np.mean([upper_offset(shift(c, 0, dy), idle[0]) for c in cels]); dx = int(round(off)) if abs(off) > 1 else 0
    placed = [clamp_margin(shift(c, dx, dy)) for c in cels]
    put(heading_clip('jog', d), [c for c, _ in placed])
    clamped = sum(n for _, n in placed)
    if lost or clamped: print(f'  {char} jog {d}: {lost} px of ink outside the 64 px cel, {clamped} px inside its margin cleared')
    return dict(jog_job=job, jogDx=dx, jogDy=dy, jog_contact_rows=cr, jogLostPx=lost, jogClampedPx=clamped)


def build(char):
    A = json.load(open(HERE / 'assembly.json'))[char]
    key = KEYS[char]; out = HERE / f'cels/{char}'
    clips = {}; placement = {}
    shipped_clips = json.load(open(SHIPPED / f'{char}-g-clips.json'))
    bend_ship = json.load(open(SHIPPED / f'{char}-bend.json'))

    def put(clip, cels, **meta):
        d = out / clip; d.mkdir(parents=True, exist_ok=True)
        for i, c in enumerate(cels): c.save(d / f'{i:02d}.png')
        clips[clip] = dict(cels=[f'{clip}/{i:02d}.png' for i in range(len(cels))], **meta)

    def put_take(name, frames, box, anchor, ship):
        # The shipped frame list is kept as it is, holds included (Sura's south-west knockout names cel 4 twice), so
        # the clip's timing does not change; a cel no frame names is not packed.
        idx = [int(f.split('/')[-1]) for f in ship['frames']]; used = sorted(set(idx))
        put(name, [frames[i] for i in used], cel_names=used, frameNames=idx, frameSize={'w': box[2] - box[0], 'h': box[3] - box[1]},
            anchor=anchor, fps=ship['fps'], loop=ship['loop'], frameMs=ship['frameMs'])

    stance_root = {d: Image.open(HERE / f'roots/{char}/stance/{d}.png').convert('RGBA') for d in DIRS}
    line = int(round(FOOT[1]))
    idle_dy = {}
    for d in DIRS:
        low = lowest(Image.open(out / f'idle/{d}/00.png').convert('RGBA'))
        idle_dy[d] = (line - STAND - low) if low < line - STAND else (line + STAND - low) if low > line + STAND else 0
    for d in DIRS:
        idle = [shift(Image.open(out / f'idle/{d}/{i:02d}.png').convert('RGBA'), 0, idle_dy[d]) for i in range(4)]
        stance = [shift(Image.open(out / f'stance/{d}/{i:02d}.png').convert('RGBA'), 0, idle_dy[d]) for i in range(8)]
        put(heading_clip('idle', d), idle); put(heading_clip('stance', d), stance)
        # walk
        job = A['walk'][d]; design = json.load(open(HERE / f'design/{char}/walk-{d}.json'))
        walk = [shift(c.crop((16, 0, 80, 96)), 0, idle_dy[d]) for c in load_gen(job, 12, char)]
        base = lowest(idle[0]); cr = design['info']['contact_rows']
        if d == 'north': dy = 0
        else: dy = -int(round((lowest(walk[cr['LA']['cel']]) + lowest(walk[cr['RA']['cel']])) / 2 - base))
        mean = np.mean([lowest(c) for c in walk]) + dy
        if mean - base > 1.75: dy -= int(np.ceil(mean - base - 1.75))
        if base - mean > 1.75: dy += int(np.ceil(base - mean - 1.75))
        off = np.mean([upper_offset(shift(c, 0, dy), idle[0]) for c in walk]); dx = int(round(off)) if abs(off) > 1 else 0
        walk = [shift(c, dx, dy) for c in walk]
        rest = max((3, 9), key=lambda i: iou(walk[i], idle[0]))
        rest_dy = lowest(idle[0]) - lowest(walk[rest])   # a passing cel's sole sits up-screen of where she stops
        put(heading_clip('walk', d), walk); put(heading_clip('rest', d), [shift(walk[rest], 0, rest_dy)])
        placement[d] = dict(walk_job=job, idleDy=idle_dy[d], walkDx=dx, walkDy=dy, restCel=rest, restDy=rest_dy, contact_rows=cr)
        if 'jog' in A: placement[d].update(jog(char, d, A['jog'][d], idle, idle_dy[d], put))
        # hit: stance, H1-H3, stance
        job = A['hit'][d]; gen = load_gen(job, 3, char); root96 = on_canvas(stance_root[d], 96)
        frames, box, anchor = trim([root96] + gen, 96, idle_dy[d])
        name = 'hit' + CAMEL[d]; put_take(name, frames, box, anchor, shipped_clips[name])
        placement[d]['hit_job'] = job
    for d in ['south-east', 'south-west', 'north-east', 'north-west']:
        job = A['ko'][d]; gen = load_gen(job, 6, char); root = on_canvas(stance_root[d], 128)
        frames, box, anchor = trim([root] + gen, 128, idle_dy[d])
        name = 'ko' + CAMEL[d]; put_take(name, frames, box, anchor, shipped_clips[name])
        placement[d]['ko_job'] = job
    # bend
    spec = SPECS[char]['bend']; bend = json.loads(json.dumps(bend_ship))
    for d in DIRS:
        fac = bend['facings'][BEND_FACING[d]]; job = A['bend'][d]
        design = json.load(open(HERE / f'design/{char}/bend-{d}.json'))
        gen = load_gen(job, len(spec['cels']), char); root = on_canvas(stance_root[d], 128)
        cels = {0: root}; kps = {0: kp_px(design['first_frame_keypoints'], 128)}
        for j, c in enumerate(spec['cels']): cels[c] = gen[j]; kps[c] = kp_px(design['frames'][j], 128)
        names = sorted({int(n.split('/')[-1]) for n in fac['frames']})
        missing = [n for n in names if n not in cels]
        if missing: raise SystemExit(f'{char} bend {d}: no cel for {missing}')
        frames, box, anchor = trim([cels[n] for n in names], 128, idle_dy[d])
        byname = dict(zip(names, frames))
        name = 'bend' + CAMEL[d]
        put(name, frames, cel_names=names)
        sockets = []
        for pos, fname in enumerate(fac['frames']):
            n = int(fname.split('/')[-1]); P = kps[n]; s = {}
            for sk, label in SOCKET.items():
                x, y = P[label][0] - box[0], P[label][1] - box[1]
                if sk in ('LW', 'RW'): x, y = snap(byname[n], (x, y))
                s[sk] = {'x': round(float(x), 3), 'y': round(float(y), 3)}
            sockets.append({'frame': pos, 'sockets': s})
        W = 128
        fac.update(sourceSize={'width': W, 'height': W}, root={'x': CANVAS[W][0] + FOOT[0], 'y': round(CANVAS[W][1] + FOOT[1] - idle_dy[d], 6)}, scale=1,
                   frameSize={'width': box[2] - box[0], 'height': box[3] - box[1]}, anchor=anchor, socketsPerFrame=sockets)
        placement[d]['bend_job'] = job
    # cast: east bend stance, anticipation, contact (first of each role)
    fac = bend['facings']['east']; keys = sorted(fac['keyFrames'].values(), key=lambda v: v['frame'])
    contact = next(k['frame'] for k in keys if k['role'] == 'contact')
    ant = [k['frame'] for k in keys if k['role'] == 'anticipation' and k['frame'] < contact]
    pick = [0, ant[-1] if ant else 1, contact]   # stance, the last wind-up before the first strike, the strike
    names = clips['bendEast']['cel_names']
    east = [Image.open(out / clips['bendEast']['cels'][names.index(int(fac['frames'][p].split('/')[-1]))]) for p in pick]
    put('cast', east, frameSize=fac['frameSize'] and {'w': fac['frameSize']['width'], 'h': fac['frameSize']['height']}, anchor=fac['anchor'],
        fps=8, loop=False, source=f'bendEast frames {pick}')
    ko = clips['koSouthEast']
    put('ko', [Image.open(out / ko['cels'][ko['cel_names'].index(ko['frameNames'][-1])])], frameSize=ko['frameSize'], anchor=ko['anchor'], fps=1, loop=False, source='koSouthEast last cel')
    # riverside wave and tea, reduced
    if char in ('kaya', 'sura'):
        page = json.load(open(SHIPPED / f'riverside-{char}.json')); im = Image.open(SHIPPED / page['meta']['image']).convert('RGBA')
        pal = np.asarray(Image.open(HERE / f'b/{char}/palette.png').convert('RGB'))[0, ::8].astype(np.int32)
        for clip in ('wave', 'tea'):
            cels = []
            for i in range(2):
                f = page['frames'][f'{key}/{clip}/{i}']['frame']
                cels.append(R.reduce_cel(im.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])), pal))
            put(clip, cels, source=f'riverside-{char} {clip}, reduced 2x (reduce.py)')
    json.dump({'key': key, 'grid': {'pixelsPerTile': 64, 'frame': [FRAME_W, FRAME_H], 'foot': FOOT, 'margin': MARGIN},
               'clips': clips, 'bend': bend, 'placement': placement}, open(out / 'pack.json', 'w'), indent=1)
    print(char, len(clips), 'clips;', json.dumps({d: {k: v for k, v in p.items() if k in ('walkDx', 'walkDy', 'restCel')} for d, p in placement.items()}))


if __name__ == '__main__':
    for c in sys.argv[1:] or ['kaya', 'sura', 'bo']: build(c)
