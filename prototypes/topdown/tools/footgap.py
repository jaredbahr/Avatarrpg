"""Foot track width in the front/back views: over the bottom 4 rows (the boots), the outer span of the feet and the
empty gap between the two boots, per frame; reports the max over the cycle (px, at 1 art px)."""
import json, sys
from PIL import Image
def feet(path):
    im = Image.open(path).convert('RGBA'); a = im.split()[3]; bb = im.getbbox(); y1 = bb[3]
    cols = sorted({x for y in range(y1 - 4, y1) for x in range(im.width) if a.getpixel((x, y)) > 128})
    span = cols[-1] - cols[0] + 1
    gap = max((b - a - 1 for a, b in zip(cols, cols[1:])), default=0)
    return span, gap
def report(folder, clip, dirs=('south', 'north')):
    out = {}
    for d in dirs:
        r = [feet(f'assets/chars/{folder}/{f}') for f in clip[d]]
        out[d] = {'span_max': max(s for s, _ in r), 'span_mean': round(sum(s for s, _ in r) / len(r), 1), 'gap_max': max(g for _, g in r)}
    return out
if __name__ == '__main__':
    m = json.load(open('assets/chars/kaya2/meta.json'))
    for k, v in m['anims'].items():
        if len(v.get('south', [])) in (8, 12) and 'north' in v and not any(w in k for w in ('standing', 'martial', 'fire-bending')):
            print(k[:44].ljust(44), report('kaya2', v))
