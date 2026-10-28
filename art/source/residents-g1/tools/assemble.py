"""Step 6: assemble every packed cel of the nine G1 sheets from the curated roots, the breath loops and the takes.

usage (repo root): python3 -I art/source/residents-g1/tools/assemble.py [name ...]
Reads   assembly.json (which take each clip and heading uses), curate.json (the bandits' cast picks), roots/, cels/<name>/idle/
        (breath.py), raw/, design/, and the bandits' shipped clip timing frozen in shipped/ (clip names, frame lists and timing
        are kept exactly; only pixels, frame sizes and anchors change).
Writes  cels/<name>/<clip>/NN.png and cels/<name>/pack.json, which scripts/art/residents-g1.ts packs and pins.

Deterministic. The party's rule set (art/source/party-g1/tools/assemble.py, ADR 0089), measured on the placed cels; the
numbers it chose are in pack.json `placement`:
- Grid: 64 px a tile, a 64x96 cel, the foot point at (W/2, 81.6) (anchor 0.5, 0.85). The bruiser's root is 80 px wide
  (the shipped cel was 160 at 2x); the thug's and the bruiser's packed cels are 80 and 96 px (`pack_w`) for the club's
  swing, every cel centred on them. A root is already placed there: it is a redraw of the shipped cel reduced 2x, which carried the shipped placement.
- Every generated cel goes through the palette lock and binary alpha, and loses any island under 60 px that does not touch
  the body.
- Idle: `idleDy` the fewest pixels that stand idle cel 0 within 3 px of the foot line (art:validate's 6 at 128 px a tile).
- Walk (8 cels): cropped from its 96 canvas. `walkDy` puts the mean of the two contact cels' soles on idle cel 0's sole;
  north is drawn level with idle. Then, where the walk's mean lowest row sits more than 1.75 px from idle's, it moves the
  fewest pixels that bring it inside. `walkDx` moves it by the rounded mean upper-body offset against idle cel 0 when that
  exceeds 1 px.
- Clearance: where a walk's ink still enters the 4 px clear margin, it moves the fewest pixels (at most 2) that clear it.
- Rest: of the two passing cels (2 and 6 of the 8-cel cycle) whose feet, set on idle's sole, stand within art:validate's
  rest bound of the column, the one whose silhouette best overlaps idle cel 0; where neither does, any walk cel that does
  (Mira's south: her stick tip sits in the lowest rows).
- Bandits' hit (8 headings) and knockout (4 diagonals): frame 0 (and a hit's last frame) is the idle root itself on the
  take's canvas, as the shipped bandit clips start on idle cel 0 (an enemy has no fighting stance); the take is trimmed to
  the union of its ink plus a 4 px margin; the anchor is the idle's foot point in that box.
- Bandits' legacy mirrored clips: `cast` is the three redrawn cast roots (the old sheet's swing, full cel); the one-cel `hit`
  the east hit's deepest flinch (cel 2) and `ko` the south-east knockout's last cel, each a trimmed cel with its own
  rectangle and anchor.
- Knockout hold: the last generated cel (CMU 90_18 frame 170) smeared or ghosted in about half the takes, so on every
  diagonal cel 6 repeats cel 5 (frame 142, already lying flat): the clip's frame list and timing are unchanged.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from palette_lock import lock
from motion import DIRS, origin
HERE = Path(__file__).resolve().parent.parent
C = json.load(open(HERE / 'tools/chars.json'))
SHIPPED = HERE / 'shipped'
FRAME_H = 96
MARGIN = 4
STAND = 3
WALK = 8
PASSING = (2, 6)
CAMEL = {'east': 'East', 'south-east': 'SouthEast', 'south': 'South', 'south-west': 'SouthWest', 'west': 'West',
         'north-west': 'NorthWest', 'north': 'North', 'north-east': 'NorthEast'}
DIAGONALS = ['south-east', 'south-west', 'north-east', 'north-west']


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


ISLAND = 60


def islands(im):
    """Drop opaque 8-connected islands that do not touch the largest one and are smaller than ISLAND px."""
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


REST_CENTRE = 6   # art:validate's rest bound at this grid (12 px at 128 px a tile)


def foot_centre(im, rows=6):
    """art:validate's footCentre: the x centre of the opaque pixels in the lowest `rows` rows."""
    a = alpha(im); ys = np.nonzero(a.any(1))[0]; low = ys.max(); band = a[low - rows + 1:low + 1]
    xs = np.nonzero(band)[1]; return float(xs.mean())


