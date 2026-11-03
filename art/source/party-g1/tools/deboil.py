"""Deterministic de-boil test for variant A idles (experiment; not drawing any motion).

usage (repo root): python3 -I art/source/party-g1/tools/deboil.py [MAXBLOB]
For each A idle cel: snap every pixel to the heading rotation's own palette (no new colours between cels), then find the
pixels that differ from the rotation (sum |dRGB| > 60 or alpha change); 8-connected blobs of at most MAXBLOB (default 3)
pixels revert to the rotation. Larger blobs (shoulders rising, a hand moving) stay as generated. Writes a/<char>/idle-db/.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parent.parent
MAXB = int(sys.argv[1]) if len(sys.argv) > 1 else 3


def blobs(mask):
    lab = np.zeros(mask.shape, int); n = 0; H, W = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        n += 1; st = [(y0, x0)]; lab[y0, x0] = n
        while st:
            y, x = st.pop()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; st.append((yy, xx))
    return lab, n


for char in ['kaya', 'sura', 'bo']:
    for d in ['south', 'south-east', 'east']:
        rot = np.asarray(Image.open(HERE / f'a/{char}/rotations/{d}.png').convert('RGBA')).astype(int)
        pal = np.unique(rot[rot[..., 3] > 127][:, :3], axis=0)
        for f in sorted((HERE / f'a/{char}/idle/{d}').glob('*.png')):
            a = np.asarray(Image.open(f).convert('RGBA')).astype(int).copy()
            op = a[..., 3] > 127
            q = pal[((a[..., None, :3] - pal[None, None]) ** 2).sum(-1).argmin(-1)]
            a[..., :3] = np.where(op[..., None], q, 0); a[..., 3] = np.where(op, 255, 0)
            ch = (np.abs(a[..., :3] - rot[..., :3]).sum(-1) > 60) & (op | (rot[..., 3] > 127)) | (op != (rot[..., 3] > 127))
            lab, n = blobs(ch)
            for k in range(1, n + 1):
                m = lab == k
                if m.sum() <= MAXB: a[m] = rot[m]
            o = HERE / f'a/{char}/idle-db/{d}/{f.name}'; o.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray(a.astype(np.uint8), 'RGBA').save(o)
print('ok')
