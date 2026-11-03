"""Step 1: steeper-camera bodies in eight headings. create-character-v3 in reference mode rotates the character's own
south root (party-g1, scaled 1.25 to ~74 px and set on a 128 canvas, foot at row 112) into eight views at the
`high top-down` camera. Cost ceil(128*128*8/65536) = 2 a character.

usage (repo root): python3 -I art/source/party-world/tools/rotate.py SEED char [char ...] -> raw/rot-<char>-s<SEED>/NN.png
(order S, SE, E, NE, N, NW, W, SW)"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
SRC = HERE.parent / 'party-g1'
C = json.load(open(SRC / 'tools/chars.json'))
SCALE, CANVAS, FOOT = 1.25, 128, 112


def scaled_root(char, kind='idle', d='south'):
    im = Image.open(SRC / f'roots/{char}/{kind}/{d}.png').convert('RGBA')
    a = np.asarray(im); ys, xs = np.nonzero(a[..., 3] > 0)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    im = im.resize((round(im.width * SCALE), round(im.height * SCALE)), Image.NEAREST)
    cv = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    cv.alpha_composite(im, (CANVAS // 2 - im.width // 2, FOOT + 1 - im.height))
    return cv


if __name__ == '__main__':
    seed = int(sys.argv[1])
    for char in sys.argv[2:]:
        ref = scaled_root(char); (HERE / 'inputs').mkdir(exist_ok=True); ref.save(HERE / f'inputs/{char}-south-128.png')
        payload = dict(description=C[char]['root_description'], reference_image=pl.b64(ref), n_directions=8,
                       view='high top-down', template_id='mannequin', seed=seed, no_background=True)
        pl.run('/create-character-v3', payload, f'rot-{char}-s{seed}', inputs={'reference_image': f'inputs/{char}-south-128.png'},
               notes='steeper-camera rotation pilot (high top-down) from the party-g1 south root x1.25')