CLEAR = 2   # px: the most a walk moves sideways to keep a swinging prop out of the clear margin


def clearance(cels):
    """The fewest pixels (at most CLEAR) that move every cel's ink out of the MARGIN px clear margin at the sides."""
    a = np.zeros_like(alpha(cels[0]))
    for c in cels: a |= alpha(c)
    xs = np.nonzero(a.any(0))[0]; left = xs.min() - MARGIN; right = a.shape[1] - MARGIN - 1 - xs.max()
    if left < 0 and right >= -left: return min(-left, CLEAR)
    if right < 0 and left >= -right: return -min(-right, CLEAR)
    return 0


def load_gen(job, n, name):
    return [islands(lock(Image.open(HERE / f'raw/{job}/{i:02d}.png'), name)) for i in range(n)]


def on_canvas(name, img, W):
    x, y = origin(name, W); c = Image.new('RGBA', (W, W), (0, 0, 0, 0)); c.alpha_composite(img, (x, y)); return c


def trim(name, frames, W, foot, dy=0):
    """Union ink box of a take plus the margin, the cropped cels and the anchor of the idle foot point."""
    m = np.zeros((W, W), bool)
    for f in frames: m |= alpha(f)
    ys, xs = np.nonzero(m)
    x0, y0 = max(0, xs.min() - MARGIN), max(0, ys.min() - MARGIN); x1, y1 = min(W, xs.max() + 1 + MARGIN), min(W, ys.max() + 1 + MARGIN)
    if xs.min() - MARGIN < 0 or ys.min() - MARGIN < 0 or xs.max() + 1 + MARGIN > W or ys.max() + 1 + MARGIN > W:
        print('  WARNING: take ink reaches the canvas edge; margin clipped')
    ox, oy = origin(name, W)
    fx, fy = ox + foot[0], oy + foot[1] - dy
    box = (int(x0), int(y0), int(x1), int(y1))
    anchor = {'x': round((fx - x0) / (x1 - x0), 6), 'y': round((fy - y0) / (y1 - y0), 6)}
    return [f.crop(box) for f in frames], box, anchor


