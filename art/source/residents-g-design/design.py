"""Ba Dan resident G motion design: CMU mocap delta-retargeted onto each resident's own rotation skeleton.

usage: design.py CHAR CAND [DIR ...]      (CAND in clips.json; DIR defaults to all eight)
Writes ../<char>-g/design/kp/<cand>-<dir>.json and a preview strip ../<char>-g/design/prev/<cand>-<dir>.png.

The recipe is the thug's (art/source/thug-actions-g/design/design.py): P_f[j] = SRC[j] + s * (proj(X_f[j]) - proj(X_ref[j])),
the same camera (yaw per facing, pitch 35), the head and face riding the neck unchanged, z order from depth. SRC is the
estimate-skeleton of the approved rotation for that heading (../<char>-g/rotations/skeleton/<dir>.json). No pose is hand authored.

walk: one gait cycle of the CMU clip, from a left-foot contact, resampled to `frames` cels, root-locked (the horizontal pelvis
travel is removed, the vertical bob kept); the reference X_ref is the cycle mean, so the mean walk pose lands on the standing rotation.
idle: `frames` samples of a CMU standing take at `step` seconds from `start`, deltas against the first sample, scaled by `amp`.
"""
import sys, json, math
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
sys.dont_write_bytecode = True
HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import mocap
CMU = Path(__import__('os').environ.get('CMU_DIR', HERE / 'cmu'))   # fetch-cmu.sh downloads the takes here (untracked)
CLIPS = json.load(open(HERE / 'clips.json'))
NAMES = dict(NOSE='NOSE', RE='RIGHT EYE', LE='LEFT EYE', REAR='RIGHT EAR', LEAR='LEFT EAR', NECK='NECK', RS='RIGHT SHOULDER', LS='LEFT SHOULDER',
             REL='RIGHT ELBOW', LEL='LEFT ELBOW', RW='RIGHT ARM', LW='LEFT ARM', RH='RIGHT HIP', LH='LEFT HIP', RK='RIGHT KNEE', LK='LEFT KNEE',
             RA='RIGHT LEG', LA='LEFT LEG')
INV = {v: k for k, v in NAMES.items()}
MJ = dict(RS='rsho', LS='lsho', REL='relb', LEL='lelb', RW='rhand', LW='lhand', RH='rhip', LH='lhip', RK='rknee', LK='lknee', RA='rank', LA='lank', NECK='neck')
PITCH = 35.0
HEAD = ['NOSE', 'RE', 'LE', 'REAR', 'LEAR']
_d = math.degrees(math.atan(math.sin(math.radians(PITCH)) / 0.5))
YAW = {'south': 0.0, 'north': 180.0, 'east': 90.0, 'west': -90.0, 'south-east': _d, 'south-west': -_d, 'north-east': 180.0 - _d, 'north-west': -(180.0 - _d)}
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
W_, H_ = 192, 192


def unit(v): return v / np.linalg.norm(v)


def rotz(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1.0]])


_cache = {}


def load(clip):
    if clip not in _cache:
        subj = clip.split('_')[0]
        _cache[clip] = mocap.load(('cmu', str(CMU / f'{subj}.asf'), str(CMU / f'{clip}.amc')))
    return _cache[clip]


def pts3d(J, f):
    """Joints at (possibly fractional) frame f, linearly interpolated."""
    f0 = int(math.floor(f)); f1 = min(f0 + 1, len(J['neck']) - 1); a = f - f0
    g = lambda k: J[k][f0] * (1 - a) + J[k][f1] * a
    P = {k: g(v) for k, v in MJ.items()}
    h = g('head'); nk = g('neck'); up = unit(h - nk); L = float(np.linalg.norm(h - nk))
    lat = g('lsho') - g('rsho'); lat[2] = 0; lat = unit(lat); fw = np.cross(lat, np.array([0, 0, 1.0]))
    c = nk + up * L * 0.6
    P['NOSE'] = c + fw * L * 0.45
    P['RE'] = c + fw * L * 0.4 - lat * L * 0.15 + up * L * 0.1
    P['LE'] = c + fw * L * 0.4 + lat * L * 0.15 + up * L * 0.1
    P['REAR'] = c - lat * L * 0.4; P['LEAR'] = c + lat * L * 0.4
    P['M'] = (P['RH'] + P['LH']) / 2
    return P


