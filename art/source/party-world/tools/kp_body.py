"""Kaya polish: body-part geometry shared by the texture transfer (kp_texture.py) and the boil measure (kp_boil.py).

A skeleton (18 labelled joints, x/y in px) splits the figure into ten parts: head, torso, and each upper arm, forearm,
thigh and shin. Every opaque pixel belongs to the part whose bone is nearest (the torso is the quad of shoulders and hips,
the head the segment from the neck to the face's centre); where two parts are within 1.5 px of each other the one drawn
nearer the viewer (z rank) wins. Each part carries a similarity transform from one skeleton to another (its bone's two
ends), so a pixel of one drawing can be looked up in another."""
import numpy as np

PARTS = {
    'head': ('NECK', 'HEAD'), 'torso': ('NECK', 'MIDHIP'),
    'l_upper': ('LEFT SHOULDER', 'LEFT ELBOW'), 'l_fore': ('LEFT ELBOW', 'LEFT ARM'),
    'r_upper': ('RIGHT SHOULDER', 'RIGHT ELBOW'), 'r_fore': ('RIGHT ELBOW', 'RIGHT ARM'),
    'l_thigh': ('LEFT HIP', 'LEFT KNEE'), 'l_shin': ('LEFT KNEE', 'LEFT LEG'),
    'r_thigh': ('RIGHT HIP', 'RIGHT KNEE'), 'r_shin': ('RIGHT KNEE', 'RIGHT LEG'),
}
NAMES = list(PARTS)
LIMBS = [n for n in NAMES if n not in ('head', 'torso')]
FACE = ['NOSE', 'LEFT EYE', 'RIGHT EYE', 'LEFT EAR', 'RIGHT EAR']


def joints(kps, W):
    """[{label, x, y, z_index}] in 0-1 fractions of a W canvas -> {label: (x, y)} px and {label: z}, with HEAD and MIDHIP."""
    P = {k['label']: np.array([k['x'] * W, k['y'] * W]) for k in kps}
    Z = {k['label']: k['z_index'] for k in kps}
    P['HEAD'] = np.mean([P[l] for l in FACE], 0); Z['HEAD'] = np.mean([Z[l] for l in FACE])
    P['MIDHIP'] = (P['LEFT HIP'] + P['RIGHT HIP']) / 2; Z['MIDHIP'] = (Z['LEFT HIP'] + Z['RIGHT HIP']) / 2
    return P, Z


def _seg_dist(px, a, b):
    ab = b - a; t = np.clip(((px - a) @ ab) / max(ab @ ab, 1e-6), 0, 1)
    return np.linalg.norm(px - (a + t[:, None] * ab), axis=1)


def _in_quad(px, q):
    s = []
    for i in range(4):
        a, b = q[i], q[(i + 1) % 4]; s.append((b[0] - a[0]) * (px[:, 1] - a[1]) - (b[1] - a[1]) * (px[:, 0] - a[0]))
    s = np.stack(s, 1); return np.all(s >= 0, 1) | np.all(s <= 0, 1)


def labels(alpha, P, Z):
    """Part index per opaque pixel (-1 elsewhere)."""
    ys, xs = np.nonzero(alpha); px = np.stack([xs + 0.5, ys + 0.5], 1).astype(float)
    D = np.stack([_seg_dist(px, P[a], P[b]) for a, b in PARTS.values()], 1)
    quad = np.array([P['LEFT SHOULDER'], P['RIGHT SHOULDER'], P['RIGHT HIP'], P['LEFT HIP']])
    D[_in_quad(px, quad), NAMES.index('torso')] = 0
    D[:, NAMES.index('head')] -= 2.5   # the head is wider than its bone
    z = np.array([(Z[a] + Z[b]) / 2 for a, b in PARTS.values()])
    near = D <= D.min(1, keepdims=True) + 1.5
    pick = np.where(near, z[None, :], -np.inf).argmax(1)
    out = np.full(alpha.shape, -1, int); out[ys, xs] = pick
    return out


def similarity(a0, b0, a1, b1):
    """2x3 map taking segment (a0, b0) onto (a1, b1): rotation, uniform scale, translation. Returns (M, scale)."""
    v0, v1 = b0 - a0, b1 - a1; n0, n1 = np.linalg.norm(v0), np.linalg.norm(v1)
    if n0 < 1e-3 or n1 < 1e-3:
        return np.array([[1, 0, a1[0] - a0[0]], [0, 1, a1[1] - a0[1]]], float), 1.0
    s = n1 / n0; ang = np.arctan2(v1[1], v1[0]) - np.arctan2(v0[1], v0[0])
    c, si = s * np.cos(ang), s * np.sin(ang); R = np.array([[c, -si], [si, c]])
    t = a1 - R @ a0
    return np.hstack([R, t[:, None]]), s
