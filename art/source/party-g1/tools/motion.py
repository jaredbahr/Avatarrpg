"""Rollout motion design: CMU mocap retargeted onto each character's curated G1 root, one canvas per clip family.

usage (repo root): python3 -I art/source/party-g1/tools/motion.py CHAR CAND [DIR ...]   (CAND in motion.json)
Reads   roots/<char>/<root>/<dir>.png (curate.py) padded onto the candidate's canvas, and its skeleton
        roots/<char>/<root>/skeleton-<canvas>/<dir>.json (skeletons_g1.py; estimate-skeleton on that same padded canvas).
Writes  design/<char>/<cand>-<dir>.json (keypoints for animate-with-skeleton-v3) and design/<char>/prev/<cand>-<dir>.png.

Every pose comes from a CMU take; nothing is posed by hand. Two retargets, both from the residents' and the thug's recipes:

- `walk` and `pose` (delta retarget, draft #286 / thug design.py): P_f[j] = S[j] + s * (proj(X_f[j]) - proj(X_ref[j])), one
  camera (yaw per facing, pitch 35), head and face points riding the neck unchanged, z order from depth. S is the estimated
  skeleton of the curated root, s the ratio of its neck-to-pelvis length to the performer's.
  walk: one gait cycle of the take from a left-foot contact, resampled to `frames` cels, root-locked (horizontal pelvis travel
  removed), X_ref the cycle mean. Two corrections, both applied to the performer before projection, fix the #290 fault list's
  uneven steps: `track` scales the ankles' and knees' lateral offset from the pelvis line (the performer walks a 30 cm track;
  seen on a diagonal its two foot lines sit 5-7 px apart on screen, which read as a hitch), and `bob` scales the pelvis'
  vertical oscillation about its cycle mean (1 px at 59 px tall is no bob; the shipped walk bobs 2-3 px). Whatever difference
  is left between the two contact rows is reported as `contact_rows` and removed in packing by registration (pack_g1.py).
  pose: `frames` are CMU frame numbers (or {"f": n, "amp": a}) retargeted against the `ref` frame with amplitude `amp`.
- `ko` (bone-rotation retarget, the thug's ko.py, itself the party's design_hk): the root skeleton is lifted into the facing's
  character space and every bone turned by the performer's bone rotation from `ref`, torso and legs blended toward the
  performer's absolute direction by `absw` so a lying body lies flat, with a per-diagonal heading turn and root travel.
"""
import sys, json, math, os
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
sys.dont_write_bytecode = True
HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import mocap
CMU = Path(os.environ.get('CMU_DIR', HERE / 'cmu'))
SPECS = json.load(open(HERE / 'motion.json'))
NAMES = dict(NOSE='NOSE', RE='RIGHT EYE', LE='LEFT EYE', REAR='RIGHT EAR', LEAR='LEFT EAR', NECK='NECK', RS='RIGHT SHOULDER', LS='LEFT SHOULDER',
             REL='RIGHT ELBOW', LEL='LEFT ELBOW', RW='RIGHT ARM', LW='LEFT ARM', RH='RIGHT HIP', LH='LEFT HIP', RK='RIGHT KNEE', LK='LEFT KNEE',
             RA='RIGHT LEG', LA='LEFT LEG')
INV = {v: k for k, v in NAMES.items()}
MJ = dict(RS='rsho', LS='lsho', REL='relb', LEL='lelb', RW='rhand', LW='lhand', RH='rhip', LH='lhip', RK='rknee', LK='lknee', RA='rank', LA='lank', NECK='neck')
PITCH = 35.0
HEAD = ['NOSE', 'RE', 'LE', 'REAR', 'LEAR']
LEGS = ['RK', 'LK', 'RA', 'LA']
_d = math.degrees(math.atan(math.sin(math.radians(PITCH)) / 0.5))
YAW = {'south': 0.0, 'north': 180.0, 'east': 90.0, 'west': -90.0, 'south-east': _d, 'south-west': -_d, 'north-east': 180.0 - _d, 'north-west': -(180.0 - _d)}
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
# Where the 64x96 root sits on each canvas (left, top). 96: as #290's rotations; 128: room for a strike's reach and a fall.
CANVAS = {96: (16, 0), 128: (32, 16)}


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
    P['HEADTOP'] = h
    return P


