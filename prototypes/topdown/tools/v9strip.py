"""v9: peel the baked ground shadow (PixelLab's flat (174,168,156) plate) off every object, from the outside in, to true transparency."""
import json
from PIL import Image
from pathlib import Path
SRC, DST = Path('v8/objects8_orig'), Path('assets/objects8')
plate = lambda c: c[3] > 0 and abs(c[0] - 174) <= 6 and abs(c[1] - 168) <= 6 and abs(c[2] - 156) <= 6
m = json.load(open(DST / 'manifest.json')); out = {}
for k in m:
    if not (SRC / f'{k}.png').exists(): continue
    im = Image.open(SRC / f'{k}.png').convert('RGBA'); W, H = im.size; p = im.load(); n = 0
    # also any soft alpha: hard edges only
    for y in range(H):
        for x in range(W):
            if 0 < p[x, y][3] < 128: p[x, y] = (0, 0, 0, 0); n += 1
            elif 128 <= p[x, y][3] < 255: r, g, b, a = p[x, y]; p[x, y] = (r, g, b, 255)
    ch = True
    while ch:
        ch = False
        for y in range(H):
            for x in range(W):
                if plate(p[x, y]) and any(0 <= x + dx < W and 0 <= y + dy < H and p[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    p[x, y] = (0, 0, 0, 0); ch = True; n += 1
    bb = im.getbbox(); dy = H - bb[3]
    # keep the bottom-centre anchoring: crop to the bbox, the object then stands on its own lowest pixel
    im = im.crop(bb); im.save(DST / f'{k}.png'); m[k]['w'], m[k]['h'] = im.size; out[k] = n
json.dump(m, open(DST / 'manifest.json', 'w'), indent=1)
print({k: v for k, v in out.items() if v})