def build(name):
    A = json.load(open(HERE / 'assembly.json'))[name]; spec = C[name]
    fw = spec['frame_w']; foot = (fw / 2, 0.85 * FRAME_H); line = int(round(foot[1]))
    # The packed cel may be wider than the drawn root (`pack_w`, ADR 0032): the club's swing reaches past the root's cel in
    # the west-side walks. Every cel is centred on it unchanged, so the feet keep the anchor column.
    pw = spec.get('pack_w', fw); pad = (pw - fw) // 2

    def widen(im):
        if pw == fw: return im
        out = Image.new('RGBA', (pw, im.height), (0, 0, 0, 0)); out.alpha_composite(im, (pad, 0)); return out
    out = HERE / f'cels/{name}'; clips = {}; placement = {}

    def put(clip, cels, **meta):
        d = out / clip; d.mkdir(parents=True, exist_ok=True)
        for old in d.glob('*.png'): old.unlink()
        for i, c in enumerate(cels): c.save(d / f'{i:02d}.png')
        clips[clip] = dict(cels=[f'{clip}/{i:02d}.png' for i in range(len(cels))], **meta)

    def put_take(clip, frames, box, anchor, ship):
        idx = [int(f.split('/')[-1]) for f in ship['frames']]; used = sorted(set(idx))
        put(clip, [frames[i] for i in used], frameNames=idx, frameSize={'w': box[2] - box[0], 'h': box[3] - box[1]},
            anchor=anchor, fps=ship['fps'], loop=ship['loop'], frameMs=ship['frameMs'])

    root = {d: Image.open(HERE / f'roots/{name}/idle/{d}.png').convert('RGBA') for d in DIRS}
    idle_dy = {}
    for d in DIRS:
        low = lowest(Image.open(out / f'idle/{d}/00.png').convert('RGBA'))
        idle_dy[d] = (line - STAND - low) if low < line - STAND else (line + STAND - low) if low > line + STAND else 0
    for d in DIRS:
        idle = [widen(shift(Image.open(out / f'idle/{d}/{i:02d}.png').convert('RGBA'), 0, idle_dy[d])) for i in range(4)]
        put(heading_clip('idle', d), idle)
        job = A['walk'][d]; design = json.load(open(HERE / f'design/{name}/walk-{d}.json'))
        ox = origin(name, 96)[0]
        walk = [shift(c.crop((ox - pad, 0, ox + fw + pad, 96)), 0, idle_dy[d]) for c in load_gen(job, WALK, name)]
        base = lowest(idle[0]); cr = design['info']['contact_rows']
        if d == 'north': dy = 0
        else: dy = -int(round((lowest(walk[cr['LA']['cel']]) + lowest(walk[cr['RA']['cel']])) / 2 - base))
        mean = np.mean([lowest(c) for c in walk]) + dy
        if mean - base > 1.75: dy -= int(np.ceil(mean - base - 1.75))
        if base - mean > 1.75: dy += int(np.ceil(base - mean - 1.75))
        off = np.mean([upper_offset(shift(c, 0, dy), idle[0]) for c in walk]); dx = int(round(off)) if abs(off) > 1 else 0
        dx += int(clearance([shift(c, dx, dy) for c in walk]))
        walk = [shift(c, dx, dy) for c in walk]
        # A passing cel whose feet stand under the figure (art:validate's rest bound); else any walk cel that does.
        def settled(i): return shift(walk[i], 0, lowest(idle[0]) - lowest(walk[i]))
        ok = [i for i in range(WALK) if abs(foot_centre(settled(i)) - pw / 2) <= REST_CENTRE]
        pool = [i for i in PASSING if i in ok] or ok or list(PASSING)
        rest = max(pool, key=lambda i: iou(walk[i], idle[0]))
        rest_dy = lowest(idle[0]) - lowest(walk[rest])
        put(heading_clip('walk', d), walk); put(heading_clip('rest', d), [shift(walk[rest], 0, rest_dy)])
        placement[d] = dict(walk_job=job, idleDy=idle_dy[d], walkDx=dx, walkDy=dy, restCel=rest, restDy=rest_dy, contact_rows=cr)
    if spec['kind'] == 'bandit':
        shipped = json.load(open(SHIPPED / f'{name}-g-clips.json'))
        for d in DIRS:
            job = A['hit'][d]; gen = load_gen(job, 3, name)
            frames, box, anchor = trim(name, [on_canvas(name, root[d], 96)] + gen, 96, foot, idle_dy[d])
            clip = 'hit' + CAMEL[d]; put_take(clip, frames, box, anchor, shipped[clip]); placement[d]['hit_job'] = job
        for d in DIAGONALS:
            job = A['ko'][d]; gen = load_gen(job, 6, name)
            gen[5] = gen[4]   # the final rest cel holds cel 5: the take's own last cel smears too often (assembly.json _why)
            frames, box, anchor = trim(name, [on_canvas(name, root[d], 128)] + gen, 128, foot, idle_dy[d])
            clip = 'ko' + CAMEL[d]; put_take(clip, frames, box, anchor, shipped[clip]); placement[d]['ko_job'] = job
        picks = json.load(open(HERE / 'curate.json'))['pick']
        cast = [lock(Image.open(HERE / 'raw' / picks[f'{name}/cast/{i}']), name) for i in range(3)]
        put('cast', [widen(shift(c, 0, idle_dy['east'])) for c in cast], fps=8, loop=False, source='the old sheet\'s cast, redrawn (curate.json)')
        h = clips['hitEast']; cel = 2
        put('hit', [Image.open(out / h['cels'][sorted(set(h['frameNames'])).index(cel)])], frameSize=h['frameSize'], anchor=h['anchor'],
            fps=1, loop=False, source='hitEast cel 2')
        k = clips['koSouthEast']; last = k['frameNames'][-1]
        put('ko', [Image.open(out / k['cels'][sorted(set(k['frameNames'])).index(last)])], frameSize=k['frameSize'], anchor=k['anchor'],
            fps=1, loop=False, source='koSouthEast last cel')
    json.dump({'key': spec['key'], 'kind': spec['kind'], 'grid': {'pixelsPerTile': 64, 'frame': [pw, FRAME_H], 'foot': (pw / 2, foot[1]), 'margin': MARGIN},
               'clips': clips, 'placement': placement}, open(out / 'pack.json', 'w'), indent=1)
    print(name, len(clips), 'clips;', json.dumps({d: {k: v for k, v in p.items() if k in ('idleDy', 'walkDx', 'walkDy', 'restCel')} for d, p in placement.items()}))


if __name__ == '__main__':
    for n in sys.argv[1:] or list(C): build(n)
