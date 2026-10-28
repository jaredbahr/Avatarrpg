"""Step 3: the animation roots. Cut each figure out of the restyle by its placed alpha (inputs/mask.png), hue-lock it to its
source figure (colour.py), and set it on a 128x128 canvas with the foot row at 112 and centred on x 64.

usage: python3 -I tools/extract_roots.py RESTYLED.png OUTDIR"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from colour import hue_lock
HERE = Path(__file__).resolve().parent.parent
CANVAS, FOOT = 128, 112


def main(restyled, outdir):
    L = json.load(open(HERE / 'inputs/layout.json'))
    src = np.asarray(Image.open(HERE / 'inputs/composite.png').convert('RGB'))
    rs = np.asarray(Image.open(restyled).convert('RGB'))
    mask = np.asarray(Image.open(HERE / 'inputs/mask.png')) > 0
    locked = hue_lock(rs, src)
    for f in L['figures']:
        x0, y0, w, h = f['x'], f['y'], f['w'], f['h']
        m = mask[y0:y0 + h, x0:x0 + w]
        rgba = np.dstack([locked[y0:y0 + h, x0:x0 + w], (m * 255).astype(np.uint8)])
        ys, xs = np.nonzero(m)
        fig = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        cv = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
        cv.alpha_composite(fig, (CANVAS // 2 - fig.width // 2, FOOT + 1 - fig.height))
        p = Path(outdir) / f['char']; p.mkdir(parents=True, exist_ok=True); cv.save(p / f"{f['dir']}.png")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
