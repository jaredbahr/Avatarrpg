"""Variant A step 1: redraw each character's south idle natively on the 64x96 world-px canvas (edit-image-pro-flash, text).

usage (repo root): python3 -I art/source/party-g1/tools/gen_a_south.py SEED [char ...]
Input: variant B's south idle cel (b/<char>/idle/south/00.png), which carries the shipped identity at the right size and
foot baseline; the edit redraws it as native pixel art instead of a reduction. Output raw/a-south-<char>-s<SEED>/00.png.
"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
C = json.load(open(HERE / 'tools/chars.json'))
STYLE = ('Redraw this exact character at this exact size, position and pose as clean hand-placed pixel art for a 64 px tall '
         'game sprite: crisp 1-pixel dark brown outline, 3 to 4 flat tone steps per material, warm light from the upper left, '
         'matte, no blur, no noise, no stray pixels; a simple readable face with two small dark eyes, clear hands and boots. '
         'Keep every costume colour, the hair and the proportions. High top-down view. ')


def one(char, seed):
    src = HERE / f'b/{char}/idle/south/00.png'
    payload = dict(image=pl.b64(src), method='text', description=STYLE + C[char]['description'], no_background=True, seed=seed)
    return pl.run('/edit-image-pro-flash', payload, f'a-south-{char}-s{seed}', inputs={'image': f'b/{char}/idle/south/00.png'},
                  notes='variant A: native south redraw from the reduced shipped cel')


if __name__ == '__main__':
    seed = int(sys.argv[1]); chars = sys.argv[2:] or ['kaya', 'sura', 'bo']
    with ThreadPoolExecutor(3) as ex: list(ex.map(lambda c: one(c, seed), chars))