def gait_cycle(J, clip, cycle=None):
    """(start, period, fwd): one left-foot-forward peak to the next on the straightest steady cycle (residents' rule).
    `cycle` [start, period] names it instead, for a take too short for the detector (one stride of a run across the room)."""
    root = J['root']; n = len(root); fps = 120
    if cycle:
        p, per = cycle; d = root[p + per, :2] - root[p, :2]; L = float(np.linalg.norm(d))
        return float(p), float(per), np.array([*(d / L), 0.0]), {'p': p, 'per': per, 'speed': round(L / per * fps, 3)}
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
    if not cyc: raise SystemExit(f'no gait cycle in {clip}')
    med = np.median([c['speed'] for c in cyc])
    good = [c for c in cyc if c['straight'] > 0.97 and c['turn'] < 25 and abs(c['speed'] - med) < 0.35 * med] or cyc
    c = max(good, key=lambda c: (c['straight'], -c['turn']))
    return float(c['p']), float(c['per']), c['fwd'], {k: (round(v, 3) if isinstance(v, float) else v) for k, v in c.items() if k != 'fwd'}


def camera(d):
    Rz = rotz(YAW[d]); th = math.radians(PITCH)

    def proj(p):
        q = Rz @ p
        return np.array([q[0], -(q[1] * math.sin(th) + q[2] * math.cos(th))]), q[1] * math.cos(th) - q[2] * math.sin(th)
    return proj


def skeleton(char, spec, d):
    W = spec['canvas']
    sk = json.load(open(ROOT / f'roots/{char}/{spec["root"]}/skeleton-{W}/{d}.json'))
    return {INV[j['label']]: np.array([j['x'] * W, j['y'] * W]) for j in sk['keypoints']}


def char_scale(char, spec):
    """Pixels per performer unit for this character, root and canvas: the median over the eight headings of the root
    skeleton's neck-to-pelvis length over the performer's (CMU 08_01 standing, projected the same way; a take by another
    performer names its own `scale_clip` and `scale_frame`, so a taller runner does not run further). One number per
    character, so a heading whose skeleton estimate came out short does not get a smaller or larger motion."""
    J, _, _ = load(spec.get('scale_clip', '08_01')); P = pts3d(J, spec.get('scale_frame', 0)); up = np.array([0, 0, 1.0])
    L = float(np.linalg.norm(P['NECK'] - P['M']) * math.cos(math.radians(PITCH)))
    out = []
    for d in DIRS:
        S = skeleton(char, spec, d); out.append(float(np.linalg.norm(S['NECK'] - (S['RH'] + S['LH']) / 2)) / L)
    return float(np.median(out))


def frame_list(spec):
    out = []
    for f in spec['frames']:
        out.append((f['f'], f.get('amp', 1.0)) if isinstance(f, dict) else (f, 1.0))
    return out


def take_delta(clip, ref, f, travel):
    """A pose frame's joint offsets from its take's own reference frame, in that performer's facing space: a frame may
    borrow a beat from a second take (Bo's drive is 143_23's jab after 135_04's stomp), measured against that take's own
    guard, so the beats join on the same stance."""
    J, _, _ = load(clip); up = np.array([0, 0, 1.0])
    P0 = pts3d(J, ref); lat = P0['LH'] - P0['RH']; lat[2] = 0; fwd = np.cross(unit(lat), up)
    Rm = np.array([unit(np.cross(fwd, up)) * -1, -fwd, up]); o_ref = P0['M'].copy(); o_ref[2] = 0.0
    P = pts3d(J, f); o = o_ref + (1.0 - travel) * (P['M'] - o_ref); o[2] = 0.0
    return {k: Rm @ (P[k] - o) - Rm @ (P0[k] - o_ref) for k in P}


