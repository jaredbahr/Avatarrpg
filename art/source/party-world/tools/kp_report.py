"""Kaya polish, step 12: the numbers (review/kaya-polish/metrics.json), #321's Kaya against this one.

- boil (kp_boil.py): per clip and heading, the mean over consecutive cel pairs of the share of the head and torso that
  changes beyond the best 3 px shift (a walk wraps round). Each side is measured with its own requested skeletons.
  For hits, knockouts and bends the trunk itself turns and falls, so part of their figure is motion, not boil; they are
  measured the same way on both sides, for comparison only.
- colours: distinct colours a cel, idle against walk, and how many palettes the whole sheet uses (#321 locked every clip
  to its own heading's root, so each heading had its own; this one has one Kaya palette).

usage (repo root): python3 -I art/source/party-world/tools/kp_report.py OLD_CELS_DIR
(OLD_CELS_DIR: #321's cels/kaya, e.g. from `git show d198e6b5:...` or a copy)"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from kp_boil import boil
HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parents[2]
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
KO = ['south-east', 'north-east', 'north-west', 'south-west']
BEND_CELS = json.load(open(HERE.parent / 'party-g1/tools/motion.json'))['kaya']['bend']['cels']
BASE = 'd198e6b5'


def old_json(rel):
    return json.loads(subprocess.check_output(['git', 'show', f'{BASE}:art/source/party-world/{rel}'], cwd=REPO))


def load(p):
    return np.asarray(Image.open(p).convert('RGBA'))


def clip(cels_dir, name, d, des, W, wrap=False, walk=False):
    if walk:
        cels = [load(cels_dir / f'walk/{d}/{i:02d}.png') for i in range(6)]; sk = des['frames']
    else:
        idx = [0] + (BEND_CELS if name == 'bend' else list(range(1, len(des['frames']) + 1)))
        cels = [load(cels_dir / f'{name}/{d}/{i:02d}.png') for i in idx]; sk = [des['first_frame_keypoints']] + des['frames']
    v = boil(cels, sk, W, wrap)
    return round(float(np.mean(v)), 3), v


def colours(cels_dir):
    n = lambda p: len(np.unique(load(p)[..., :3][load(p)[..., 3] > 0].reshape(-1, 3), axis=0))
    idle = [n(cels_dir / f'idle/{d}/00.png') for d in DIRS]
    walk = [n(cels_dir / f'walk/{d}/{i:02d}.png') for d in DIRS for i in range(6)]
    allc = np.unique(np.concatenate([load(p)[..., :3][load(p)[..., 3] > 0].reshape(-1, 3) for p in cels_dir.glob('*/*/*.png')]), axis=0)
    return dict(idle_mean=round(float(np.mean(idle)), 1), walk_mean=round(float(np.mean(walk)), 1), sheet_total=int(len(allc)))


if __name__ == '__main__':
    old_dir = Path(sys.argv[1]); new_dir = HERE / 'cels/kaya'; out = {'boil': {}, 'colours': {}}
    for side, cdir in (('before', old_dir), ('after', new_dir)):
        b = {}
        for d in DIRS:
            des = old_json(f'design/kaya-{d}.json') if side == 'before' else json.load(open(HERE / f'design/kaya-{d}.json'))
            b[f'walk/{d}'] = clip(cdir, 'walk', d, des, 128, wrap=True, walk=True)[0]
        for name, dirs, W in (('hit', DIRS, 128), ('ko', KO, 192), ('bend', DIRS, 192)):
            for d in dirs:
                des = old_json(f'design/kaya/{name}-{d}.json') if side == 'before' else json.load(open(HERE / f'polish/design/{name}-{d}.json'))
                b[f'{name}/{d}'] = clip(cdir, name, d, des, W)[0]
        out['boil'][side] = b; out['colours'][side] = colours(cdir)
    summary = {}
    for name in ('walk', 'hit', 'ko', 'bend'):
        for side in ('before', 'after'):
            v = [x for k, x in out['boil'][side].items() if k.startswith(name + '/')]
            summary.setdefault(name, {})[side] = dict(mean=round(float(np.mean(v)), 3), min=min(v), max=max(v))
    out['summary'] = summary
    (HERE / 'review/kaya-polish').mkdir(parents=True, exist_ok=True)
    json.dump(out, open(HERE / 'review/kaya-polish/metrics.json', 'w'), indent=1)
    print(json.dumps(summary, indent=1)); print(json.dumps(out['colours']))
