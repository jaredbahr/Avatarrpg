"""v16 props: raw PixelLab shrine, lamp and well -> assets/objects_t3/<key>.png (1-bit alpha, largest component, trimmed, outline recoloured as v14proc)."""
import sys
from PIL import Image
from pathlib import Path
H = Path(__file__).resolve().parent.parent
SH = (0x32, 0x21, 0x25)
def outline(im):
    """PixelLab's palette-black (#1c1719) 1 px outline -> a 1 px outline in a darker tone of the material beside it (material x 0.52 pulled to #322125, as v12).
    Only the outer boundary layer; interior darks (shade under the eaves, the side wall, openings) are untouched."""
    w, h = im.size; px = im.load(); out = im.copy(); op = out.load(); n = 0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0 or max(p[:3]) > 40: continue
            if not any(not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
            acc = []
            for r in range(1, 5):
                for yy in range(max(0, y - r), min(h, y + r + 1)):
                    for xx in range(max(0, x - r), min(w, x + r + 1)):
                        q = px[xx, yy]
                        if max(abs(xx - x), abs(yy - y)) == r and q[3] and max(q[:3]) >= 64: acc.append(q[:3])
                if acc: break
            if not acc: continue
            m = [sum(c[i] for c in acc) / len(acc) for i in range(3)]
            op[x, y] = tuple(int(m[i] * 0.52 * 0.78 + SH[i] * 0.22) for i in range(3)) + (255,); n += 1
    print('  outline px recoloured', n); return out
PICK = {'shrine': 'shrine_3_64x80.png', 'lamp': 'lamp_3_48x96.png', 'well': 'well_3_64x72.png'}
for k, f in PICK.items():
    im = Image.open(H / 'v16' / 'raw' / f).convert('RGBA'); px = im.load(); W, Hh = im.size
    for y in range(Hh):
        for x in range(W):
            r, g, b, a = px[x, y]; px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    seen = set(); comps = []
    for y in range(Hh):
        for x in range(W):
            if (x, y) in seen or px[x, y][3] == 0: continue
            st = [(x, y)]; seen.add((x, y)); c = []
            while st:
                cx, cy = st.pop(); c.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        n = (cx + dx, cy + dy)
                        if 0 <= n[0] < W and 0 <= n[1] < Hh and n not in seen and px[n[0], n[1]][3]: seen.add(n); st.append(n)
            comps.append(c)
    comps.sort(key=len, reverse=True); drop = 0
    for c in comps[1:]:
        for x, y in c: px[x, y] = (0, 0, 0, 0); drop += 1
    im = im.crop(im.getbbox()); im = outline(im); im.save(H / 'assets' / 'objects_t3' / f'{k}.png'); print(k, im.size, 'dropped', drop, 'comps', len(comps))
