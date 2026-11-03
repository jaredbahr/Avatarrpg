"""Step 5: the designed walk. No mocap: six key poses a loop, set by hand in the body's own frame and projected onto the
board's 2:1 ground for each diagonal heading, as deltas on the root's estimated skeleton.

Per foot, over the six cels (contact R, down R, passing R, contact L, down L, passing L), its position along the walk,
in units of the step S, is +1/2, +1/6, -1/6, -1/2 (the stance foot moves back exactly S/3 a cel, so a pace of S/3 a cel holds
it still), then it swings: -1/4 lifted, +1/8 lifted and passing, back to +1/2. Pelvis: contact -1.2%, down -2.5%, passing 0
of the body height (a 2 px bob). Arms swing against the legs. Knees by two-bone IK with the root's own thigh and shin.

Projection: one body height H is the root's drawn height in screen px; a ground unit along a grid axis is H / 1.095 px
(2:1 dimetric, 30 degree camera), along the heading's screen diagonal.

usage: python3 -I tools/design.py [STEP]   (STEP in body heights, default 0.45) -> design/<char>-<dir>.json + design/prev/"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent.parent
CHARS = ['kaya', 'sura', 'bo', 'gao']; DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
W = 128
FWD = {'south-east': (1, 0), 'south-west': (0, 1), 'north-east': (0, -1), 'north-west': (-1, 0)}   # grid axis (gx, gy)
GROUND_PER_H = 1 / 1.095
STEP = float(sys.argv[1]) if len(sys.argv) > 1 else 0.45
# each foot over the six cels: position along the walk (in steps), ankle height (in H)
FOOT = [(+0.5, 0.01), (+1 / 6, 0.0), (-1 / 6, 0.0), (-0.5, 0.015), (-0.25, 0.05), (+0.125, 0.05)]
PELVIS = [-0.012, -0.025, 0.0, -0.012, -0.025, 0.0]
ARM = [-1.0, -0.6, 0.0, 1.0, 0.6, 0.0]          # right arm forward fraction (against the right leg)
ARM_AMP = 0.075                                  # wrist reach forward/back at contact, in H


def screen(gx, gy, z, H):
    """ground (gx, gy) in H units along the grid axes and height z in H -> screen px delta."""
    g = H * GROUND_PER_H
    return np.array([(gx - gy) * g * 0.894, (gx + gy) * g * 0.447 - z * H])


def ik(hip, ank, L1, L2, fwd):
    """hip, ank: (s, z) in the walk's sagittal plane; knee bends forward (+s)."""
    d = ank - hip; D = min(np.hypot(*d), L1 + L2 - 1e-6)
    a = math.acos(max(-1, min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))))
    base = math.atan2(d[1], d[0])
    cands = [base + a, base - a]
    ks = [hip + L1 * np.array([math.cos(t), math.sin(t)]) for t in cands]
    return max(ks, key=lambda k: k[0])   # forward knee