def build_delta(char, cand, spec, d):
    J, fps, n = load(spec['clip']); up = np.array([0, 0, 1.0]); proj = camera(d); info = {}
    if spec['kind'] == 'walk':
        start, period, fwd, info = gait_cycle(J, spec['clip'], spec.get('cycle'))
        fs = [(start + period * i / spec['frames'], 1.0) for i in range(spec['frames'])]
        ref_f = fs[0][0]
    else:
        fs = frame_list(spec); ref_f = spec['ref']
        P0 = pts3d(J, ref_f); lat = P0['LH'] - P0['RH']; lat[2] = 0; fwd = np.cross(unit(lat), up)
    lat = unit(np.cross(fwd, up)) * -1
    Rm = np.array([lat, -fwd, up])
    o_ref = pts3d(J, ref_f)['M'].copy(); o_ref[2] = 0.0

    travel = spec.get('travel', 1.0)   # a pose keeps this share of the performer's horizontal pelvis travel (1: all of it)

    def frame(f):
        P = pts3d(J, f)
        if spec['kind'] == 'walk': o = P['M'].copy()
        else: o = o_ref + (1.0 - travel) * (P['M'] - o_ref)
        o[2] = 0.0
        return {k: Rm @ (v - o) for k, v in P.items()}

    Xs = [frame(f if not (isinstance(r, dict) and 'clip' in r) else ref_f) for (f, _), r in zip(fs, spec['frames'] if spec['kind'] != 'walk' else [None] * len(fs))]
    if spec['kind'] == 'walk':
        mz = np.mean([X['M'][2] for X in Xs]); bob = spec.get('bob', 1.0); track = spec.get('track', 1.0)
        for X in Xs:
            dz = (bob - 1.0) * (X['M'][2] - mz)
            for k in X: X[k] = X[k] + np.array([0, 0, dz])
            for k in LEGS: X[k][0] = X['M'][0] + track * (X[k][0] - X['M'][0])
        X0 = {k: np.mean([X[k] for X in Xs], axis=0) for k in Xs[0]}
        # The jog (ADR 0095): `stride` scales the knees' and ankles' fore-aft swing about the cycle mean, so a planted foot
        # sweeps back as far as the game carries the figure at a believable cadence; `arms` does the same for elbows and wrists.
        for keys, g in ((LEGS, spec.get('stride', 1.0)), (('REL', 'LEL', 'RW', 'LW'), spec.get('arms', 1.0))):
            for X in Xs:
                for k in keys: X[k][1] = X0[k][1] + g * (X[k][1] - X0[k][1])
    else:
        X0 = frame(ref_f)
    S = skeleton(char, spec, d)
    s = char_scale(char, spec)
    amp0 = spec.get('amp', 1.0)
    base = dict(S)
    if spec['kind'] == 'walk':
        # The root stands with one foot a little ahead, so its two ankles sit rows apart on screen; adding the gait to them
        # landed the two steps 4-5 px apart (#290's hitch). The walk's legs start from the root's leg midpoints instead, set
        # apart by the performer's own mean pose, so both contacts land alike and the drawn pose still leads frame 0.
        for a, b in (('LA', 'RA'), ('LK', 'RK')):
            mid = (S[a] + S[b]) / 2; mm = (X0[a] + X0[b]) / 2
            for k in (a, b): base[k] = mid + s * (proj(X0[k])[0] - proj(mm)[0])
    pxs, dps = [], []
    raw = spec['frames'] if spec['kind'] != 'walk' else [None] * len(fs)
    for X, (_, famp), fr in zip(Xs, fs, raw):
        P = {}; Dp = {}
        other = take_delta(fr['clip'], fr['ref'], fr['f'], fr.get('travel', travel)) if isinstance(fr, dict) and 'clip' in fr else None
        for k in NAMES:
            if k in HEAD: continue
            a = amp0 * famp
            Y = X0[k] + a * (other[k] if other else (X[k] - X0[k]))
            P[k] = base[k] + s * (proj(Y)[0] - proj(X0[k])[0]); Dp[k] = proj(Y)[1]
        for k in HEAD:
            P[k] = P['NECK'] + (S[k] - S['NECK']); Dp[k] = proj(X0[k])[1]
        pxs.append(P); dps.append(Dp)
    if spec['kind'] == 'walk':
        info['contact_rows'] = contact_rows(Xs, pxs)
    dfirst = {k: proj(X0[k])[1] for k in NAMES}
    return S, dfirst, pxs, dps, s, [round(f, 2) for f, _ in fs], info


def contact_rows(Xs, pxs):
    """Screen row of each foot at its own contact (the cel where that ankle is lowest in the performer's space)."""
    out = {}
    for k in ('LA', 'RA'):
        i = int(np.argmin([X[k][2] - 0.001 * X[k][1] for X in Xs]))
        out[k] = {'cel': i, 'row': round(float(pxs[i][k][1]), 2)}
    return out


# ---- knockout: the thug's ko.py bone-rotation retarget, on the curated stance root ----
TREE = [('M', 'RH'), ('M', 'LH'), ('RH', 'RK'), ('RK', 'RA'), ('LH', 'LK'), ('LK', 'LA'), ('M', 'NECK'),
        ('NECK', 'RS'), ('NECK', 'LS'), ('RS', 'REL'), ('REL', 'RW'), ('LS', 'LEL'), ('LEL', 'LW')]
ABS_BONES = {('M', 'NECK'), ('RH', 'RK'), ('RK', 'RA'), ('LH', 'LK'), ('LK', 'LA')}
BODY = ['M', 'RH', 'LH', 'RK', 'LK', 'RA', 'LA', 'NECK', 'RS', 'LS', 'REL', 'LEL', 'RW', 'LW']
HEAD3 = {'NOSE': (0, -7, 9), 'RE': (-3, -6, 12), 'LE': (3, -6, 12), 'REAR': (-7, 0, 10), 'LEAR': (7, 0, 10)}


