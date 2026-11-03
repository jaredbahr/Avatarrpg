"""Bruiser action design: CMU mocap projected onto the thug's own approved rotation skeleton (delta retarget).
usage: design.py CAND DIR [DIR..]   CAND in clips.json. Writes kp/<cand>-<dir>.json and prev/<cand>-<dir>.png
P_f[j] = SRC[j] + s*(proj(X_f[j]) - proj(X_ref[j])); frame 'stance' = SRC exactly. Same camera as the walk (yaw per
facing, pitch 35). No pose is hand authored."""
import sys, json, math
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
sys.dont_write_bytecode = True
sys.path.insert(0, r'D:/AvatarRPG-tools/bend-style-source/work')
import mocap
T = Path(r'D:/AvatarRPG-tools/models-p1-bandits/bruiser'); HERE = Path(__file__).parent
W = r'D:/AvatarRPG-tools/models-p0p1/work/mocap-lic/'; W2 = r'D:/AvatarRPG-tools/models-p0p1/work/mocap/'
SRCM = {'13_17': ('cmu', W + '13.asf', W + '13_17.amc'), '14_01': ('cmu', W + '14.asf', W + '14_01.amc'), '15_13': ('cmu', W + '15.asf', W + '15_13.amc'),
        '79_73': ('cmu', W + '79.asf', W + '79_73.amc'), '76_03': ('cmu', W + '76.asf', W + '76_03.amc'), '77_09': ('cmu', W + '77.asf', W + '77_09.amc'),
        '90_18': ('cmu', W2 + '90.asf', W2 + '90_18.amc'), '77_18': ('cmu', W2 + '77.asf', W2 + '77_18.amc')}
CLIPS = json.load(open(HERE / 'clips.json'))
SRCJ = json.load(open(T / 'scripts/src_joints.json'))
NAMES = dict(NOSE='NOSE', RE='RIGHT EYE', LE='LEFT EYE', REAR='RIGHT EAR', LEAR='LEFT EAR', NECK='NECK', RS='RIGHT SHOULDER', LS='LEFT SHOULDER',
             REL='RIGHT ELBOW', LEL='LEFT ELBOW', RW='RIGHT ARM', LW='LEFT ARM', RH='RIGHT HIP', LH='LEFT HIP', RK='RIGHT KNEE', LK='LEFT KNEE',
             RA='RIGHT LEG', LA='LEFT LEG')
MJ = dict(RS='rsho', LS='lsho', REL='relb', LEL='lelb', RW='rhand', LW='lhand', RH='rhip', LH='lhip', RK='rknee', LK='lknee', RA='rank', LA='lank', NECK='neck')
PITCH = 35.0
HEAD = ['NOSE', 'RE', 'LE', 'REAR', 'LEAR']
_d = math.degrees(math.atan(math.sin(math.radians(PITCH)) / 0.5))
YAW = {'south': 0.0, 'north': 180.0, 'east': 90.0, 'west': -90.0, 'south-east': _d, 'south-west': -_d, 'north-east': 180.0 - _d, 'north-west': -(180.0 - _d)}
W_, H_ = 192, 192


def unit(v): return v / np.linalg.norm(v)


def rotz(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1.0]])


_cache = {}


def load(clip):
    if clip not in _cache: _cache[clip] = mocap.load(SRCM[clip])
    return _cache[clip]


def pts3d(J, f):
    P = {k: J[v][f].copy() for k, v in MJ.items()}
    h = J['head'][f]; nk = J['neck'][f]; up = unit(h - nk); L = float(np.linalg.norm(h - nk))
    lat = J['lsho'][f] - J['rsho'][f]; lat[2] = 0; lat = unit(lat); fw = np.cross(lat, np.array([0, 0, 1.0]))
    c = nk + up * L * 0.6
    P['NOSE'] = c + fw * L * 0.45
    P['RE'] = c + fw * L * 0.4 - lat * L * 0.15 + up * L * 0.1
    P['LE'] = c + fw * L * 0.4 + lat * L * 0.15 + up * L * 0.1
    P['REAR'] = c - lat * L * 0.4; P['LEAR'] = c + lat * L * 0.4
    P['M'] = (P['RH'] + P['LH']) / 2
    return P


