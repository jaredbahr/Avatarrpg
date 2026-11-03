"""Rollout step 1: redraw every heading's shipped cel natively on the 64x96 world-px canvas (edit-image-pro-flash, text).

usage (repo root): python3 -I art/source/party-g1/tools/gen_root.py SEED KIND char:dir [char:dir ...]   (KIND idle | stance)
Input: b/<char>/<KIND>/<dir>/00.png, the shipped G cel of that heading reduced to the world grid by reduce.py. It carries the
locked costume (Kaya's model G is the standard, docs/direction.md 2026-09-25) at the right size, pose and foot baseline in
that heading, so identity is taken from the shipped drawing of each heading, not from a rotation model's guess at the back.
Output raw/root-<KIND>-<char>-<dir>-s<SEED>/NN.png (the job returns several candidates; curate.json picks one).
"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
C = json.load(open(HERE / 'tools/chars.json'))
STYLE = ('Redraw this exact character at this exact size, position, facing and pose as clean hand-placed pixel art for a 60 px '
         'tall game sprite: crisp 1-pixel dark brown outline, 3 to 4 flat tone steps per material, warm light from the upper '
         'left, matte, no blur, no noise, no stray pixels; clear hands and boots. Keep every costume colour, the hair and the '
         'proportions exactly as they are; do not add trim, letters, symbols or ornaments that are not there. High top-down view. ')


# Back views drift toward the camera (Kaya's first north-west came back turned to face us); say which way she faces.
FACING = {'north-east': 'Seen from behind: the back is to the viewer and the figure faces away, up and to the right. ',
          'north': 'Seen from directly behind: only the back and the back of the head are visible. ',
          'north-west': 'Seen from behind: the back is to the viewer and the figure faces away, up and to the left; no face, no front of the jacket. '}


def one(spec, kind, seed):
    char, d = spec.split(':')
    src = HERE / f'b/{char}/{kind}/{d}/00.png'
    desc = STYLE + FACING.get(d, '') + (C[char].get('root_back', '') if d in FACING else '') + C[char]['root_description']
    payload = dict(image=pl.b64(src), method='text', description=desc, no_background=True, seed=seed)
    return pl.run('/edit-image-pro-flash', payload, f'root-{kind}-{char}-{d}-s{seed}', inputs={'image': f'b/{char}/{kind}/{d}/00.png'},
                  notes=f'rollout: native {kind} root for {d}, redrawn from the shipped cel of that heading')


if __name__ == '__main__':
    seed = int(sys.argv[1]); kind = sys.argv[2]
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda s: one(s, kind, seed), sys.argv[3:]))