def rot_between(a, b, amp=1.0):
    a, b = unit(a), unit(b); c = float(np.clip(a @ b, -1, 1)); ax = np.cross(a, b); sn = np.linalg.norm(ax)
    if sn < 1e-8: return np.eye(3)
    ax = ax / sn; th = math.atan2(sn, c) * amp
    K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K


def build_ko(char, cand, spec, d):
    n_ = len(spec['frames']); turns = spec.get('turn', {}).get(d, [0] * n_); absw = spec.get('absw', [0] * n_)
    J, fps, nf = load(spec['clip']); ref = spec['ref']
    lat = J['lhip'][ref] - J['rhip'][ref]; lat[2] = 0; lat = unit(lat); up = np.array([0, 0, 1.0]); fwd = np.cross(lat, up)
    Rm = np.array([lat, -fwd, up]); o = (J['lhip'][ref] + J['rhip'][ref]) / 2
    yaw = math.radians(YAW[d]); th = math.radians(PITCH); c, sn = math.cos(yaw), math.sin(yaw)
    proj = camera(d)
    S = skeleton(char, spec, d); Sm = (S['RH'] + S['LH']) / 2
    S['M'] = Sm
    Q0 = {'M': np.zeros(3)}
    cc = c if abs(c) > 0.2 else math.copysign(0.2, c if c else 1.0)
    for k in BODY[1:]:
        r = S[k] - Sm; X = r[0] / cc; Z = (-r[1] - sn * X * math.sin(th)) / math.cos(th); Q0[k] = np.array([X, 0.0, Z])

    def mframe(f, turn=0.0):
        P = pts3d(J, f); M = {k: Rm @ (P[k] - o) for k in BODY[1:]}; M['M'] = Rm @ (P['M'] - o); M['HEADTOP'] = Rm @ (P['HEADTOP'] - o)
        if turn:
            R = rotz(turn); piv = M['M'].copy(); M = {k: piv + R @ (v - piv) for k, v in M.items()}
        return M

    M0 = mframe(ref)
    k = char_scale(char, spec) / math.cos(math.radians(PITCH))   # character space is unprojected
    g_moc = min(J['lank'][ref][2], J['rank'][ref][2]); g_ch = min(Q0['RA'][2], Q0['LA'][2])
    hs = float(np.linalg.norm(S['NOSE'] - S['NECK'])) / max(float(np.linalg.norm(proj(np.array(HEAD3['NOSE'], float))[0])), 1e-6)
    H3 = {h: np.array(v, float) * hs for h, v in HEAD3.items()}
    rs = spec.get('root_travel', 1.0); amp = spec.get('amp', 1.0)
    pxs, dps = [], []
    for i, (fr, _) in enumerate(frame_list(spec)):
        M = mframe(fr, turns[i]); w = absw[i]
        Q = {'M': Q0['M'] + amp * k * (M['M'] - M0['M']) * np.array([rs, rs, 1.0])}
        for a, b in TREE:
            v = rot_between(M0[b] - M0[a], M[b] - M[a], amp) @ (Q0[b] - Q0[a])
            if w > 0 and (a, b) in ABS_BONES:
                L = float(np.linalg.norm(v)); v = rot_between(v, M[b] - M[a], w) @ v; v = unit(v) * L
            Q[b] = Q[a] + v
        Rh = rot_between(Q0['NECK'] - Q0['M'], Q['NECK'] - Q['M']) if w > 0 else rot_between(M0['HEADTOP'] - M0['NECK'], M['HEADTOP'] - M['NECK'], amp)
        mlow = max(0.0, min(M[q][2] for q in BODY if q != 'M') + o[2] - g_moc) * k * amp
        clow = min(Q[q][2] for q in BODY if q != 'M') - g_ch
        for q in Q: Q[q] = Q[q] + np.array([0, 0, mlow - clow])
        P = {q: S[q] + (proj(Q[q])[0] - proj(Q0[q])[0]) for q in BODY if q != 'M'}; Dp = {q: proj(Q[q])[1] for q in BODY if q != 'M'}
        for h in HEAD:
            P[h] = P['NECK'] + (S[h] - S['NECK']) + (proj(Rh @ H3[h])[0] - proj(H3[h])[0]); Dp[h] = proj(Q['NECK'] + Rh @ H3[h])[1]
        pxs.append(P); dps.append(Dp)
    dfirst = {q: proj(Q0[q])[1] for q in BODY if q != 'M'}
    dfirst.update({h: proj(Q0['NECK'] + H3[h])[1] for h in HEAD})
    return S, dfirst, pxs, dps, k, [f for f, _ in frame_list(spec)], {}


