"""review.py CHAR : the review sheet and fault table for a resident's G locomotion.

Reads ../<char>-g/assembly.json ({dir: {idle: raw job, walk: raw job}}), places every 192 px raw cel the way the G build
does (75% nearest-neighbour into the 128x192 cel at x -8, y 31, ADR 0050) and draws, per heading, Kaya's shipped idle cel 0
and walk cels beside the resident's idle 4 and walk 8 at game scale (1.25x, the oblique actor scale) on a ground-grey field.
Writes ../<char>-g/review/sheet-<dir-group>.png, review/gates.json and review/faults.md.

Gates (measured on the placed cels, alpha > 0):
- height / foot row: idle cel 0 height and lowest row against the rotation's; walk lowest-row spread (bob / sunk feet).
- boil: share of opaque pixels that change between consecutive idle cels inside the head and torso box beyond a 1 px
  shift search; PixelLab redraws every frame, so a still idle that boils shows here.
- identity: mean colour distance of each cel's 12-colour palette to the rotation's (drift between directions or frames).
- stride axis: the angle of the foot-separation vector at the widest stride against the heading's screen travel axis.
- slide: the planted (lowest) foot's x drift across consecutive cels where it stays lowest, root-locked cels should hold it.
"""
import sys, json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
HERE = Path(__file__).parent
KAYA = Path('/tmp/claude-0/s/kaya')
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
KN = {'south': 'South', 'south-east': 'SouthEast', 'east': 'East', 'north-east': 'NorthEast', 'north': 'North', 'north-west': 'NorthWest', 'west': 'West', 'south-west': 'SouthWest'}
# screen travel direction of each heading on the oblique board (x right, y down)
AX = {'south': (0, 1), 'north': (0, -1), 'east': (1, 0), 'west': (-1, 0), 'south-east': (1, 0.7), 'south-west': (-1, 0.7), 'north-east': (1, -0.7), 'north-west': (-1, -0.7)}
FIELD = (104, 112, 92, 255)


def place(im):
    """192 px raw cel -> 128x192 G cel (75% nearest, x -8, y 31)."""
    im = im.convert('RGBA'); s = im.resize((144, 144), Image.NEAREST)
    c = Image.new('RGBA', (128, 192), (0, 0, 0, 0)); c.alpha_composite(s, (-8, 31)) if False else c.paste(s, (-8, 31), s); return c


def alpha(im): return np.array(im)[:, :, 3] > 0


def bbox(im):
    a = alpha(im); ys, xs = np.nonzero(a)
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else None


def palette(im, k=12):
    a = np.array(im); px = a[a[:, :, 3] > 0][:, :3].astype(float)
    q = Image.fromarray(px.reshape(-1, 1, 3).astype(np.uint8)).quantize(k, method=Image.Quantize.MEDIANCUT)
    p = np.array(q.getpalette()[:k * 3]).reshape(-1, 3); cnt = np.bincount(np.array(q).ravel(), minlength=k)[:len(p)]
    return p, cnt / cnt.sum()


def pal_dist(a, b):
    (pa, wa), (pb, wb) = a, b
    d1 = sum(w * np.min(np.linalg.norm(pb - c, axis=1)) for c, w in zip(pa, wa))
    d2 = sum(w * np.min(np.linalg.norm(pa - c, axis=1)) for c, w in zip(pb, wb))
    return float((d1 + d2) / 2)


def boil(a, b, box):
    x0, y0, x1, y1 = box; A = np.array(a).astype(int); Bm = np.array(b).astype(int); best = 1.0
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            Bs = np.roll(np.roll(Bm, dy, 0), dx, 1)
            sa = A[y0:y1, x0:x1]; sb = Bs[y0:y1, x0:x1]; m = (sa[:, :, 3] > 0) | (sb[:, :, 3] > 0)
            if m.sum() == 0: continue
            diff = (np.abs(sa - sb).sum(2) > 60) & m
            best = min(best, diff.sum() / m.sum())
    return float(best)


def feet(im):
    """(x of the lowest opaque pixels' centre, lowest row, left foot x, right foot x) from the bottom 14 rows."""
    a = alpha(im); ys, xs = np.nonzero(a); y1 = ys.max(); sel = ys > y1 - 14
    fx = xs[sel]; fy = ys[sel]
    low = fx[fy >= y1 - 2]
    return float(low.mean()), int(y1), float(fx.min()), float(fx.max())