def gait_cycle(J, spec):
    """(start, period, fwd): left-foot-forward peak to the next, on the straightest steady cycle of the take
    (heading from the pelvis travel over the cycle itself; spec 'cycle' picks one by index instead)."""
    root = J['root']; n = len(root); fps = 120
    vel = np.zeros((n, 2)); h = 30
    for f in range(n): vel[f] = (root[min(n - 1, f + h), :2] - root[max(0, f - h), :2])
    off = np.array([(J['lank'][f] - J['rank'][f])[:2] @ (vel[f] / (np.linalg.norm(vel[f]) + 1e-9)) for f in range(n)])
    sm = np.convolve(off, np.ones(9) / 9, mode='same'); w = 20
    peaks = [f for f in range(w, n - w) if sm[f] == sm[f - w:f + w + 1].max() and sm[f] > 0.5 * sm.max() * 0.5]
    cyc = []
    for p, q in zip(peaks, peaks[1:]):
        d = root[q, :2] - root[p, :2]; L = float(np.linalg.norm(d)); per = q - p
        if per < 60 or per > 260 or L < 1e-6: continue
        path = float(np.sum(np.linalg.norm(np.diff(root[p:q + 1, :2], axis=0), axis=1)))
        hd = [math.degrees(math.atan2(*vel[f][::-1])) for f in range(p, q + 1)]
        turn = float(np.ptp(np.unwrap(np.radians(hd))) * 180 / math.pi)
        cyc.append(dict(p=p, per=per, straight=L / path, turn=turn, speed=L / per * fps, fwd=np.array([*(d / L), 0.0])))
    if not cyc: raise SystemExit(f'no gait cycle in {spec["clip"]}: peaks {peaks[:20]}')
    if 'cycle' in spec: c = cyc[spec['cycle']]
    else:
        med = np.median([c['speed'] for c in cyc])
        good = [c for c in cyc if c['straight'] > 0.97 and c['turn'] < 25 and abs(c['speed'] - med) < 0.35 * med] or cyc
        c = max(good, key=lambda c: (c['straight'], -c['turn']))
    spec['_cycle'] = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in c.items() if k != 'fwd'}
    return float(c['p']), float(c['per']), c['fwd']


def build(char, cand, d):
    spec = CLIPS[cand]; J, fps, n = load(spec['clip'])
    up = np.array([0, 0, 1.0])
    if spec['kind'] == 'walk':
        start, period, fwd = gait_cycle(J, spec)
        nf = spec['frames']; fsrc = [start + period * i / nf for i in range(nf)]
    else:
        fwd = None; nf = spec['frames']; f0 = spec['start'] * fps
        fsrc = [f0 + spec['step'] * fps * i for i in range(nf)]
    ref_f = fsrc[0]
    if fwd is None:
        P0 = pts3d(J, ref_f); lat = P0['LH'] - P0['RH']; lat[2] = 0; lat = unit(lat); fwd = np.cross(lat, up)
    lat = unit(np.cross(fwd, up)) * -1    # performer's left
    Rm = np.array([lat, -fwd, up])        # performer faces -Y, toward the camera at yaw 0
    Rz = rotz(YAW[d]); th = math.radians(PITCH)

    def proj(p):
        q = Rz @ p
        return np.array([q[0], -(q[1] * math.sin(th) + q[2] * math.cos(th))]), q[1] * math.cos(th) - q[2] * math.sin(th)

    def frame(f):
        P = pts3d(J, f); o = P['M'].copy(); o[2] = 0.0
        if spec['kind'] != 'walk': o = pts3d(J, ref_f)['M'].copy(); o[2] = 0.0
        return {k: Rm @ (v - o) for k, v in P.items()}

    Xs = [frame(f) for f in fsrc]
    if spec['kind'] == 'walk':
        X0 = {k: np.mean([X[k] for X in Xs], axis=0) for k in Xs[0]}   # cycle mean: the standing pose the rotation is in
        # keep the pelvis bob relative to the mean, but the mean foot height on the ground
    else:
        X0 = Xs[0]
    sk = json.load(open(HERE.parent / f'{char}-g/rotations/skeleton/{d}.json'))
    S = {INV[j['label']]: np.array([j['x'] * W_, j['y'] * H_]) for j in sk['keypoints']}
    Sm = (S['RH'] + S['LH']) / 2
    s = float(np.linalg.norm(S['NECK'] - Sm)) / float(np.linalg.norm(proj(X0['NECK'])[0] - proj(X0['M'])[0]))
    s *= spec.get('scale_mul', 1.0)
    amp = spec.get('amp', 1.0); arm = spec.get('arm_amp', amp); leg = spec.get('leg_amp', amp)
    pxs, dps = [], []
    for X in Xs:
        P = {}; Dp = {}
        for k in NAMES:
            a = arm if k in ('REL', 'LEL', 'RW', 'LW') else leg if k in ('RK', 'LK', 'RA', 'LA') else amp
            for lk in spec.get('locked', []):          # a joint holding a prop (stick, spear, cabbage) keeps the rotation's place
                if k in lk.split('+'): a = spec.get('locked_amp', 0.0)
            Y = X0[k] + a * (X[k] - X0[k])
            P[k] = S[k] + s * (proj(Y)[0] - proj(X0[k])[0]); Dp[k] = proj(Y)[1]
        for k in HEAD:
            P[k] = P['NECK'] + (S[k] - S['NECK']); Dp[k] = proj(X0[k])[1]
        pxs.append(P); dps.append(Dp)
    first = {k: S[k].copy() for k in NAMES}; dfirst = {k: proj(X0[k])[1] for k in NAMES}
    finish(char, cand, d, spec, first, dfirst, pxs, dps, s, fsrc)