def yaw_of(v): return math.degrees(math.atan2(v[1], v[0]))


def clamp_yaw(M, M0, yh, ys):
    d = yaw_of(M['LH'] - M['RH']) - yaw_of(M0['LH'] - M0['RH']); d = (d + 180) % 360 - 180
    if abs(d) > yh:
        Rz_ = rotz(-(d - math.copysign(yh, d))); piv = M['M'].copy(); M = {k: piv + Rz_ @ (v - piv) for k, v in M.items()}
    sh = yaw_of(M['LS'] - M['RS']) - yaw_of(M['LH'] - M['RH']); sh = (sh + 180) % 360 - 180
    sh0 = yaw_of(M0['LS'] - M0['RS']) - yaw_of(M0['LH'] - M0['RH']); ds = ((sh - sh0) + 180) % 360 - 180
    if abs(ds) > ys:
        ax = unit(M['NECK'] - M['M']); th_ = -math.radians(ds - math.copysign(ys, ds))
        K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]]); Rr = np.eye(3) + math.sin(th_) * K + (1 - math.cos(th_)) * K @ K
        piv = M['NECK']
        for k in ('RS', 'LS', 'REL', 'LEL', 'RW', 'LW', 'NOSE', 'RE', 'LE', 'REAR', 'LEAR'): M[k] = piv + Rr @ (M[k] - piv)
    return M


def build(cand, d):
    spec = CLIPS[cand]; J, fps, n = load(spec['clip']); ref = spec['ref']
    lat = J['lhip'][ref] - J['rhip'][ref]; lat[2] = 0; lat = unit(lat); up = np.array([0, 0, 1.0]); fwd = np.cross(lat, up)
    Rm = np.array([lat, -fwd, up])   # performer faces -Y
    if 'turn' in spec: Rm = rotz(spec['turn']) @ Rm
    Rz = rotz(YAW[d] + spec.get('yaw_add', 0)); th = math.radians(PITCH)

    def proj(p):
        q = Rz @ p
        return np.array([q[0], -(q[1] * math.sin(th) + q[2] * math.cos(th))]), q[1] * math.cos(th) - q[2] * math.sin(th)

    o = (J['lhip'][ref] + J['rhip'][ref]) / 2

    def frame(f):
        return {k: Rm @ (v - o) for k, v in pts3d(J, f).items()}

    X0 = frame(ref); S = {k: np.array(v, float) for k, v in SRCJ[d].items()}
    Sm = (S['RH'] + S['LH']) / 2
    s = float(np.linalg.norm(S['NECK'] - Sm)) / float(np.linalg.norm(proj(X0['NECK'])[0] - proj(X0['M'])[0]))
    amp = spec.get('amp', 1.0); trav = spec.get('travel', 1.0)
    pxs, dps = [], []
    for fr in spec['frames']:
        if fr == 'stance':
            pxs.append({k: S[k].copy() for k in NAMES}); dps.append({k: proj(X0[k])[1] for k in NAMES}); continue
        a = amp
        if isinstance(fr, dict): a, fr = amp * fr['amp'], fr['f']
        X = frame(fr)
        if spec.get('yaw_hip') is not None: X = clamp_yaw(X, X0, spec['yaw_hip'], spec['yaw_sh'])
        dm = X['M'] - X0['M']; Y = {}
        for k in X:
            Y[k] = X0[k] + a * (X[k] - X0[k]) - (1 - trav) * a * np.array([dm[0], dm[1], 0])
        P = {k: S[k] + s * (proj(Y[k])[0] - proj(X0[k])[0]) for k in NAMES}; Dp = {k: proj(Y[k])[1] for k in NAMES}
        for k in HEAD:   # party recipe: the head rides the neck, keeping the approved cel's own orientation (round 1 re-derived the face from the shoulders and the model turned it)
            P[k] = P['NECK'] + (S[k] - S['NECK']); Dp[k] = proj(X0[k])[1]
        pxs.append(P); dps.append(Dp)
    finish(cand, d, spec, pxs, dps, s)


