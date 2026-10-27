"""Minimal CMU ASF/AMC reader: forward kinematics to world joint positions, Z up (CMU is Y up).
load(asf, amc) -> (J, fps, n) where J[name] is an (n, 3) array for the joints the retarget uses:
neck, head, l/r sho, elb, hand, hip, knee, ank, plus root."""
import numpy as np, math

def _rot(axis, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    if axis == 'x': return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y': return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def _euler(vals, order):
    # ASF/AMC: R = Rz*Ry*Rx for order XYZ (applied x first)
    M = np.eye(3)
    for ax, v in zip(order, vals): M = _rot(ax, v) @ M
    return M

def parse_asf(path):
    bones = {}; hier = {}; lines = [l.strip() for l in open(path)]
    i = 0; sec = None; root_order = None; length_unit = 1.0
    while i < len(lines):
        l = lines[i]
        if l.startswith(':'):
            sec = l.split()[0]
            if sec == ':units': pass
        if sec == ':units' and l.startswith('length'): length_unit = float(l.split()[1])
        if sec == ':root' and l.startswith('order'): root_order = [t.lower() for t in l.split()[1:]]
        if sec == ':bonedata' and l == 'begin':
            b = {}; i += 1
            while lines[i] != 'end':
                t = lines[i].split()
                if t[0] == 'name': b['name'] = t[1]
                elif t[0] == 'direction': b['dir'] = np.array(list(map(float, t[1:4])))
                elif t[0] == 'length': b['len'] = float(t[1])
                elif t[0] == 'axis': b['axis'] = (list(map(float, t[1:4])), t[4].lower())
                elif t[0] == 'dof': b['dof'] = [x.lower() for x in t[1:]]
                i += 1
            b.setdefault('dof', []); bones[b['name']] = b
        if sec == ':hierarchy' and l not in ('begin', 'end', ':hierarchy'):
            t = l.split(); hier[t[0]] = t[1:]
        i += 1
    return bones, hier, root_order

def parse_amc(path):
    frames = []; cur = None
    for l in open(path):
        l = l.strip()
        if not l or l.startswith('#') or l.startswith(':'): continue
        if l.isdigit(): cur = {}; frames.append(cur); continue
        t = l.split(); cur[t[0]] = list(map(float, t[1:]))
    return frames

WANT = dict(lhip='lfemur', rhip='rfemur', lknee='ltibia', rknee='rtibia', lank='lfoot', rank='rfoot', lsho='lhumerus', rsho='rhumerus',
            lelb='lradius', relb='rradius', lhand='lhand', rhand='rhand', neck='upperneck', head='head')
# joint position = START of the named bone (end of its parent), except head = end of 'head'

def load(spec):
    _, asf, amc = spec
    bones, hier, rorder = parse_asf(asf); frames = parse_amc(amc)
    C = {}; Ci = {}
    for n, b in bones.items():
        ang, order = b['axis']; C[n] = _euler(ang, order); Ci[n] = C[n].T
    parent = {c: p for p, cs in hier.items() for c in cs}
    order_b = []
    def walk(n):
        for c in hier.get(n, []): order_b.append(c); walk(c)
    walk('root')
    Yup2Zup = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0.0]])
    out = {k: np.zeros((len(frames), 3)) for k in list(WANT) + ['root']}
    for fi, fr in enumerate(frames):
        r = fr['root']; pos = np.array(r[:3]); Rroot = _euler(r[3:6], ['x', 'y', 'z'])
        G = {'root': Rroot}; start = {}; end = {'root': pos}
        for n in order_b:
            b = bones[n]; vals = fr.get(n, [])
            M = np.eye(3)
            if vals:
                rx = dict(zip(b['dof'], vals)); M = _euler([rx.get('r' + a, 0) for a in 'xyz'], ['x', 'y', 'z'])
            p = parent[n]
            G[n] = G[p] @ C[n] @ M @ Ci[n]
            start[n] = end[p]; end[n] = start[n] + G[n] @ (b['dir'] * b['len'])
        for k, bn in WANT.items():
            v = end[bn] if k == 'head' else start[bn]
            out[k][fi] = Yup2Zup @ v
        out['root'][fi] = Yup2Zup @ pos
    return out, 120, len(frames)
