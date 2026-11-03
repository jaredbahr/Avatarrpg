"""ko.py CAND DIR [DIR..] : knockout skeleton design for the thug (the party's design_hk Retarget, on the thug's own stance).
The thug's 2D stance skeleton (src_joints.json) is lifted into the facing's character space (frontal plane, joint depth 0),
then every bone is rotated by the rotation that takes the CMU performer's bone from its reference direction to its direction
at the sampled frame (lengths kept), torso and legs blended toward the performer's ABSOLUTE direction by `absw` so a lying body
lies flat, with a per-frame heading `turn` about the vertical through the pelvis and a root-travel scale. Same camera as the walk
(design.py). Head points ride the (blended) torso. Frame 0 = the stance skeleton exactly. No pose is hand authored."""
import sys, math
import numpy as np
sys.dont_write_bytecode = True
args = sys.argv[1:]; sys.argv = sys.argv[:1]
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
import design as G
from design import unit, rotz, YAW, PITCH, NAMES, SRCJ, CLIPS, load, pts3d, finish

TREE = [('M', 'RH'), ('M', 'LH'), ('RH', 'RK'), ('RK', 'RA'), ('LH', 'LK'), ('LK', 'LA'), ('M', 'NECK'),
        ('NECK', 'RS'), ('NECK', 'LS'), ('RS', 'REL'), ('REL', 'RW'), ('LS', 'LEL'), ('LEL', 'LW')]
ABS_BONES = {('M', 'NECK'), ('RH', 'RK'), ('RK', 'RA'), ('LH', 'LK'), ('LK', 'LA')}
BODY = ['M', 'RH', 'LH', 'RK', 'LK', 'RA', 'LA', 'NECK', 'RS', 'LS', 'REL', 'LEL', 'RW', 'LW']
HEAD = ['NOSE', 'RE', 'LE', 'REAR', 'LEAR']
HEAD3 = {'NOSE': (0, -7, 9), 'RE': (-3, -6, 12), 'LE': (3, -6, 12), 'REAR': (-7, 0, 10), 'LEAR': (7, 0, 10)}


def rot_between(a, b, amp=1.0):
    a, b = unit(a), unit(b); c = float(np.clip(a @ b, -1, 1)); ax = np.cross(a, b); sn = np.linalg.norm(ax)
    if sn < 1e-8: return np.eye(3)
    ax = ax / sn; th = math.atan2(sn, c) * amp
    K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K


def build(cand, d):
    spec = CLIPS[cand]
    if d in spec.get('root_travel_dirs', {}): spec = dict(spec, root_travel=spec['root_travel_dirs'][d])
    if d in spec.get('turn_per_frame_dirs', {}): spec = dict(spec, turn_per_frame=spec['turn_per_frame_dirs'][d])
    n = len(spec['frames']); turns = spec.get('turn_per_frame', [0] * n); absw = spec.get('absw', [0] * n)
    J, fps, nf = load(spec['clip']); ref = spec['ref']
    lat = J['lhip'][ref] - J['rhip'][ref]; lat[2] = 0; lat = unit(lat); up = np.array([0, 0, 1.0]); fwd = np.cross(lat, up)
    Rm = np.array([lat, -fwd, up]); o = (J['lhip'][ref] + J['rhip'][ref]) / 2
    yaw = math.radians(YAW[d]); th = math.radians(PITCH); c, sn = math.cos(yaw), math.sin(yaw); Rz = rotz(YAW[d])

    def proj(p):
        q = Rz @ p
        return np.array([q[0], -(q[1] * math.sin(th) + q[2] * math.cos(th))]), q[1] * math.cos(th) - q[2] * math.sin(th)

    S = {k: np.array(v, float) for k, v in SRCJ[d].items()}; Sm = (S['RH'] + S['LH']) / 2
    Q0 = {'M': np.zeros(3)}
    for k in BODY[1:]:
        r = S[k] - Sm; X = r[0] / c; Z = (-r[1] - sn * X * math.sin(th)) / math.cos(th); Q0[k] = np.array([X, 0.0, Z])

    def mframe(f, turn=0.0):
        P = pts3d(J, f); M = {k: Rm @ (P[k] - o) for k in BODY[1:]}; M['M'] = Rm @ (P['M'] - o); M['HEADTOP'] = Rm @ (J['head'][f] - o)
        if turn:
            R = rotz(turn); piv = M['M'].copy(); M = {k: piv + R @ (v - piv) for k, v in M.items()}
        return M

    M0 = mframe(ref)
    k = float(np.linalg.norm(Q0['NECK'] - Q0['M'])) / float(np.linalg.norm(M0['NECK'] - M0['M']))
    g_moc = min(J['lank'][ref][2], J['rank'][ref][2]); g_ch = min(Q0['RA'][2], Q0['LA'][2])
    hs = float(np.linalg.norm(S['NOSE'] - S['NECK'])) / max(float(np.linalg.norm(proj(np.array(HEAD3['NOSE'], float))[0])), 1e-6)
    H3 = {h: np.array(v, float) * hs for h, v in HEAD3.items()}
    rs = spec.get('root_travel', 1.0); amp = spec.get('amp', 1.0)
    pxs, dps, logs = [], [], []
    for i, fr in enumerate(spec['frames']):
        if fr == 'stance':
            pxs.append({q: S[q].copy() for q in NAMES}); dp = {q: proj(Q0[q])[1] for q in BODY if q != 'M'}
            dp.update({h: proj(Q0['NECK'] + H3[h])[1] for h in HEAD}); dps.append(dp); continue
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
        u = Q['NECK'] - Q['M']; logs.append((i, round(math.degrees(math.atan2(math.hypot(u[0], u[1]), u[2])), 1)))
    allp = np.array([v for P in pxs for v in P.values()])
    print(cand, d, 'tilt', logs, 'bounds', np.round(allp.min(0)), np.round(allp.max(0)))
    finish(cand, d, spec, pxs, dps, k)


if __name__ == '__main__':
    for dd in args[1:]: build(args[0], dd)