def finish(cand, d, spec, pxs, dps, s):
    def kp(P, Dp):
        order = sorted(NAMES, key=lambda k: -Dp[k]); face = ['NOSE', 'RE', 'LE']
        seq = list(order) if d.startswith('north') else [q for q in order if q not in face] + ['LE', 'RE', 'NOSE']
        z = {k: i + 1 for i, k in enumerate(seq)}
        return [{'label': NAMES[k], 'x': round(float(P[k][0]) / W_, 4), 'y': round(float(P[k][1]) / H_, 4), 'z_index': z[k]} for k in NAMES]

    kps = [kp(P, D) for P, D in zip(pxs, dps)]
    allp = np.array([v for P in pxs for v in P.values()])
    ok = bool((allp[:, 0].min() >= 0.02 * W_) and (allp[:, 0].max() <= 0.98 * W_) and (allp[:, 1].min() >= 0.02 * H_) and (allp[:, 1].max() <= 0.98 * H_))
    rec = dict(cand=cand, dir=d, clip=spec['clip'], frames_src=spec['frames'], ms=spec['ms'], kind=spec['kind'], keys=spec['keys'], roles=spec['roles'],
               action=spec['action'], attribution=spec['attribution'], scale=s, fits=ok, bounds=[allp.min(0).tolist(), allp.max(0).tolist()],
               frames=kps, px=[{k: [float(v[0]), float(v[1])] for k, v in P.items()} for P in pxs])
    (HERE / 'kp').mkdir(exist_ok=True); json.dump(rec, open(HERE / f'kp/{cand}-{d}.json', 'w'))
    BON = [('NECK', 'RS'), ('NECK', 'LS'), ('RS', 'REL'), ('REL', 'RW'), ('LS', 'LEL'), ('LEL', 'LW'), ('NECK', 'RH'), ('NECK', 'LH'), ('RH', 'LH'),
           ('RH', 'RK'), ('RK', 'RA'), ('LH', 'LK'), ('LK', 'LA'), ('NECK', 'NOSE')]
    src = Image.open(T / f'base/a1/{d}.png').convert('RGBA'); SC = 2; cells = []
    for i, P in enumerate(pxs):
        bg = Image.new('RGBA', (W_, H_), (60, 60, 70, 255)); bg.alpha_composite(src); bg = Image.blend(bg, Image.new('RGBA', (W_, H_), (60, 60, 70, 255)), 0.7)
        im = bg.resize((W_ * SC, H_ * SC), Image.NEAREST); dr = ImageDraw.Draw(im)
        for a_, b_ in BON:
            dr.line([tuple(P[a_] * SC), tuple(P[b_] * SC)], fill=(255, 80, 80) if (a_[0] == 'R' or b_[0] == 'R') else (80, 200, 255), width=2)
        dr.text((4, 4), f'{cand} {d} f{i}', fill=(255, 255, 255)); cells.append(im)
    sh = Image.new('RGBA', (W_ * SC * len(cells), H_ * SC), (30, 30, 30, 255))
    for i, c in enumerate(cells): sh.paste(c, (i * W_ * SC, 0))
    (HERE / 'prev').mkdir(exist_ok=True); sh.convert('RGB').save(HERE / f'prev/{cand}-{d}.png')
    print(cand, d, 'fits', ok, 'bounds', np.round(allp.min(0)), np.round(allp.max(0)))


if __name__ == '__main__':
    for d in sys.argv[2:]: build(sys.argv[1], d)
