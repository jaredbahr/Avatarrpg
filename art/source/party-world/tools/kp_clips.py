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


def design(clip, d):
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
    rec = dict(old, canvas=W, first_frame_keypoints=first, frames=frames, foot_row=FOOT[W], polish=dict(scale=round(k, 3), press=PRESS,
               reach=REACH if clip == 'bend' else 1, amp=AMP.get(clip, 1), from_=f'design/kaya/{clip}-{d}.json onto roots/kaya/stance/{d}.png'))
    (HERE / 'polish/design').mkdir(parents=True, exist_ok=True)
    json.dump(rec, open(HERE / f'polish/design/{clip}-{d}.json', 'w'), indent=1)
    return rec


def one(spec, seed):
    clip, d = spec.split(':')
    rec = design(clip, d)
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
