"""Kaya polish, step 4: the steeper roots in the world's rendering. Sixteen figures (the eight steeper idles, polish/pre/idle,
and the eight stances drawn on them, kp_stance.py's last frame) set on #321's 512 crop of the world painting, one heading a
column, and restyled with #321's settings (restyle.py: edit-images-v2, the world's style sentence, 25 generations); then each
figure is cut out by its placed alpha and hue-locked to its source (colour.py) onto a 128 canvas, sole on row 112, centred:
roots/kaya/<idle|stance>/<dir>.png.

usage (repo root): python3 -I art/source/party-world/tools/kp_restyle.py compose STANCE_SEED
                   python3 -I art/source/party-world/tools/kp_restyle.py restyle SEED
                   python3 -I art/source/party-world/tools/kp_restyle.py extract SEED"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
from colour import hue_lock
from compose import CROP, CELL, FOOT, DIRS, ROOT
from restyle import st
HERE = Path(__file__).resolve().parent.parent
IN = HERE / 'polish/inputs'


def figure(kind, d, stance_seed):
    p = HERE / (f'polish/pre/idle/{d}.png' if kind == 'idle' else f'raw/kp-stance-{d}-s{stance_seed}/02.png')
    im = Image.open(p).convert('RGBA'); a = np.asarray(im).copy(); a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
    ys, xs = np.nonzero(a[..., 3]); return Image.fromarray(a).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def compose(stance_seed):
    world = Image.open(ROOT / 'ba-dan-route-a/world/world-g1-grounded.png').convert('RGB')
    comp = world.crop(CROP).convert('RGBA'); mask = Image.new('L', comp.size, 0); layout = []
    IN.mkdir(parents=True, exist_ok=True)
    for g, kind in enumerate(('idle', 'stance')):
        for k, d in enumerate(DIRS):
            r, c = g * 2 + k // 4, k % 4
            fig = figure(kind, d, stance_seed)
            x0 = int(round(c * CELL + CELL / 2 - fig.width / 2)); y0 = r * CELL + FOOT + 1 - fig.height
            comp.alpha_composite(fig, (x0, y0)); mask.paste(255, (x0, y0), fig.split()[3])
            layout.append(dict(kind=kind, dir=d, x=x0, y=y0, w=fig.width, h=fig.height))
    comp.convert('RGB').save(IN / 'job.png'); mask.save(IN / 'job-mask.png')
    json.dump(dict(crop=CROP, stance_seed=stance_seed, figures=layout), open(IN / 'layout.json', 'w'), indent=1)


def restyle(seed):
    im = Image.open(IN / 'job.png').convert('RGB'); w, h = im.size
    payload = {'method': 'edit_with_text', 'edit_images': [{'image': pl.b64(im), 'width': w, 'height': h}],
               'image_size': {'width': w, 'height': h}, 'description': st.PROMPT.format(n='Sixteen'), 'seed': seed}
    return pl.run('/edit-images-v2', payload, f'kp-restyle-s{seed}', inputs={'edit_images[0]': 'polish/inputs/job.png'},
                  notes="Kaya polish: #321's world restyle on the steeper idle and stance roots")


def extract(seed):
    L = json.load(open(IN / 'layout.json'))
    src = np.asarray(Image.open(IN / 'job.png').convert('RGB'))
    rs = np.asarray(Image.open(HERE / f'raw/kp-restyle-s{seed}/00.png').convert('RGB'))
    locked = hue_lock(rs, src); mask = np.asarray(Image.open(IN / 'job-mask.png')) > 0
    for f in L['figures']:
        x0, y0, w, h = f['x'], f['y'], f['w'], f['h']; m = mask[y0:y0 + h, x0:x0 + w]
        fig = Image.fromarray(np.dstack([locked[y0:y0 + h, x0:x0 + w], (m * 255).astype(np.uint8)]))
        cv = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); cv.alpha_composite(fig, (64 - w // 2, FOOT + 1 - h))
        p = HERE / f"roots/kaya/{f['kind']}"; p.mkdir(parents=True, exist_ok=True); cv.save(p / f"{f['dir']}.png")
    print(len(L['figures']), 'roots')


if __name__ == '__main__':
    {'compose': compose, 'restyle': restyle, 'extract': extract}[sys.argv[1]](int(sys.argv[2]))
