"""Variant A step 4: cels from the CMU skeletons (animate-with-skeleton-v3), first frame the native rotation.

usage (repo root): python3 -I art/source/party-g1/tools/gen_motion.py SEED char:cand:dir [...]
Reads a/<char>/rotations/<dir>.png and a/<char>/design/kp/<cand>-<dir>.json (design.py). Writes raw/<char>-<cand>-<dir>-s<SEED>/NN.png.
"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
C = json.load(open(HERE / 'tools/chars.json'))
strip = lambda L: [dict(label=j['label'], x=j['x'], y=j['y'], z_index=j['z_index']) for j in L]


def one(spec, seed):
    char, cand, d = spec.split(':')
    kp = json.load(open(HERE / f'a/{char}/design/kp/{cand}-{d}.json'))
    payload = dict(description=C[char]['description'], action=kp['action'], direction=d, view='high top-down',
                   first_frame=pl.b64(HERE / f'a/{char}/rotations/{d}.png'), first_frame_keypoints=strip(kp['first_frame_keypoints']),
                   keypoints=[strip(f) for f in kp['frames']], template_id='mannequin', seed=seed, no_background=True)
    return pl.run('/animate-with-skeleton-v3', payload, f'{char}-{cand}-{d}-s{seed}',
                  inputs={'first_frame': f'a/{char}/rotations/{d}.png', 'keypoints': f'a/{char}/design/kp/{cand}-{d}.json',
                          'motion': kp['attribution'], 'cycle': kp.get('cycle')}, notes='variant A motion test')


if __name__ == '__main__':
    seed = int(sys.argv[1])
    with ThreadPoolExecutor(12) as ex: list(ex.map(lambda s: one(s, seed), sys.argv[2:]))