def blobs(im, min_px=12):
    """Sizes of the detached opaque blobs other than the largest (8-connected), smallest ignored: strays and ghosts."""
    a = alpha(im); H, W = a.shape; seen = np.zeros_like(a); sizes = []
    for y0, x0 in zip(*np.nonzero(a)):
        if seen[y0, x0]: continue
        st = [(y0, x0)]; seen[y0, x0] = True; n = 0
        while st:
            y, x = st.pop(); n += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and a[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; st.append((yy, xx))
        sizes.append(n)
    sizes.sort(reverse=True)
    return [s for s in sizes[1:] if s >= min_px]


def strip(cels, scale=1.25):
    W = int(128 * scale); H = int(192 * scale)
    s = Image.new('RGBA', (W * len(cels), H), FIELD)
    for i, c in enumerate(cels):
        if c is not None: s.alpha_composite(c.resize((W, H), Image.NEAREST), (i * W, 0))
    return s


def main(char):
    root = HERE.parent / f'{char}-g'; asm = json.load(open(root / 'assembly.json'))
    out = root / 'review'; out.mkdir(exist_ok=True); G = {}; faults = []
    rows = []; g2 = []
    for d in DIRS:
        if d not in asm: continue
        a = asm[d]; rot = place(Image.open(root / f'rotations/{d}.png'))
        idle = [place(Image.open(p)) for p in sorted((root / 'raw' / a['idle']).glob('*.png'))] if a.get('idle') else []
        walk = [place(Image.open(p)) for p in sorted((root / 'raw' / a['walk']).glob('*.png'))] if a.get('walk') else []
        ki = Image.open(KAYA / f'idle-{KN[d]}-0.png'); kw = [Image.open(KAYA / f'walk-{KN[d]}-{i}.png') for i in range(0, 12, 3)]
        rp = palette(rot); g = {'idle': {}, 'walk': {}}
        rs = blobs(rot)
        if rs: faults.append(f'{d} rotation: detached blobs {rs} px (stray strokes)')
        for clip, cels in (('idle', idle), ('walk', walk)):
            for i, c in enumerate(cels):
                bs = blobs(c)
                if bs and max(bs) >= 20: faults.append(f'{d} {clip} cel {i}: detached blob {max(bs)} px (ghost, smear or stray)')
        rb = bbox(rot); kb = bbox(ki)
        g['rotation_height'] = rb[3] - rb[1] + 1; g['kaya_height'] = kb[3] - kb[1] + 1; g['rotation_foot_row'] = rb[3]
        if idle:
            ib = [bbox(c) for c in idle]
            box = (rb[0], rb[1], rb[2] + 1, rb[1] + int((rb[3] - rb[1]) * 0.6))
            bo = [boil(idle[i], idle[(i + 1) % len(idle)], box) for i in range(len(idle))]
            pd = [pal_dist(rp, palette(c)) for c in idle]
            g['idle'] = dict(heights=[b[3] - b[1] + 1 for b in ib], foot_rows=[b[3] for b in ib], boil=[round(x, 3) for x in bo], palette_drift=[round(x, 1) for x in pd],
                             frame0_vs_rotation_boil=round(boil(rot, idle[0], box), 3))
            if max(bo) > 0.20: faults.append(f"{d} idle: boiling, {max(bo):.0%} of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)")
            if max(abs(r - rb[3]) for r in g['idle']['foot_rows']) > 2: faults.append(f'{d} idle: feet move {g["idle"]["foot_rows"]} against the rotation row {rb[3]}')
            if max(pd) > 18: faults.append(f'{d} idle: palette drift {max(pd):.0f} against the rotation (gate 18)')
        if walk:
            wb = [bbox(c) for c in walk]; ft = [feet(c) for c in walk]
            pd = [pal_dist(rp, palette(c)) for c in walk]
            spread = [f[3] - f[2] for f in ft]
            # stride axis: the widest-stride cel's two foot blobs in the bottom band
            i = int(np.argmax(spread)); c = walk[i]; A = alpha(c); ys, xs = np.nonzero(A); y1 = ys.max()
            band = (ys > y1 - 40) & (ys < y1 + 1); bx = xs[band]; by = ys[band]
            # split by x median; foot point = lowest pixel of each half
            med = np.median(bx); L = (bx <= med); Rr = ~L
            pl_ = np.array([bx[L][np.argmax(by[L])], by[L].max()]); pr_ = np.array([bx[Rr][np.argmax(by[Rr])], by[Rr].max()])
            v = pr_ - pl_; ax = np.array(AX[d], float)
            ang = abs(math.degrees(math.atan2(abs(v[0] * ax[1] - v[1] * ax[0]), abs(v @ ax)))) if np.linalg.norm(v) > 3 else None
            # slide: the lowest foot's x while the same foot stays lowest (successive cels with lowest-row x within 6 px)
            lx = [f[0] for f in ft]; slide = [abs(lx[j + 1] - lx[j]) for j in range(len(lx) - 1) if abs(lx[j + 1] - lx[j]) < 6]
            hs = [b[3] - b[1] + 1 for b in wb]
            g['walk'] = dict(heights=hs, foot_rows=[f[1] for f in ft], foot_spread=[round(s, 1) for s in spread], palette_drift=[round(x, 1) for x in pd],
                             stride_axis_off_deg=None if ang is None else round(ang, 1), planted_slide_px=[round(s, 1) for s in slide])
            if max(pd) > 18: faults.append(f'{d} walk: palette drift {max(pd):.0f} against the rotation (gate 18), identity may change mid-cycle')
            if ang is not None and d in ('east', 'west') and ang > 35: faults.append(f'{d} walk: stride {ang:.0f} deg off the travel axis')
            if max(hs) - min(hs) > 12: faults.append(f'{d} walk: height swings {min(hs)}-{max(hs)} px (bob or a collapsed cel)')
            if max(f[1] for f in ft) - rb[3] > 10: faults.append(f'{d} walk: a foot sinks {max(f[1] for f in ft) - rb[3]} px below the standing line')
            if rb[3] - min(f[1] for f in ft) > 12: faults.append(f'{d} walk: feet lift {rb[3] - min(f[1] for f in ft)} px above the standing line (floating cel)')
        G[d] = g
        lab = Image.new('RGBA', (160, 240), FIELD); ImageDraw.Draw(lab).text((6, 6), f'{d}\nKaya | {char}\nidle 4, walk 8', fill=(255, 255, 255, 255))
        row = [ki, rot] + idle + [None] + kw + [None] + walk
        rows.append((d, strip(row)))
        g2.append((d, [ki, rot] + idle[:1] + walk[::2]))
    for gi, grp in enumerate([DIRS[:4], DIRS[4:]]):
        rs = [r for d, r in rows if d in grp]
        if not rs: continue
        W = max(r.width for r in rs); H = sum(r.height + 18 for r in rs)
        sh = Image.new('RGBA', (W, H), (40, 44, 40, 255)); y = 0; dr = ImageDraw.Draw(sh)
        for (d, r) in [x for x in rows if x[0] in grp]:
            dr.text((4, y + 2), f'{d}:  Kaya idle0 | rotation | idle x4 | . | Kaya walk 0,3,6,9 | . | {char} walk x8   (game scale 1.25x)', fill=(230, 230, 230, 255))
            sh.alpha_composite(r, (0, y + 16)); y += r.height + 18
        sh.convert('RGB').save(out / f'sheet-{"south-to-north-east" if gi == 0 else "north-to-south-west"}.png')
    if g2:   # G2: the chunky 2x grain under test (figures ~38 px): every cel nearest-downsampled 2x, Kaya's the same way
        Z = 3; cw = 64 * Z; ch = 96 * Z
        sh = Image.new('RGBA', (cw * max(len(c) for _, c in g2), (ch + 16) * len(g2) + 40), (40, 44, 40, 255)); dr = ImageDraw.Draw(sh)
        dr.text((4, 4), f'G2 preview: 2x nearest downsample (64x96 cel), shown at {Z}x.  Kaya idle0 | {char} rotation | idle0 | walk 0,2,4,6', fill=(230, 230, 230, 255))
        for r, (d, cels) in enumerate(g2):
            y = 40 + r * (ch + 16); dr.text((4, y - 12), d, fill=(230, 230, 230, 255))
            for i, c in enumerate(cels):
                small = c.resize((64, 96), Image.NEAREST); tile = Image.new('RGBA', (64, 96), FIELD); tile.alpha_composite(small)
                sh.alpha_composite(tile.resize((cw, ch), Image.NEAREST), (i * cw, y))
        sh.convert('RGB').save(out / 'sheet-g2.png')
    json.dump(G, open(out / 'gates.json', 'w'), indent=1)
    open(out / 'faults.md', 'w').write(f'# {char} G review: measured flags\n\n' + ('\n'.join(f'- {f}' for f in faults) or '- none past the gates') + '\n')
    print('\n'.join(faults) or 'no flags')


if __name__ == '__main__': main(sys.argv[1])
