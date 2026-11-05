"""Tutorial pass: clean the quarry objects into assets/objects13/: hard 1-bit alpha, PixelLab's baked grey ground plate peeled
off from the outside in (low-saturation grey pixels reached from the transparent border, below the object's upper third),
detached specks under 6 px dropped, cropped to the bounding box (the object stands on its lowest pixel). Prints per-asset stats."""
import json, glob, os
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent.parent; OUT = H / 'assets' / 'objects13'; OUT.mkdir(exist_ok=True)
PICK = {}   # key -> seed (default 3)
SRC = {k: H / 't13' / 'obj' / f'{k}_{PICK.get(k, 3)}.png' for k in [p.split('/')[-1].rsplit('_', 1)[0] for p in glob.glob(str(H / 't13' / 'obj' / '*_3.png'))]}
SRC.pop('driller', None)   # the first, small take (58 px wide): replaced by driller_big (seed 5), whose 8 views follow
for d in ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east']:
    SRC['driller_' + d.replace('-', '')] = H / 'assets' / 'driller' / f'rotations__{d}.png'
def greyish(c): r, g, b, a = c; return a and max(r, g, b) - min(r, g, b) < 18 and 110 < r < 205
def clean(im):
    W, Hh = im.size; p = im.load(); hard = plate = speck = 0
    for y in range(Hh):
        for x in range(W):
            a = p[x, y][3]
            if 0 < a < 128: p[x, y] = (0, 0, 0, 0); hard += 1
            elif 128 <= a < 255: p[x, y] = p[x, y][:3] + (255,); hard += 1
    bb = im.getbbox(); top = bb[1] + (bb[3] - bb[1]) // 3
    ch = True
    while ch:
        ch = False
        for y in range(top, Hh):
            for x in range(W):
                if greyish(p[x, y]) and any(0 <= x + dx < W and 0 <= y + dy < Hh and p[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    # only a plate if a run of the same grey stretches sideways (a plate is wide and flat, an outline is not)
                    run = sum(1 for k in range(-3, 4) if 0 <= x + k < W and greyish(p[x + k, y]))
                    if run >= 5: p[x, y] = (0, 0, 0, 0); ch = True; plate += 1
    seen = set()
    for y in range(Hh):
        for x in range(W):
            if (x, y) in seen or not p[x, y][3]: continue
            st, comp = [(x, y)], []; seen.add((x, y))
            while st:
                cx, cy = st.pop(); comp.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < Hh and (nx, ny) not in seen and p[nx, ny][3]: seen.add((nx, ny)); st.append((nx, ny))
            if len(comp) < 6:
                for cx, cy in comp: p[cx, cy] = (0, 0, 0, 0)
                speck += len(comp)
    return im.crop(im.getbbox()), hard, plate, speck
man = {}
for k, src in sorted(SRC.items()):
    if not src.exists(): continue
    im, hard, plate, speck = clean(Image.open(src).convert('RGBA'))
    im.save(OUT / f'{k}.png'); man[k] = {'w': im.width, 'h': im.height, 'src': str(src.relative_to(H))}
    print(f'{k:16s} {im.width:3d}x{im.height:<3d} soft-alpha {hard:4d} plate {plate:4d} specks {speck:3d}')
json.dump(man, open(OUT / 'manifest.json', 'w'), indent=1)
