"""Step 1: redraw every heading's shipped cel natively on the world grid (edit-image-pro-flash, text): the party's recipe.

usage (repo root): python3 -I art/source/residents-g1/tools/gen_root.py SEED name:kind:dir[:cel] [...]
  kind idle (cel 0 of that heading's idle) or cast (the bandit's legacy east cast, cel 0-2).
Input: b/<name>/<kind>/<dir>/NN.png, the shipped G cel of that heading reduced 2x (reduce.py): a 64x96 cel (the bruiser's
80x96) carrying the shipped identity, pose and foot baseline. Output raw/root-<kind>[<cel>]-<name>-<dir>-s<SEED>/NN.png.
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
         'left, matte, no blur, no noise, no stray pixels; clear hands and feet. Keep every costume colour, the hair, anything '
         'held and the proportions exactly as they are; do not add trim, letters, symbols or ornaments that are not there. '
         'High top-down view. ')
FACING = {'north-east': 'Seen from behind: the back is to the viewer and the figure faces away, up and to the right. ',
          'north': 'Seen from directly behind: only the back and the back of the head are visible. ',
          'north-west': 'Seen from behind: the back is to the viewer and the figure faces away, up and to the left; no face, no front of the clothes. '}
CAST = 'This is one frame of an attack, facing right: keep the exact pose, the swing and the weapon where they are. '


def one(spec, seed):
    parts = spec.split(':'); name, kind, d = parts[:3]; cel = int(parts[3]) if len(parts) > 3 else 0
    src = f'b/{name}/{kind}/{d}/{cel:02d}.png'
    desc = STYLE + (CAST if kind == 'cast' else '') + FACING.get(d, '') + (C[name].get('root_back', '') if d in FACING else '') + C[name]['root_description']
    payload = dict(image=pl.b64(HERE / src), method='text', description=desc, no_background=True, seed=seed)
    tag = kind if kind == 'idle' else f'{kind}{cel}'
    try:
        return pl.run('/edit-image-pro-flash', payload, f'root-{tag}-{name}-{d}-s{seed}', inputs={'image': src},
                      notes=f'native {tag} root for {d}, redrawn from the shipped cel of that heading')
    except Exception as e:
        print(spec, 'FAILED', e)


if __name__ == '__main__':
    seed = int(sys.argv[1])
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda s: one(s, seed), sys.argv[2:]))