def kp(d, P, Dp, W):
    order = sorted(NAMES, key=lambda k: -Dp[k]); face = ['NOSE', 'RE', 'LE']
    seq = list(order) if d.startswith('north') else [q for q in order if q not in face] + ['LE', 'RE', 'NOSE']
    z = {k: i + 1 for i, k in enumerate(seq)}
    return [{'label': NAMES[k], 'x': round(float(P[k][0]) / W, 4), 'y': round(float(P[k][1]) / W, 4), 'z_index': z[k]} for k in NAMES]


def build(char, cand, d):
    spec = SPECS[char][cand] if cand in SPECS.get(char, {}) else SPECS['_shared'][cand]
    W = spec['canvas']
    S, dfirst, pxs, dps, s, fsrc, info = (build_ko if spec['kind'] == 'ko' else build_delta)(char, cand, spec, d)
    first = {k: S[k].copy() for k in NAMES}
    allp = np.array([v for P in pxs for v in P.values()])
    ok = bool(allp[:, 0].min() >= 0.02 * W and allp[:, 0].max() <= 0.98 * W and allp[:, 1].min() >= 0.02 * W and allp[:, 1].max() <= 0.98 * W)
    rec = dict(char=char, cand=cand, dir=d, clip=spec['clip'], kind=spec['kind'], canvas=W, root=spec['root'], src_frames=fsrc,
               action=spec['action'], attribution=spec['attribution'], scale=s, fits=ok, bounds=[allp.min(0).tolist(), allp.max(0).tolist()],
               info=info, first_frame_keypoints=kp(d, first, dfirst, W), frames=[kp(d, P, D, W) for P, D in zip(pxs, dps)],
               px=[{k: [float(v[0]), float(v[1])] for k, v in P.items()} for P in pxs])
    out = ROOT / f'design/{char}'; (out / 'prev').mkdir(parents=True, exist_ok=True)
    json.dump(rec, open(out / f'{cand}-{d}.json', 'w'))
    preview(char, spec, d, cand, [first] + pxs, out / f'prev/{cand}-{d}.png')
    print(char, cand, d, 'fits', ok, 'scale', round(s, 3), 'bounds', np.round(allp.min(0)), np.round(allp.max(0)), info.get('contact_rows', ''))
    return rec


BON = [('NECK', 'RS'), ('NECK', 'LS'), ('RS', 'REL'), ('REL', 'RW'), ('LS', 'LEL'), ('LEL', 'LW'), ('NECK', 'RH'), ('NECK', 'LH'), ('RH', 'LH'),
       ('RH', 'RK'), ('RK', 'RA'), ('LH', 'LK'), ('LK', 'LA'), ('NECK', 'NOSE')]


def padded(char, spec, d):
    W = spec['canvas']; x, y = CANVAS[W]
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); im.alpha_composite(Image.open(ROOT / f'roots/{char}/{spec["root"]}/{d}.png').convert('RGBA'), (x, y))
    return im


def preview(char, spec, d, cand, frames, path):
    W = spec['canvas']; SC = 4; src = padded(char, spec, d); cells = []
    for i, P in enumerate(frames):
        bg = Image.new('RGBA', (W, W), (60, 60, 70, 255)); bg.alpha_composite(src); bg = Image.blend(bg, Image.new('RGBA', (W, W), (60, 60, 70, 255)), 0.7)
        im = bg.resize((W * SC, W * SC), Image.NEAREST); dr = ImageDraw.Draw(im)
        for a_, b_ in BON:
            dr.line([tuple(P[a_] * SC), tuple(P[b_] * SC)], fill=(255, 80, 80) if (a_[0] == 'R' or b_[0] == 'R') else (80, 200, 255), width=2)
        dr.text((4, 4), f'{cand} {d} {i - 1 if i else "root"}', fill=(255, 255, 255)); cells.append(im)
    sh = Image.new('RGBA', (W * SC * len(cells), W * SC), (30, 30, 30, 255))
    for i, c in enumerate(cells): sh.paste(c, (i * W * SC, 0))
    sh.convert('RGB').save(path)


if __name__ == '__main__':
    char, cand = sys.argv[1:3]
    for d in (sys.argv[3:] or DIRS): build(char, cand, d)
