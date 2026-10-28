"""Rollout step 4: cels from the CMU skeletons (animate-with-skeleton-v3), first frame the curated root on the clip's canvas.

usage (repo root): python3 -I art/source/residents-g1/tools/gen_clip.py SEED name:cand:dir [...]
Reads design/<char>/<cand>-<dir>.json (motion.py) and roots/<char>/<root>/<dir>.png. Writes raw/<char>-<cand>-<dir>-s<SEED>/NN.png,
one PNG per skeleton frame (the first frame itself is not returned). Never PixelLab's own motion templates."""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import pl
from motion import padded, spec_for
HERE = Path(__file__).resolve().parent.parent
C = json.load(open(HERE / 'tools/chars.json'))
strip = lambda L: [dict(label=j['label'], x=j['x'], y=j['y'], z_index=j['z_index']) for j in L]


def one(spec, seed):
    char, cand, d = spec.split(':')
    kp = json.load(open(HERE / f'design/{char}/{cand}-{d}.json'))
    sp = spec_for(char, cand)
    payload = dict(description=C[char]['root_description'], action=kp['action'], direction=d, view='high top-down',
                   first_frame=pl.b64(padded(char, sp, d)), first_frame_keypoints=strip(kp['first_frame_keypoints']),
                   keypoints=[strip(f) for f in kp['frames']], template_id='mannequin', seed=seed, no_background=True)
    try:
        return pl.run('/animate-with-skeleton-v3', payload, f'{char}-{cand}-{d}-s{seed}',
                      inputs={'first_frame': f'roots/{char}/{kp["root"]}/{d}.png on a {kp["canvas"]} canvas', 'keypoints': f'design/{char}/{cand}-{d}.json',
                              'motion': kp['attribution']}, notes=f'{cand} {d}')
    except Exception as e:
        print(spec, 'FAILED', e)


if __name__ == '__main__':
    seed = int(sys.argv[1])
    with ThreadPoolExecutor(12) as ex: list(ex.map(lambda s: one(s, seed), sys.argv[2:]))