def kp(d, P, Dp):
    order = sorted(NAMES, key=lambda k: -Dp[k]); face = ['NOSE', 'RE', 'LE']
    seq = list(order) if d.startswith('north') else [q for q in order if q not in face] + ['LE', 'RE', 'NOSE']
    z = {k: i + 1 for i, k in enumerate(seq)}
    return [{'label': NAMES[k], 'x': round(float(P[k][0]) / W_, 4), 'y': round(float(P[k][1]) / H_, 4), 'z_index': z[k]} for k in NAMES]


def finish(char, cand, d, spec, first, dfirst, pxs, dps, s, fsrc):
    kps = [kp(d, P, D) for P, D in zip(pxs, dps)]
    allp = np.array([v for P in pxs for v in P.values()])
    ok = bool((allp[:, 0].min() >= 0.02 * W_) and (allp[:, 0].max() <= 0.98 * W_) and (allp[:, 1].min() >= 0.02 * H_) and (allp[:, 1].max() <= 0.98 * H_))
    rec = dict(char=char, cand=cand, dir=d, clip=spec['clip'], cycle=spec.get('_cycle'), kind=spec['kind'], src_frames=[round(f, 2) for f in fsrc], ms=spec.get('ms'),
               action=spec['action'], attribution=spec['attribution'], scale=s, fits=ok, bounds=[allp.min(0).tolist(), allp.max(0).tolist()],
               first_frame_keypoints=kp(d, first, dfirst), frames=kps, px=[{k: [float(v[0]), float(v[1])] for k, v in P.items()} for P in pxs])
    out = HERE.parent / f'{char}-g/design'
    (out / 'kp').mkdir(parents=True, exist_ok=True); json.dump(rec, open(out / f'kp/{cand}-{d}.json', 'w'))
    BON = [('NECK', 'RS'), ('NECK', 'LS'), ('RS', 'REL'), ('REL', 'RW'), ('LS', 'LEL'), ('LEL', 'LW'), ('NECK', 'RH'), ('NECK', 'LH'), ('RH', 'LH'),
           ('RH', 'RK'), ('RK', 'RA'), ('LH', 'LK'), ('LK', 'LA'), ('NECK', 'NOSE')]
    src = Image.open(HERE.parent / f'{char}-g/rotations/{d}.png').convert('RGBA'); SC = 2; cells = []
    for i, P in enumerate([first] + pxs):
        bg = Image.new('RGBA', (W_, H_), (60, 60, 70, 255)); bg.alpha_composite(src); bg = Image.blend(bg, Image.new('RGBA', (W_, H_), (60, 60, 70, 255)), 0.7)
        im = bg.resize((W_ * SC, H_ * SC), Image.NEAREST); dr = ImageDraw.Draw(im)
        for a_, b_ in BON:
            dr.line([tuple(P[a_] * SC), tuple(P[b_] * SC)], fill=(255, 80, 80) if (a_[0] == 'R' or b_[0] == 'R') else (80, 200, 255), width=2)
        dr.text((4, 4), f'{cand} {d} f{i - 1 if i else "ref"}', fill=(255, 255, 255)); cells.append(im)
    sh = Image.new('RGBA', (W_ * SC * len(cells), H_ * SC), (30, 30, 30, 255))
    for i, c in enumerate(cells): sh.paste(c, (i * W_ * SC, 0))
    (out / 'prev').mkdir(exist_ok=True); sh.convert('RGB').save(out / f'prev/{cand}-{d}.png')
    print(char, cand, d, 'fits', ok, 'scale', round(s, 3), 'bounds', np.round(allp.min(0)), np.round(allp.max(0)))


if __name__ == '__main__':
    char, cand = sys.argv[1:3]
    for d in (sys.argv[3:] or DIRS): build(char, cand, d)
