"""Step 3: the roots. Cut each figure out of its job's restyle by its placed alpha (inputs/job<N>-mask.png), hue-lock it
to its source figure (colour.py, #317's lock: lightness and texture from the restyle, hue from the source, chroma 55/45),
and set it on a 128x128 canvas with its sole on row 112, centred on x 64.

usage (repo root): python3 -I art/source/party-world/tools/extract.py SEED  -> roots/<char>/<kind>/<dir>.png"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from colour import hue_lock
HERE = Path(__file__).resolve().parent.parent
CANVAS, FOOT = 128, 112


def main(seed):
    L = json.load(open(HERE / 'inputs/layout.json'))
    cache = {}
    for f in L['figures']:
        j = f['job']
        if j not in cache:
            src = np.asarray(Image.open(HERE / f'inputs/job{j}.png').convert('RGB'))
            rs = np.asarray(Image.open(HERE / f'raw/r-job{j}-s{seed}/00.png').convert('RGB'))
            cache[j] = (hue_lock(rs, src), np.asarray(Image.open(HERE / f'inputs/job{j}-mask.png')) > 0)
        locked, mask = cache[j]
        x0, y0, w, h = f['x'], f['y'], f['w'], f['h']
        m = mask[y0:y0 + h, x0:x0 + w]
        fig = Image.fromarray(np.dstack([locked[y0:y0 + h, x0:x0 + w], (m * 255).astype(np.uint8)]))
        ys, xs = np.nonzero(m); fig = fig.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        cv = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
        cv.alpha_composite(fig, (CANVAS // 2 - fig.width // 2, FOOT + 1 - fig.height))
        p = HERE / f"roots/{f['char']}/{f['kind']}"; p.mkdir(parents=True, exist_ok=True); cv.save(p / f"{f['dir']}.png")
    print(len(L['figures']), 'roots')


if __name__ == '__main__':
    main(int(sys.argv[1]))
