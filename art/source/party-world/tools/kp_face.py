"""Kaya C fixes (#351), fault 1: readable front faces. The steeper camera put the eyes under the fringe in the front
headings; this inpaints eyes and brows on the restyled idle and stance roots of S, SE, SW, E and W.

- probe: inpaint-image-pro-flash on a root composited on the world's paving colour, the mask a box over the face (the
  fringe's lowest rows included, so it may lift), two candidates a call;
- apply: the picked candidate (polish/face/curate.json) and its few hand pixels (`touch`, palette colours) pasted into the root inside the box and the root's own
  silhouette (the alpha never changes, except a hole inside the face box, which is filled), the pre-face roots kept in polish/face/orig/ (apply always reads those, so it can
  be rerun), and the face box saved as polish/face/mask/<kind>/<dir>.png. kp_texture.transfer carries the mask's pixels
  onto every generated cel's head (hits, knockouts, bends) unconditionally, the way the walk's rigid trunk already
  carries the whole head; kp_assemble locks everything to the one palette as before (built from the pre-face roots).

usage (repo root):
  python3 -I art/source/party-world/tools/kp_face.py probe SEED kind:dir ... -> raw/kp-face-<kind>-<dir>-s<SEED>/
  python3 -I art/source/party-world/tools/kp_face.py apply"""
import json, shutil, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
from assemble import islands
HERE = Path(__file__).resolve().parent.parent
BG = (128, 116, 92, 255)
FACE_DESC = ('Pixel art face of a young woman seen from a high oblique camera, her face turned {turn}: two small clearly '
             'readable dark brown eyes, one pixel each with a light catch beside, and two thin dark brows just under a '
             'dark brown fringe that is lifted slightly so the eyes show, tan skin, a hint of a small nose and mouth. '
             'Painterly pixel art, warm light from the upper left, same colours as the surrounding hair and skin.')
TURN = {'south': 'toward the viewer', 'south-east': 'three-quarter toward the viewer and to the right',
        'south-west': 'three-quarter toward the viewer and to the left', 'east': 'in profile to the right',
        'west': 'in profile to the left'}


def kps(kind, d):
    return {k['label']: np.array([k['x'] * 128, k['y'] * 128]) for k in json.load(open(HERE / f'roots/kaya/{kind}/skeleton/{d}.json'))['keypoints']}


def src(kind, d):
    o = HERE / f'polish/face/orig/{kind}/{d}.png'
    return o if o.exists() else HERE / f'roots/kaya/{kind}/{d}.png'


def box(kind, d):
    """The face box: the skin under the fringe and the fringe's lowest rows, the width of the eyes plus 3 px."""
    P = kps(kind, d); xs = [P['LEFT EYE'][0], P['RIGHT EYE'][0], P['NOSE'][0]]
    x0, x1 = int(min(xs)) - 3, int(max(xs)) + 4
    y0, y1 = int(min(P['LEFT EYE'][1], P['RIGHT EYE'][1])) - 1, int(P['NOSE'][1]) + 5
    return x0, y0, x1, y1


def probe(seed, kind, d):
    im = Image.new('RGBA', (128, 128), BG); im.alpha_composite(Image.open(src(kind, d)).convert('RGBA'))
    x0, y0, x1, y1 = box(kind, d)
    m = Image.new('RGB', (128, 128), (0, 0, 0)); m.paste((255, 255, 255), (x0, y0, x1, y1))
    payload = dict(image=pl.b64(im.convert('RGB')), mask_image=pl.b64(m), description=FACE_DESC.format(turn=TURN[d]),
                   output_method='Modify current layer', seed=seed)
    return pl.run('/inpaint-image-pro-flash', payload, f'kp-face-{kind}-{d}-s{seed}',
                  inputs={'image': f'roots/kaya/{kind}/{d}.png on paving', 'mask': f'face box {(x0, y0, x1, y1)}'},
                  notes=f'Kaya C fixes (#351): face inpaint probe {kind} {d}')


def apply():
    cur = json.load(open(HERE / 'polish/face/curate.json'))
    for key, pick in cur['picks'].items():
        kind, d = key.split('/'); root = HERE / f'roots/kaya/{kind}/{d}.png'; orig = HERE / f'polish/face/orig/{kind}/{d}.png'
        if not orig.exists(): orig.parent.mkdir(parents=True, exist_ok=True); shutil.copy(root, orig)
        a = np.asarray(Image.open(orig).convert('RGBA')).copy()
        new = np.asarray(Image.open(HERE / f"raw/kp-face-{kind}-{d}-s{pick['seed']}/{pick['out']:02d}.png").convert('RGBA'))
        x0, y0, x1, y1 = box(kind, d); m = np.zeros(a.shape[:2], bool); m[y0:y1, x0:x1] = True
        op = a[..., 3] >= 128
        # a hole the restyle's cut-out left in the face (idle south-east's cheek) is filled; the outline never moves
        holes = [c for c in islands(~op) if not any(y in (0, 127) or x in (0, 127) for y, x in c)]
        for c in holes:
            for y, x in c: op[y, x] = m[y, x] or op[y, x]
        m &= op; a[m, 3] = 255
        a[m, :3] = new[m, :3]
        for x, y, h in cur.get('touch', {}).get(key, []):
            assert m[y, x], (key, x, y); a[y, x, :3] = [int(h[i:i + 2], 16) for i in (1, 3, 5)]
        Image.fromarray(a).save(root)
        mp = HERE / f'polish/face/mask/{kind}/{d}.png'; mp.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray((m * 255).astype(np.uint8)).save(mp)
        print(key, 'face', (x0, y0, x1, y1), int(m.sum()), 'px')


def mask(kind, d):
    """The face mask of a root (bool, 128 x 128), or None for a heading whose face was not inpainted."""
    p = HERE / f'polish/face/mask/{kind}/{d}.png'
    return np.asarray(Image.open(p)) > 0 if p.exists() else None


if __name__ == '__main__':
    if sys.argv[1] == 'apply': apply()
    elif sys.argv[1] == 'probe':
        seed = int(sys.argv[2])
        with ThreadPoolExecutor(6) as ex: list(ex.map(lambda s: probe(seed, *s.split(':')), sys.argv[3:]))
