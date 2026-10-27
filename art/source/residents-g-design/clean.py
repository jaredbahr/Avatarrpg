"""clean.py SRC_DIR OUT_DIR : copies eight rotations keeping only the largest 8-connected opaque blob of each (drops the
detached strokes the rotation models drew in the empty canvas above Pella). Nothing touching the figure is changed."""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image
src, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True); log = {}
for p in sorted(src.glob('*.png')):
    im = np.array(Image.open(p).convert('RGBA')); a = im[:, :, 3] > 0; H, W = a.shape
    lab = np.zeros(a.shape, int); n = 0; sizes = {}
    for y0, x0 in zip(*np.nonzero(a)):
        if lab[y0, x0]: continue
        n += 1; st = [(y0, x0)]; lab[y0, x0] = n; c = 0
        while st:
            y, x = st.pop(); c += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and a[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; st.append((yy, xx))
        sizes[n] = c
    keep = max(sizes, key=sizes.get); drop = lab.astype(bool) & (lab != keep)
    im[drop] = 0; Image.fromarray(im).save(out / p.name); log[p.stem] = int(drop.sum())
json.dump(log, open(out / 'clean.json', 'w'), indent=1); print(log)
