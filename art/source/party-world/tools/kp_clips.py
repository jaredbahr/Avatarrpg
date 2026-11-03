"""Kaya polish, step 7: the hits, knockouts and bends on the steeper body. #321's motions (design/kaya/<clip>-<dir>.json:
party-g1's CMU retargets mapped onto #321's roots) are carried onto the new stance root as per-joint offsets from their
first frame: scaled by the new body's height over the old, pressed 0.9 vertically for the steeper camera, and laid on the
new stance root's estimated skeleton (roots/kaya/stance/skeleton/<dir>.json), on the clip's canvas. The bends' striking
arm reaches a little further (REACH) so the jab reads at zoom 1. Then animate-with-skeleton-v3 from the new stance root,
seeded, as gen_clip.py.

usage (repo root): python3 -I art/source/party-world/tools/kp_clips.py SEED clip:dir [...]  -> polish/design/<clip>-<dir>.json,
raw/kp-<clip>-<dir>-s<SEED>/NN.png"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
from remap import CANVAS, FOOT, root_on
from kp_stance import DESC, kps, height
HERE = Path(__file__).resolve().parent.parent
PRESS = 0.9
# Seed 541 drew the hits at #321's amplitude and the bends at a 1.15 reach: the flinch barely read and the jab read only
# side-on. From seed 542 the hit's offsets are 1.7x and the bend's arms reach 1.35x.
AMP = {'hit': 1.7}
REACH = 1.35
OLD_HEIGHT = 75   # #321's Kaya stance roots stood 73-76 px
# #351: in the south, south-east and north views the jab travels toward or away from the camera and read as a small arm
# movement. There the two strikes (the left jab, design frames 0-2 around cel 2; the right cross, frames 3-6 around cel 6)
# are redrawn as a punch with a raised, flared elbow and a torso twist: the striking shoulder comes forward along the
# heading's screen direction and the other goes back, the elbow rises to shoulder height and flares out, and the fist
# lands in front of the chest (south, south-east) or past the shoulder up the screen (north). Each joint moves from the
# mocap's pose toward that target by the strike's extension (e), and the other arm comes up into a guard. Seed 641 on.
JAB = {'south': (0, 1), 'south-east': (0.894, 0.447), 'north': (0, -1)}
STRIKES = (('LEFT', {0: 0.35, 1: 1.0, 2: 0.45}), ('RIGHT', {3: 0.25, 4: 0.65, 5: 1.0, 6: 0.45}))
TWIST, ELBOW_OUT, ELBOW_UP, FIST = 0.05, 0.11, 0.04, 0.13   # in stance heights (seed 641)
# Seed 642 on (FULL): the arm extended, not tucked: a straight punch toward the camera shows as an arm foreshortened down
# the screen to about 0.22 heights from the shoulder (the 40 degree camera), the elbow halfway and lifted out; north, where
# the fist goes behind the head, punches forward and out (a hook past the shoulder). The twist is 0.07.
FULL = {'south': dict(fwd=0.22, out=-0.03), 'south-east': dict(fwd=0.24, out=-0.02), 'north': dict(fwd=0.10, out=0.12)}
# Seed 643 on, south only: 642 drew the foreshortened arm up by her head. The fist goes across the body instead (a
# cross past the centre line, low), so the forearm makes a diagonal over the chest that reads face-on.
CROSS = {'south': dict(fwd=0.20, out=-0.16)}


def front_jab(frames, d, H, W, full=False):
    F = np.array(JAB[d], float); tw = 0.07 if full else TWIST
    for side, ext in STRIKES:
        other = 'RIGHT' if side == 'LEFT' else 'LEFT'
        for i, e in ext.items():
            P = {j['label']: j for j in frames[i]}
            at = lambda l: np.array([P[l]['x'], P[l]['y']]) * W
            def put(l, v): P[l]['x'], P[l]['y'] = round(float(v[0]) / W, 4), round(float(v[1]) / W, 4)
            sh, osh, neck = at(f'{side} SHOULDER'), at(f'{other} SHOULDER'), at('NECK')
            O = sh - neck; O = O / max(np.linalg.norm(O), 1e-6)
            sh2 = sh + e * tw * H * F; put(f'{side} SHOULDER', sh2); put(f'{other} SHOULDER', osh - e * 0.8 * tw * H * F)
            if full:
                k = CROSS[d] if full == 'cross' and d in CROSS else FULL[d]
                fist = sh2 + k['fwd'] * H * F + k['out'] * H * O
                elbow = (sh2 + fist) / 2 + 0.07 * H * O + np.array([0, -0.03 * H])
            else:
                elbow = sh2 + ELBOW_OUT * H * O + np.array([0, -ELBOW_UP * H])
                fist = sh2 + FIST * H * F - 0.04 * H * O
            for l, t in ((f'{side} ELBOW', elbow), (f'{side} ARM', fist)): put(l, at(l) + e * (t - at(l)))
            # the other arm comes up into a guard by the chin (the mocap swings it wide, which reads as flailing face-on)
            og = osh - e * 0.8 * tw * H * F
            for l, t in ((f'{other} ELBOW', og - 0.05 * H * O + np.array([0, 0.07 * H])), (f'{other} ARM', og + 0.06 * H * F + 0.05 * H * O + np.array([0, -0.02 * H]))):
                put(l, at(l) + 0.8 * e * (t - at(l)))
            if e >= 0.6:   # the striking arm in front of the body toward the camera, behind it going away
                zs = [j['z_index'] for j in frames[i]]
                for l in (f'{side} ELBOW', f'{side} ARM'): P[l]['z_index'] = (max(zs) + 1) if F[1] > 0 else (min(zs) - 1)
    return frames


def design(clip, d, seed=0):
    old = json.load(open(HERE / f'design/kaya/{clip}-{d}.json'))
    W = CANVAS[clip]; dx, dy = (W - 128) // 2, FOOT[W] - 112
    new = kps(HERE / f'roots/kaya/stance/skeleton/{d}.json')
    k = height(HERE / f'roots/kaya/stance/{d}.png') / OLD_HEIGHT
    o0 = {j['label']: j for j in old['first_frame_keypoints']}
    first = [dict(label=l, x=round((j['x'] * 128 + dx) / W, 4), y=round((j['y'] * 128 + dy) / W, 4), z_index=j['z_index'])
             for l, j in new.items()]
    base = {j['label']: (j['x'] * W, j['y'] * W) for j in first}
    frames = []
    for f in old['frames']:
        F = {j['label']: j for j in f}; out = []
        for l in new:
            a = AMP.get(clip, 1)
            ox = (F[l]['x'] - o0[l]['x']) * W * k * a; oy = (F[l]['y'] - o0[l]['y']) * W * k * PRESS * a
            if clip == 'bend' and l in ('LEFT ARM', 'RIGHT ARM', 'LEFT ELBOW', 'RIGHT ELBOW'):
                ox *= REACH; oy *= REACH
            out.append(dict(label=l, x=round((base[l][0] + ox) / W, 4), y=round((base[l][1] + oy) / W, 4), z_index=F[l]['z_index']))
        frames.append(out)
    if clip == 'bend' and d in JAB: frames = front_jab(frames, d, height(HERE / f'roots/kaya/stance/{d}.png'), W, full='cross' if seed >= 643 else seed >= 642)
    rec = dict(old, canvas=W, first_frame_keypoints=first, frames=frames, foot_row=FOOT[W], polish=dict(scale=round(k, 3), press=PRESS,
               reach=REACH if clip == 'bend' else 1, front_jab=(('cross' if seed >= 643 else 'full' if seed >= 642 else 'tucked') if clip == 'bend' and d in JAB else None), amp=AMP.get(clip, 1), from_=f'design/kaya/{clip}-{d}.json onto roots/kaya/stance/{d}.png'))
    (HERE / 'polish/design').mkdir(parents=True, exist_ok=True)
    json.dump(rec, open(HERE / f'polish/design/{clip}-{d}.json', 'w'), indent=1)
    return rec


def one(spec, seed):
    clip, d = spec.split(':')
    rec = design(clip, d, seed)
    # z ranks: integers, as the endpoint needs
    for L in [rec['first_frame_keypoints']] + rec['frames']:
        for i, j in enumerate(sorted(L, key=lambda j: j['z_index'])): j['z_index'] = i + 1
    payload = dict(description=DESC, action=rec['action'], direction=d, view='high top-down',
                   first_frame=pl.b64(root_on('kaya', d, rec['canvas'])), first_frame_keypoints=rec['first_frame_keypoints'],
                   keypoints=rec['frames'], template_id='mannequin', seed=seed, no_background=True)
    try:
        return pl.run('/animate-with-skeleton-v3', payload, f'kp-{clip}-{d}-s{seed}',
                      inputs={'first_frame': f'roots/kaya/stance/{d}.png on a {rec["canvas"]} canvas',
                              'keypoints': f'polish/design/{clip}-{d}.json', 'motion': rec['attribution']},
                      notes=f'Kaya polish: {clip} {d}')
    except Exception as e:
        print(spec, 'FAILED', e, flush=True)


if __name__ == '__main__':
    seed = int(sys.argv[1])
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda s: one(s, seed), sys.argv[2:]))