def design(char, d):
    sk = json.load(open(HERE / f'roots/{char}/skeleton/{d}.json'))
    P = {k['label']: np.array([k['x'] * W, k['y'] * W]) for k in sk['keypoints']}
    Z = {k['label']: k['z_index'] for k in sk['keypoints']}
    Z = {k: i + 1 for i, k in enumerate(sorted(Z, key=lambda k: Z[k]))}   # integer ranks, nearest highest
    P0 = {k: v.copy() for k, v in P.items()}   # what the root image shows: the first frame's keypoints
    a = np.asarray(Image.open(HERE / f'roots/{char}/{d}.png'))[..., 3]; ys = np.nonzero(a)[0]; H = float(ys.max() - ys.min() + 1)
    fx, fy = FWD[d]
    # Stand both feet on one ground line: the root has one foot set back, which would plant the two steps rows apart
    # (a limp). Base ankles = their midpoint +- half a hip width along the heading's right, knees moved with them.
    mid = (P['LEFT LEG'] + P['RIGHT LEG']) / 2; rx, ry = -fy, fx; half = 0.045
    for side, sg in (('RIGHT', 1), ('LEFT', -1)):
        new = mid + screen(sg * half * rx, sg * half * ry, 0, H)
        P[f'{side} KNEE'] = P[f'{side} KNEE'] + (new - P[f'{side} LEG']) / 2; P[f'{side} LEG'] = new
    hipz = (H - (P['LEFT HIP'][1] + P['RIGHT HIP'][1]) / 2 + ys.min()) / H   # hip height over the sole, in H (approx)
    sole = ys.max()
    thigh = {s: np.linalg.norm(P[f'{s} KNEE'] - P[f'{s} HIP']) / H for s in ('LEFT', 'RIGHT')}
    shin = {s: np.linalg.norm(P[f'{s} LEG'] - P[f'{s} KNEE']) / H for s in ('LEFT', 'RIGHT')}
    frames = []
    for i in range(6):
        Q = {k: v.copy() for k, v in P.items()}
        pel = PELVIS[i]
        for side, ph in (('RIGHT', i), ('LEFT', (i + 3) % 6)):
            s, az = FOOT[ph]; s *= STEP
            L1, L2 = thigh[side] * 1.04, shin[side] * 1.04       # the drawn root stands slightly bent
            hip = np.array([0.0, hipz + pel]); ank = np.array([s, az + 0.04])
            knee = ik(hip, ank, L1, L2, 1)
            # deltas from standing (hip over ankle, straight-ish leg)
            hip0 = np.array([0.0, hipz]); ank0 = np.array([0.0, 0.04]); knee0 = ik(hip0, ank0, L1, L2, 1)
            for lab, q, q0 in ((f'{side} HIP', hip, hip0), (f'{side} KNEE', knee, knee0), (f'{side} LEG', ank, ank0)):
                ds, dz = q - q0
                Q[lab] = P[lab] + screen(ds * fx, ds * fy, dz, H)
        for lab in ['NOSE', 'LEFT EYE', 'RIGHT EYE', 'LEFT EAR', 'RIGHT EAR', 'NECK', 'LEFT SHOULDER', 'RIGHT SHOULDER',
                    'LEFT ELBOW', 'RIGHT ELBOW', 'LEFT ARM', 'RIGHT ARM']:
            Q[lab] = P[lab] + screen(0, 0, pel, H)
        for side, sgn in (('RIGHT', 1), ('LEFT', -1)):
            r = ARM[i] * sgn * ARM_AMP
            Q[f'{side} ARM'] = Q[f'{side} ARM'] + screen(r * fx, r * fy, abs(r) * 0.25, H)
            Q[f'{side} ELBOW'] = Q[f'{side} ELBOW'] + screen(0.45 * r * fx, 0.45 * r * fy, abs(r) * 0.08, H)
        frames.append(Q)
    kp = lambda Q: [{'label': k, 'x': round(float(Q[k][0]) / W, 4), 'y': round(float(Q[k][1]) / W, 4), 'z_index': Z[k]} for k in P]
    allp = np.array([v for Q in frames for v in Q.values()])
    rec = dict(char=char, dir=d, canvas=W, step=STEP, height=H, action='walk',
               attribution='designed six-pose walk (contact, down, passing) in the body frame, projected to the 2:1 board',
               first_frame_keypoints=kp(P0), frames=[kp(Q) for Q in frames],
               ankles=[{s: [round(float(v), 2) for v in Q[f'{s} LEG']] for s in ('LEFT', 'RIGHT')} for Q in frames],
               bounds=[allp.min(0).round(1).tolist(), allp.max(0).round(1).tolist()])
    (HERE / 'design/prev').mkdir(parents=True, exist_ok=True)
    json.dump(rec, open(HERE / f'design/{char}-{d}.json', 'w'), indent=1)
    BON = [('NECK', 'RIGHT SHOULDER'), ('NECK', 'LEFT SHOULDER'), ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'),
           ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'), ('NECK', 'RIGHT HIP'), ('NECK', 'LEFT HIP'), ('RIGHT HIP', 'LEFT HIP'),
           ('RIGHT HIP', 'RIGHT KNEE'), ('RIGHT KNEE', 'RIGHT LEG'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG'), ('NECK', 'NOSE')]
    root = Image.open(HERE / f'roots/{char}/{d}.png'); cells = []
    for Q in [P] + frames:
        bg = Image.new('RGBA', (W, W), (60, 60, 70, 255)); bg.alpha_composite(root)
        bg = Image.blend(bg, Image.new('RGBA', (W, W), (60, 60, 70, 255)), 0.6).resize((W * 3, W * 3), Image.NEAREST); dr = ImageDraw.Draw(bg)
        for a_, b_ in BON:
            dr.line([tuple(Q[a_] * 3), tuple(Q[b_] * 3)], fill=(255, 80, 80) if 'RIGHT' in a_ + b_ else (80, 200, 255), width=2)
        cells.append(bg)
    sh = Image.new('RGBA', (W * 3 * len(cells), W * 3)); [sh.paste(c, (i * W * 3, 0)) for i, c in enumerate(cells)]
    sh.save(HERE / f'design/prev/{char}-{d}.png')
    return rec


if __name__ == '__main__':
    for c in CHARS:
        for d in DIRS:
            r = design(c, d); print(c, d, 'H', r['height'], 'bounds', r['bounds'])
