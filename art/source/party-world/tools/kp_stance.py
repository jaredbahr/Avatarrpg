"""Kaya polish, step 3: the fighting stance on the steeper body. #321's stance root and idle root of a heading give the
stance as a per-joint offset (estimate-skeleton on both); that offset, scaled by the new body's height and pressed 0.9
vertically for the steeper camera, is laid on the new idle's skeleton. animate-with-skeleton-v3 then poses the new idle
root through a third, two thirds and all of it (3 frames, 2 generations); the last frame is the stance drawing.

usage (repo root): python3 -I art/source/party-world/tools/kp_stance.py SEED dir [dir ...] -> raw/kp-stance-<dir>-s<SEED>/ + polish/design/stance-<dir>.json"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
DESC = ('young woman with tan skin, dark brown hair in a high ponytail with a small red hair tie, fitted dark red jacket, red '
        'cloth waist sash knotted at her left hip, long dark red coat tails, dark baggy trousers, dark brown leather calf boots, '
        'dark forearm bracers, painterly pixel art with soft mottled tone clusters, warm light from the upper left')
W = 128
strip = lambda L: [dict(label=j['label'], x=j['x'], y=j['y'], z_index=j['z_index']) for j in L]


def kps(path):
    """An estimated skeleton by label, its z_index made integer ranks (nearest highest), as the endpoint needs."""
    K = {k['label']: dict(k) for k in json.load(open(path))['keypoints']}
    for i, lab in enumerate(sorted(K, key=lambda l: K[l]['z_index'])): K[lab]['z_index'] = i + 1
    return K


def height(path):
    ys = np.nonzero(np.asarray(Image.open(path).convert('RGBA'))[..., 3] > 127)[0]; return ys.max() - ys.min() + 1


def design(d):
    new = kps(HERE / f'polish/pre/idle/{d}.skel.json')
    oi = kps(HERE / f'roots/kaya/idle/skeleton/{d}.json'); os_ = kps(HERE / f'polish/old-stance/{d}.skel.json')
    k = height(HERE / f'polish/pre/idle/{d}.png') / height(HERE / f'roots/kaya/idle/{d}.png')
    frames = []
    for t in (1 / 3, 2 / 3, 1.0):
        f = []
        for lab, j in new.items():
            dx = (os_[lab]['x'] - oi[lab]['x']) * k; dy = (os_[lab]['y'] - oi[lab]['y']) * k * 0.9
            f.append(dict(label=lab, x=round(j['x'] + t * dx, 4), y=round(j['y'] + t * dy, 4), z_index=j['z_index']))
        frames.append(f)
    rec = dict(dir=d, canvas=W, first_frame_keypoints=strip(new.values()), frames=frames, scale=round(k, 3))
    (HERE / 'polish/design').mkdir(parents=True, exist_ok=True)
    json.dump(rec, open(HERE / f'polish/design/stance-{d}.json', 'w'), indent=1)
    return rec


def one(d, seed):
    rec = design(d)
    payload = dict(description=DESC, action='fighting stance', direction=d, view='high top-down',
                   first_frame=pl.b64(HERE / f'polish/pre/idle/{d}.png'), first_frame_keypoints=rec['first_frame_keypoints'],
                   keypoints=rec['frames'], template_id='mannequin', seed=seed, no_background=True)
    try:
        return pl.run('/animate-with-skeleton-v3', payload, f'kp-stance-{d}-s{seed}',
                      inputs={'first_frame': f'polish/pre/idle/{d}.png', 'keypoints': f'polish/design/stance-{d}.json'},
                      notes='Kaya polish: stance on the steeper body')
    except Exception as e:
        print(d, 'FAILED', e)


if __name__ == '__main__':
    seed = int(sys.argv[1])
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda d: one(d, seed), sys.argv[2:]))
